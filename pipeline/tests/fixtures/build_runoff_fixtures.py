"""Adds a synthetic round 2 to the fixtures, in the same files as round 1, as TSE ships it.
Each finalist keeps its round-1 votes at each station and every other vote becomes a null
vote, so the numbers copy round 1 mechanically and never forecast the runoff."""

import json
import shutil
from collections import defaultdict
from pathlib import Path

from build_fixtures import OUT, cdn_path, read_rows, results_path, write_rows
from published import FIXTURE_STATES

from eleicoes.aggregates import BLANK_NUMBER, NULL_NUMBER
from eleicoes.sources import (
    ABROAD,
    Bases,
    aggregate_source,
    bulk_sources,
    municipality_list_source,
    round_config,
    state_votes_source,
)
from eleicoes.write import write_json

FIRST = round_config(1)
SECOND = round_config(2)
REAL = Bases()
PRESIDENT = 1
VICE_PRESIDENT = 2
GOVERNOR = 3
# Acre is the one fixture state whose Governor race TSE sent to a runoff.
RUNOFF_STATE = "AC"
RUNOFF = "2º turno"
FIRST_DATE = "04/10/2026"
SECOND_DATE = "25/10/2026"
OUTCOMES = {True: ("Eleito", "1", "ELEITO"), False: ("Não eleito", "4", "NÃO ELEITO")}

Station = tuple[str, int, int, int]


class Table:
    """One fixture CSV, without its round-2 rows, so that a rerun gives the same files."""

    def __init__(self, path: Path):
        self.path = path
        rows = read_rows(path)
        self.header = next(rows)
        self.index = {name: position for position, name in enumerate(self.header)}
        self.rows = [row for row in rows if self.get(row, "NR_TURNO") != "2"]
        self.added: list[list[str]] = []

    def get(self, row: list[str], column: str) -> str:
        return row[self.index[column]]

    def station(self, row: list[str]) -> Station:
        return (
            self.get(row, "SG_UF"),
            int(self.get(row, "CD_MUNICIPIO")),
            int(self.get(row, "NR_ZONA")),
            int(self.get(row, "NR_SECAO")),
        )

    def second_round(self, row: list[str], election: int, **changes: str) -> list[str]:
        copy = [
            value.replace(FIRST_DATE, SECOND_DATE) if name.startswith("DT_") else value
            for name, value in zip(self.header, row, strict=True)
        ]
        for column, value in {"NR_TURNO": "2", "CD_ELEICAO": str(election), **changes}.items():
            copy[self.index[column]] = value
        return copy

    def save(self) -> None:
        write_rows(self.path, self.header, self.rows + self.added)


def csv_of(source) -> Path:
    return cdn_path(source.url).with_name(source.member)


def aggregate_path(config, election: int, race: int, area: str) -> Path:
    return results_path(aggregate_source(config, REAL, election, race, area, area).url)


def in_area(station: Station, area: str) -> bool:
    return area == "br" or station[0] == area.upper()


def finalists(race: int, area: str, election: int) -> list[int]:
    document = json.loads(aggregate_path(FIRST, election, race, area).read_text(encoding="utf-8"))
    numbers = [
        int(candidate["n"])
        for group in document["carg"][0]["agr"]
        for party in group["par"]
        for candidate in party["cand"]
        if candidate["st"] == RUNOFF
    ]
    if len(numbers) != 2:
        raise SystemExit(f"round 1 sends {len(numbers)} candidates to the {area} runoff")
    return numbers


def runoff_votes(first_round: dict[int, int], numbers: list[int]) -> dict[int, int]:
    kept = {number: first_round.get(number, 0) for number in numbers}
    blank = first_round.get(BLANK_NUMBER, 0)
    null = sum(first_round.values()) - sum(kept.values()) - blank
    votes = {**kept, BLANK_NUMBER: blank, NULL_NUMBER: null}
    return {number: count for number, count in votes.items() if count}


