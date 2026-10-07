"""Checks the dataset against TSE's own numbers. A mismatch stops the build; nothing is adjusted."""

from dataclasses import dataclass

import duckdb

from eleicoes.aggregates import (
    ANNULLED,
    ANNULLED_SUB_JUDICE,
    BLANK,
    CANDIDATE,
    NULL,
    PARTY_LIST,
    TECHNICAL_NULL,
    VOTE_TYPES,
    RaceAggregate,
)


@dataclass(frozen=True)
class Mismatch:
    level: str
    where: str
    what: str
    ours: int
    tse: int

    def __str__(self) -> str:
        return f"[{self.level}] {self.where}: {self.what} is {self.ours}, TSE says {self.tse}"


class ReconciliationFailed(Exception):
    def __init__(self, mismatches: list[Mismatch]):
        super().__init__(f"{len(mismatches)} numbers do not match TSE")
        self.mismatches = mismatches


def station_mismatches(con: duckdb.DuckDBPyConnection, state: str) -> list[Mismatch]:
    """Votes per station equal attendance times choices per voter, and each kind of vote matches
    the turnout file. `races` carries the choices per voter that TSE's aggregate implies.

    The turnout file sorts by what was typed, not by validity: a list vote for a party under
    appeal is still a party-list vote there, so `lista` decides, not `tipo`."""
    rows = con.execute(
        f"""
        WITH ours AS (
            SELECT eleicao, cargo, municipio, zona, secao,
                   sum(votos) total,
                   coalesce(sum(votos) FILTER (WHERE NOT lista AND tipo IN ({CANDIDATE},
                       {TECHNICAL_NULL}, {ANNULLED}, {ANNULLED_SUB_JUDICE})), 0) nominais,
                   coalesce(sum(votos) FILTER (WHERE lista), 0) legenda,
                   coalesce(sum(votos) FILTER (WHERE tipo = {BLANK}), 0) brancos,
                   coalesce(sum(votos) FILTER (WHERE tipo = {NULL}), 0) nulos
            FROM classified GROUP BY ALL),
        theirs AS (SELECT * FROM turnout WHERE uf = $state),
        joined AS (
            SELECT eleicao, cargo, municipio, zona, secao,
                   coalesce(ours.total, 0) votes, coalesce(theirs.comparecimento, 0) attendance,
                   coalesce(ours.nominais, 0) our_nominal, coalesce(theirs.nominais, 0) tse_nominal,
                   coalesce(ours.legenda, 0) our_list, coalesce(theirs.legenda, 0) tse_list,
                   coalesce(ours.brancos, 0) our_blank, coalesce(theirs.brancos, 0) tse_blank,
                   coalesce(ours.nulos, 0) our_null, coalesce(theirs.nulos, 0) tse_null,
                   coalesce(theirs.anulados_apurados_separado, 0) counted_apart
            FROM ours FULL OUTER JOIN theirs USING (eleicao, cargo, municipio, zona, secao))
        SELECT joined.eleicao, joined.cargo, joined.municipio, joined.zona, joined.secao,
               joined.votes, joined.attendance * races.choices,
               our_nominal, tse_nominal, our_list, tse_list, our_blank, tse_blank,
               our_null, tse_null, counted_apart
        FROM joined LEFT JOIN races ON races.eleicao = joined.eleicao
             AND races.cargo = joined.cargo
             AND (races.municipio IS NULL OR races.municipio = joined.municipio)
        ORDER BY ALL
        """,
        {"state": state},
    ).fetchall()
    mismatches = []
    for row in rows:
        eleicao, cargo, municipio, zona, secao = row[:5]
        where = f"{state} election {eleicao} race {cargo} station {municipio}/{zona}/{secao}"
        if row[6] is None:
            mismatches.append(Mismatch("station", where, "race without an aggregate", row[5], 0))
            continue
        pairs = [
            ("votes vs attendance x choices", row[5], row[6]),
            ("nominal votes", row[7], row[8]),
            ("party-list votes", row[9], row[10]),
            ("blank votes", row[11], row[12]),
            ("null votes", row[13], row[14]),
            ("votes annulled and counted apart", 0, row[15]),
        ]
        mismatches.extend(
            Mismatch("station", where, what, ours, tse) for what, ours, tse in pairs if ours != tse
        )
    return mismatches


