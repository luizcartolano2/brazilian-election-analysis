import pytest

from eleicoes.aggregates import (
    ANNULLED_SUB_JUDICE,
    BLANK,
    CANDIDATE,
    NULL,
    PARTY_LIST,
    TECHNICAL_NULL,
    MalformedAggregate,
    UnknownDestination,
    parse_aggregate,
    typed_a_party,
    unlisted_vote_types,
)


def document(parties, totals=None, attendance="100", total_votes="100", seats="1", race="6"):
    base_totals = {
        "vnom": "0",
        "vl": "0",
        "vb": "0",
        "vn": "0",
        "vnt": "0",
        "van": "0",
        "vansj": "0",
    }
    return {
        "ele": "6259",
        "carg": [{"cd": race, "nmn": "Deputado Federal", "nv": seats, "agr": [{"par": parties}]}],
        "v": base_totals | (totals or {}) | {"tv": total_votes, "vv": "0"},
        "e": {"c": attendance, "te": "120"},
    }


def party(number, destination="Válido (legenda)", list_votes="0", candidates=()):
    return {"n": str(number), "sg": f"P{number}", "dvt": destination, "tval": list_votes,
            "cand": list(candidates)}  # fmt: skip


def candidate(number, destination="Válido", outcome="Eleito", votes="0"):
    return {"n": str(number), "nmu": f"C{number}", "dvt": destination, "st": outcome, "vap": votes}


class TestVoteType:
    def setup_method(self):
        self.aggregate = parse_aggregate(
            document([
                party(15, candidates=[candidate(1501), candidate(1515, "Anulado sub judice")]),
                party(33, "Anulado sub judice", candidates=[candidate(3301, "Anulado sub judice")]),
            ]),
            "ac",
            proportional=True,
        )  # fmt: skip

    def test_blank_and_null_numbers(self):
        assert self.aggregate.vote_type(95, True) == BLANK
        assert self.aggregate.vote_type(96, True) == NULL

    def test_listed_candidates_take_their_destination(self):
        assert self.aggregate.vote_type(1501, True) == CANDIDATE
        assert self.aggregate.vote_type(1515, True) == ANNULLED_SUB_JUDICE

    def test_party_lists_take_their_destination(self):
        assert self.aggregate.vote_type(15, True) == PARTY_LIST
        assert self.aggregate.vote_type(33, True) == ANNULLED_SUB_JUDICE

    def test_number_missing_everywhere_is_a_technical_null(self):
        assert self.aggregate.vote_type(4000, True) == TECHNICAL_NULL
        assert self.aggregate.vote_type(77, True) == TECHNICAL_NULL

    def test_unlisted_number_takes_the_munzona_destination(self):
        unlisted = unlisted_vote_types([(4033, "Anulado sub judice")], "pe")
        assert self.aggregate.vote_type(4033, True, unlisted) == ANNULLED_SUB_JUDICE

    def test_a_party_number_in_a_majoritarian_race_is_not_a_list(self):
        assert self.aggregate.vote_type(15, False) == TECHNICAL_NULL


class TestDestinations:
    def test_unknown_candidate_destination_fails(self):
        with pytest.raises(UnknownDestination, match="Algo novo"):
            parse_aggregate(document([party(15, candidates=[candidate(1501, "Algo novo")])]),
                            "ac", proportional=True)  # fmt: skip

    def test_unknown_party_destination_fails(self):
        with pytest.raises(UnknownDestination, match="party 15"):
            parse_aggregate(document([party(15, "Algo novo")]), "ac", proportional=True)

    def test_unlisted_number_with_two_destinations_fails(self):
        with pytest.raises(UnknownDestination, match="two destinations"):
            unlisted_vote_types([(4033, "Válido"), (4033, "Anulado sub judice")], "pe")

    def test_unknown_unlisted_destination_fails(self):
        with pytest.raises(UnknownDestination):
            unlisted_vote_types([(4033, "Algo novo")], "pe")


class TestChoicesPerVoter:
    def test_senate_with_two_seats_gives_two_choices(self):
        aggregate = parse_aggregate(
            document([], attendance="100", total_votes="200", seats="2", race="5"), "ac", False
        )
        assert (aggregate.seats, aggregate.choices_per_voter) == (2, 2)

    def test_council_with_seven_seats_gives_one_choice(self):
        aggregate = parse_aggregate(
            document([], attendance="100", total_votes="100", seats="7", race="25"),
            "pe30015",
            False,
        )
        assert (aggregate.seats, aggregate.choices_per_voter) == (7, 1)

    def test_a_ratio_that_is_not_whole_fails(self):
        aggregate = parse_aggregate(document([], attendance="100", total_votes="150"), "ac", True)
        with pytest.raises(MalformedAggregate, match="not a whole multiple"):
            _ = aggregate.choices_per_voter


def test_a_missing_total_fails():
    broken = document([])
    del broken["v"]["vnt"]
    with pytest.raises(MalformedAggregate, match="vnt"):
        parse_aggregate(broken, "ac", proportional=True)


@pytest.mark.parametrize(
    ("number", "proportional", "expected"),
    [(15, True, True), (77, True, True), (95, True, False), (96, True, False),
     (1515, True, False), (15, False, False)],
)  # fmt: skip
def test_typed_a_party(number, proportional, expected):
    assert typed_a_party(number, proportional) is expected