def add_votes(
    table: Table, race: int, numbers: list[int], election: int
) -> dict[Station, dict[int, int]]:
    """Adds each station's round-2 rows, and returns the round-2 votes by station."""
    first_round: dict[Station, dict[int, int]] = defaultdict(dict)
    templates: dict[Station, list[str]] = {}
    names: dict[int, tuple[str, str]] = {}
    for row in table.rows:
        if int(table.get(row, "CD_CARGO")) != race:
            continue
        station, number = table.station(row), int(table.get(row, "NR_VOTAVEL"))
        first_round[station][number] = int(table.get(row, "QT_VOTOS"))
        templates.setdefault(station, row)
        names[number] = (table.get(row, "NM_VOTAVEL"), table.get(row, "SQ_CANDIDATO"))
    names.setdefault(NULL_NUMBER, ("VOTO NULO", "-1"))
    second_round = {}
    for station in sorted(first_round):
        second_round[station] = runoff_votes(first_round[station], numbers)
        for number, count in sorted(second_round[station].items()):
            name, sequence = names[number]
            table.added.append(
                table.second_round(
                    templates[station], election, NR_VOTAVEL=str(number), NM_VOTAVEL=name,
                    QT_VOTOS=str(count), SQ_CANDIDATO=sequence,
                )
            )  # fmt: skip
    return second_round


def add_turnout(
    table: Table, race: int, area: str, election: int, votes: dict[Station, dict[int, int]]
) -> dict[Station, tuple[int, int]]:
    """Adds the round-2 turnout of each station, and returns its eligible voters and
    attendance."""
    first = FIRST.president if race == PRESIDENT else FIRST.state
    turnout = {}
    for row in table.rows:
        station = table.station(row)
        if (
            int(table.get(row, "CD_ELEICAO")) != first
            or int(table.get(row, "CD_CARGO")) != race
            or not in_area(station, area)
        ):
            continue
        if station not in votes and int(table.get(row, "QT_COMPARECIMENTO")):
            raise SystemExit(f"station {station} has attendance but no votes")
        counted = votes.get(station, {})
        blank, null = counted.get(BLANK_NUMBER, 0), counted.get(NULL_NUMBER, 0)
        table.added.append(
            table.second_round(
                row, election,
                QT_VOTOS_NOMINAIS=str(sum(counted.values()) - blank - null),
                QT_VOTOS_BRANCOS=str(blank), QT_VOTOS_NULOS=str(null), QT_VOTOS_LEGENDA="0",
                QT_VOTOS_ANULADOS_APU_SEP="0",
            )
        )  # fmt: skip
        turnout[station] = (
            int(table.get(row, "QT_APTOS")),
            int(table.get(row, "QT_COMPARECIMENTO")),
        )
    return turnout


def add_munzona(table: Table, numbers: list[int], votes: dict[Station, dict[int, int]]) -> None:
    templates = {
        int(table.get(row, "NR_CANDIDATO")): row
        for row in table.rows
        if table.get(row, "SG_UF") == RUNOFF_STATE and int(table.get(row, "CD_CARGO")) == GOVERNOR
    }
    by_zone: dict[tuple[int, int, int], int] = defaultdict(int)
    for (_, municipio, zona, _), counted in votes.items():
        for number in numbers:
            by_zone[(municipio, zona, number)] += counted.get(number, 0)
    for (municipio, zona, number), count in sorted(by_zone.items()):
        if count:
            table.added.append(
                table.second_round(
                    templates[number], SECOND.state, CD_MUNICIPIO=str(municipio),
                    NR_ZONA=str(zona), QT_VOTOS_NOMINAIS=str(count),
                )
            )  # fmt: skip


def add_candidates(table: Table, races: dict[tuple[str, int], tuple[int, list[int], int]]) -> None:
    """`races` maps (area, race) to the round-2 election, the finalists and the winner."""
    for row in table.rows:
        area, race = table.get(row, "SG_UF"), int(table.get(row, "CD_CARGO"))
        key = (area, PRESIDENT if race == VICE_PRESIDENT else race)
        number = int(table.get(row, "NR_CANDIDATO"))
        if key in races and number in races[key][1]:
            election, _, winner = races[key]
            _, code, label = OUTCOMES[number == winner]
            table.added.append(
                table.second_round(row, election, CD_SIT_TOT_TURNO=code, DS_SIT_TOT_TURNO=label)
            )


