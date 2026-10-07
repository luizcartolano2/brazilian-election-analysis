"""Reads TSE's aggregate results for one race and area: TSE's own totals and classification."""

from dataclasses import dataclass

CANDIDATE = 1
PARTY_LIST = 2
BLANK = 3
NULL = 4
TECHNICAL_NULL = 5
ANNULLED = 6
ANNULLED_SUB_JUDICE = 7

VOTE_TYPES = {
    CANDIDATE: "candidate",
    PARTY_LIST: "party list",
    BLANK: "blank",
    NULL: "null",
    TECHNICAL_NULL: "technical null",
    ANNULLED: "annulled",
    ANNULLED_SUB_JUDICE: "annulled sub judice",
}

BLANK_NUMBER = 95
NULL_NUMBER = 96

CANDIDATE_DESTINATIONS = {
    "Válido": CANDIDATE,
    "Anulado": ANNULLED,
    "Anulado sub judice": ANNULLED_SUB_JUDICE,
}
PARTY_DESTINATIONS = {
    "Válido (legenda)": PARTY_LIST,
    "Anulado sub judice": ANNULLED_SUB_JUDICE,
}

# TSE's key for each vote type's total in an aggregate's `v` block.
TOTAL_KEYS = {
    CANDIDATE: "vnom",
    PARTY_LIST: "vl",
    BLANK: "vb",
    NULL: "vn",
    TECHNICAL_NULL: "vnt",
    ANNULLED: "van",
    ANNULLED_SUB_JUDICE: "vansj",
}


class UnknownDestination(Exception):
    pass


class MalformedAggregate(Exception):
    pass


@dataclass(frozen=True)
class AggregateCandidate:
    number: int
    ballot_name: str
    party_number: int
    party: str
    destination: str
    vote_type: int
    outcome: str
    votes: int


@dataclass(frozen=True)
class AggregateParty:
    """`list_votes` is TSE's `tval`: list votes counted, whatever their destination. For a valid
    party it equals the valid list votes (`tvtl`); for a party under appeal `tvtl` is 0."""

    number: int
    acronym: str
    destination: str
    vote_type: int
    list_votes: int


@dataclass(frozen=True)
class RaceAggregate:
    election: int
    race: int
    race_name: str
    area: str
    seats: int
    attendance: int
    eligible: int
    total_votes: int
    valid_votes: int
    totals: dict[int, int]
    candidates: dict[int, AggregateCandidate]
    parties: dict[int, AggregateParty]

    @property
    def choices_per_voter(self) -> int:
        if self.attendance == 0:
            raise MalformedAggregate(f"{self.label} has no attendance")
        choices, remainder = divmod(self.total_votes, self.attendance)
        if remainder:
            raise MalformedAggregate(
                f"{self.label}: total votes {self.total_votes} are not a whole multiple "
                f"of attendance {self.attendance}"
            )
        return choices

    @property
    def label(self) -> str:
        return f"election {self.election} race {self.race} area {self.area}"

    def vote_type(
        self, number: int, proportional: bool, unlisted: dict[int, int] | None = None
    ) -> int:
        """`unlisted` maps numbers the aggregate omits to the type TSE's municipality-and-zone
        file gives them. A candidacy under appeal can be missing from the aggregate's list while
        its votes still count as annulled sub judice there."""
        if number == BLANK_NUMBER:
            return BLANK
        if number == NULL_NUMBER:
            return NULL
        if number in self.candidates:
            return self.candidates[number].vote_type
        if proportional and number in self.parties:
            return self.parties[number].vote_type
        if unlisted and number in unlisted:
            return unlisted[number]
        return TECHNICAL_NULL


def typed_a_party(number: int, proportional: bool) -> bool:
    """TSE's turnout file counts any two-digit number typed in a proportional race as a list
    vote, even for a party with no list in that state, whose votes its totals call technical
    nulls. Classification follows the totals; this flag follows the turnout file."""
    return proportional and number < 100 and number not in (BLANK_NUMBER, NULL_NUMBER)


def unlisted_vote_types(destinations: list[tuple[int, str]], label: str) -> dict[int, int]:
    """Maps each number's destination from TSE's munzona file, failing on an unknown value or on
    a number that carries two destinations."""
    types: dict[int, int] = {}
    for number, destination in destinations:
        if destination not in CANDIDATE_DESTINATIONS:
            raise UnknownDestination(f"{label}: candidate {number} has destination {destination!r}")
        vote_type = CANDIDATE_DESTINATIONS[destination]
        if types.setdefault(number, vote_type) != vote_type:
            raise UnknownDestination(f"{label}: candidate {number} has two destinations")
    return types


def _int(block: dict, key: str, label: str) -> int:
    if key not in block:
        raise MalformedAggregate(f"{label} has no field {key}")
    return int(block[key])


def parse_aggregate(document: dict, area: str, proportional: bool) -> RaceAggregate:
    race_code = (document.get("carg") or [{}])[0].get("cd")
    label = f"election {document.get('ele')} race {race_code} area {area}"
    try:
        return _parse(document, area, proportional, label)
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise MalformedAggregate(f"{label}: missing or invalid field {error!r}") from None


def destinations_agree(aggregate: RaceAggregate, unlisted: dict[int, int]) -> None:
    """A number both files classify must get the same type from each."""
    for number, candidate in aggregate.candidates.items():
        if number in unlisted and unlisted[number] != candidate.vote_type:
            raise UnknownDestination(f"{aggregate.label}: candidate {number} has two destinations")


def _parse(document: dict, area: str, proportional: bool, label: str) -> RaceAggregate:
    race = document["carg"][0]
    votes = document["v"]
    electorate = document["e"]

    candidates: dict[int, AggregateCandidate] = {}
    parties: dict[int, AggregateParty] = {}
    for group in race.get("agr", []):
        for party in group.get("par", []):
            party_number = int(party["n"])
            if proportional:
                if party["dvt"] not in PARTY_DESTINATIONS:
                    raise UnknownDestination(
                        f"{label}: party {party_number} has destination {party['dvt']!r}"
                    )
                parties[party_number] = AggregateParty(
                    number=party_number,
                    acronym=party["sg"],
                    destination=party["dvt"],
                    vote_type=PARTY_DESTINATIONS[party["dvt"]],
                    list_votes=_int(party, "tval", label),
                )
            for candidate in party.get("cand", []):
                number = int(candidate["n"])
                if candidate["dvt"] not in CANDIDATE_DESTINATIONS:
                    raise UnknownDestination(
                        f"{label}: candidate {number} has destination {candidate['dvt']!r}"
                    )
                candidates[number] = AggregateCandidate(
                    number=number,
                    ballot_name=candidate["nmu"],
                    party_number=party_number,
                    party=party["sg"],
                    destination=candidate["dvt"],
                    vote_type=CANDIDATE_DESTINATIONS[candidate["dvt"]],
                    outcome=candidate.get("st", ""),
                    votes=_int(candidate, "vap", label),
                )

    totals = {}
    for vote_type, key in TOTAL_KEYS.items():
        if key == "vl" and not proportional:
            totals[vote_type] = int(votes.get(key, 0))
        else:
            totals[vote_type] = _int(votes, key, label)

    return RaceAggregate(
        election=int(document["ele"]),
        race=int(race["cd"]),
        race_name=race["nmn"],
        area=area,
        seats=int(race["nv"]),
        attendance=_int(electorate, "c", label),
        eligible=_int(electorate, "te", label),
        total_votes=_int(votes, "tv", label),
        valid_votes=_int(votes, "vv", label),
        totals=totals,
        candidates=candidates,
        parties=parties,
    )