def municipality_zone_mismatches(
    con: duckdb.DuckDBPyConnection, state: str
) -> tuple[list[Mismatch], list[tuple[int, int]]]:
    """Candidate totals per municipality and zone against TSE's munzona file, for the races
    that file covers. Returns the mismatches and the (election, race) pairs it checked."""
    covered = con.execute(
        "SELECT DISTINCT eleicao, cargo FROM munzona WHERE uf = $state ORDER BY ALL",
        {"state": state},
    ).fetchall()
    if not covered:
        return [], []
    rows = con.execute(
        f"""
        WITH covered AS (SELECT DISTINCT eleicao, cargo FROM munzona WHERE uf = $state),
        ours AS (
            SELECT eleicao, cargo, municipio, zona, numero, sum(votos) votos
            FROM classified JOIN covered USING (eleicao, cargo)
            WHERE tipo IN ({CANDIDATE}, {ANNULLED}, {ANNULLED_SUB_JUDICE}) AND NOT lista
            GROUP BY ALL),
        theirs AS (
            SELECT eleicao, cargo, municipio, zona, numero, sum(votos) votos
            FROM munzona WHERE uf = $state GROUP BY ALL)
        SELECT eleicao, cargo, municipio, zona, numero,
               coalesce(ours.votos, 0), coalesce(theirs.votos, 0)
        FROM ours FULL OUTER JOIN theirs USING (eleicao, cargo, municipio, zona, numero)
        WHERE coalesce(ours.votos, 0) != coalesce(theirs.votos, 0)
        ORDER BY ALL
        """,
        {"state": state},
    ).fetchall()
    mismatches = [
        Mismatch(
            "municipality-zone",
            f"{state} election {eleicao} race {cargo} municipality {municipio} zone {zona}",
            f"votes for {numero}",
            ours,
            tse,
        )
        for eleicao, cargo, municipio, zona, numero, ours, tse in rows
    ]
    return mismatches, [(int(eleicao), int(cargo)) for eleicao, cargo in covered]


@dataclass(frozen=True)
class RaceSums:
    """One race's sums over one area, shared by the aggregate check and the summary."""

    by_number: dict[int, int]
    by_party: dict[int, int]
    by_type: dict[int, int]
    eligible: int
    attendance: int
    abstention: int

    def total(self, vote_type: int) -> int:
        return int(self.by_type.get(vote_type, 0))


def race_sums(
    con: duckdb.DuckDBPyConnection,
    aggregate: RaceAggregate,
    votes_table: str,
    turnout_table: str,
    scope: str,
) -> RaceSums:
    """`scope` is a SQL filter, valid on both tables, that selects the aggregate's area.

    Party-list votes are summed by party number whatever their destination: a party under
    appeal keeps its list votes, classified as annulled sub judice, and TSE still counts
    them in `tval`."""
    by_number = dict(
        con.execute(
            f"SELECT numero, sum(votos) FROM {votes_table} WHERE {scope} "
            f"AND tipo != {PARTY_LIST} GROUP BY numero"
        ).fetchall()
    )
    by_party = {}
    if aggregate.parties:
        numbers = ", ".join(str(number) for number in sorted(aggregate.parties))
        by_party = dict(
            con.execute(
                f"SELECT numero, sum(votos) FROM {votes_table} WHERE {scope} "
                f"AND numero IN ({numbers}) GROUP BY numero"
            ).fetchall()
        )
    by_type = dict(
        con.execute(
            f"SELECT tipo, sum(votos) FROM {votes_table} WHERE {scope} GROUP BY tipo"
        ).fetchall()
    )
    eligible, attendance, abstention = con.execute(
        f"SELECT coalesce(sum(aptos), 0), coalesce(sum(comparecimento), 0), "
        f"coalesce(sum(abstencoes), 0) FROM {turnout_table} WHERE {scope}"
    ).fetchone()
    return RaceSums(by_number, by_party, by_type, int(eligible), int(attendance), int(abstention))


def aggregate_mismatches(aggregate: RaceAggregate, sums: RaceSums, where: str) -> list[Mismatch]:
    label = f"{where} race {aggregate.race}"
    by_number, by_party, by_type = sums.by_number, sums.by_party, sums.by_type
    attendance, eligible = sums.attendance, sums.eligible

    mismatches = []

    def compare(what: str, ours: int, tse: int) -> None:
        if ours != tse:
            mismatches.append(Mismatch("aggregate", label, what, ours, tse))

    for number, candidate in sorted(aggregate.candidates.items()):
        compare(f"votes for candidate {number}", by_number.get(number, 0), candidate.votes)
    for number, party in sorted(aggregate.parties.items()):
        compare(f"list votes for party {number}", by_party.get(number, 0), party.list_votes)
    for vote_type, tse_total in sorted(aggregate.totals.items()):
        compare(f"{VOTE_TYPES[vote_type]} votes", by_type.get(vote_type, 0), tse_total)
    compare(
        "valid votes",
        by_type.get(CANDIDATE, 0) + by_type.get(PARTY_LIST, 0),
        aggregate.valid_votes,
    )
    compare("attendance", attendance, aggregate.attendance)
    compare("eligible voters", eligible, aggregate.eligible)
    return mismatches