def write_aggregate(
    race: int, area: str, election: int, numbers: list[int], winner: int,
    votes: dict[Station, dict[int, int]], turnout: dict[Station, tuple[int, int]],
) -> None:  # fmt: skip
    first = FIRST.president if race == PRESIDENT else FIRST.state
    document = json.loads(aggregate_path(FIRST, first, race, area).read_text(encoding="utf-8"))
    totals: dict[int, int] = defaultdict(int)
    for station, counted in votes.items():
        if in_area(station, area):
            for number, count in counted.items():
                totals[number] += count
    parties = []
    for group in document["carg"][0]["agr"]:
        for party in group["par"]:
            for candidate in party["cand"]:
                number = int(candidate["n"])
                if number in numbers:
                    candidate.update(vap=str(totals[number]), st=OUTCOMES[number == winner][0])
                    parties.append({**party, "cand": [candidate]})
    if len(parties) != 2:
        raise SystemExit(f"the round-1 {area} aggregate of race {race} lacks a finalist")
    valid = sum(totals[number] for number in numbers)
    blank, null = totals[BLANK_NUMBER], totals[NULL_NUMBER]
    stations = [counts for station, counts in turnout.items() if in_area(station, area)]
    document["ele"] = str(election)
    document["carg"][0]["agr"] = [{"par": parties}]
    document["v"] = {
        "tv": str(valid + blank + null), "van": "0", "vansj": "0", "vb": str(blank),
        "vl": "0", "vn": str(null), "vnom": str(valid), "vnt": "0", "vv": str(valid),
    }  # fmt: skip
    document["e"] = {
        "c": str(sum(attendance for _, attendance in stations)),
        "te": str(sum(eligible for eligible, _ in stations)),
    }
    write_json(aggregate_path(SECOND, election, race, area), document)


def winner_of(numbers: list[int], votes: dict[Station, dict[int, int]], area: str) -> int:
    totals = {
        number: sum(
            counted.get(number, 0) for station, counted in votes.items() if in_area(station, area)
        )
        for number in numbers
    }
    first, second = sorted(totals.values(), reverse=True)
    if first == second:
        raise SystemExit(f"the synthetic {area} runoff is a tie")
    return max(totals, key=totals.__getitem__)


def main() -> None:
    sources = bulk_sources(SECOND, REAL)
    for election in (SECOND.president, SECOND.state):
        shutil.rmtree(OUT / "results" / SECOND.cycle / str(election), ignore_errors=True)

    president = finalists(PRESIDENT, "br", FIRST.president)
    governor = finalists(GOVERNOR, RUNOFF_STATE.lower(), FIRST.state)

    president_table = Table(csv_of(sources["votes_president"]))
    president_votes = add_votes(president_table, PRESIDENT, president, SECOND.president)
    state_table = Table(csv_of(state_votes_source(SECOND, REAL, RUNOFF_STATE)))
    governor_votes = add_votes(state_table, GOVERNOR, governor, SECOND.state)

    turnout_table = Table(csv_of(sources["turnout"]))
    president_turnout = add_turnout(
        turnout_table, PRESIDENT, "br", SECOND.president, president_votes
    )
    governor_turnout = add_turnout(
        turnout_table, GOVERNOR, RUNOFF_STATE.lower(), SECOND.state, governor_votes
    )

    munzona_table = Table(csv_of(sources["munzona"]))
    add_munzona(munzona_table, governor, governor_votes)

    president_winner = winner_of(president, president_votes, "br")
    governor_winner = winner_of(governor, governor_votes, RUNOFF_STATE.lower())
    candidates_table = Table(csv_of(sources["candidates"]))
    add_candidates(
        candidates_table,
        {
            ("BR", PRESIDENT): (SECOND.president, president, president_winner),
            (RUNOFF_STATE, GOVERNOR): (SECOND.state, governor, governor_winner),
        },
    )

    for table in (president_table, state_table, turnout_table, munzona_table, candidates_table):
        table.save()

    for area in ["br", *(state.lower() for state in FIXTURE_STATES), ABROAD.lower()]:
        write_aggregate(
            PRESIDENT, area, SECOND.president, president, president_winner,
            president_votes, president_turnout,
        )  # fmt: skip
    write_aggregate(
        GOVERNOR, RUNOFF_STATE.lower(), SECOND.state, governor, governor_winner,
        governor_votes, governor_turnout,
    )  # fmt: skip
    municipalities = municipality_list_source(FIRST, REAL, FIRST.president)
    write_json(
        results_path(municipality_list_source(SECOND, REAL, SECOND.president).url),
        json.loads(results_path(municipalities.url).read_text(encoding="utf-8")),
    )
    print(f"round-2 fixtures added to {OUT}")


if __name__ == "__main__":
    main()
