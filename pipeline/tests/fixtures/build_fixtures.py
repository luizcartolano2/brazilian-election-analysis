"""Cuts a small copy of TSE's files from the download cache, one station per case the pipeline
must handle, with TSE's totals recomputed for those stations and no real personal data."""

import csv
import io
import shutil
import tempfile
from collections import defaultdict
from pathlib import Path

import duckdb

from eleicoes.aggregates import (
    BLANK,
    CANDIDATE,
    NULL,
    PARTY_LIST,
    TECHNICAL_NULL,
    TOTAL_KEYS,
    parse_aggregate,
    unlisted_vote_types,
)
from eleicoes.download import Downloader
from eleicoes.load import (
    create_votes_table,
    load_munzona,
    load_places,
    load_turnout,
    load_votes,
)
from eleicoes.sources import (
    PROPORTIONAL_RACES,
    Bases,
    aggregate_source,
    bulk_sources,
    municipality_list_source,
    round_config,
    state_votes_source,
)
from eleicoes.write import write_json

HERE = Path(__file__).parent
OUT = HERE / "data"
CACHE = HERE.parents[1] / "data" / "cache"
CONFIG = round_config(1)
REAL = Bases()
FIXTURE_STATES = ("AC", "PE", "SE")
NORONHA = 30015
# The pipeline never reads these, and the fixtures are public, so they are blanked. Race is
# sensitive data under the LGPD even though TSE publishes it.
BLANKED_ATTRIBUTES = (
    "CD_GENERO", "DS_GENERO", "CD_COR_RACA", "DS_COR_RACA", "CD_ESTADO_CIVIL",
    "DS_ESTADO_CIVIL", "CD_GRAU_INSTRUCAO", "DS_GRAU_INSTRUCAO", "CD_OCUPACAO",
    "DS_OCUPACAO", "SG_UF_NASCIMENTO",
)  # fmt: skip

# Each query returns station keys (uf, municipio, zona, secao) for one case to cover.
CASES = {
    "president votes for an unlisted number (technical null)": """
        SELECT uf, municipio, zona, secao FROM president WHERE uf = 'AC' AND numero = 28
        ORDER BY votos DESC, uf, municipio, zona, secao LIMIT 1""",
    "deputy candidate under appeal": """
        SELECT uf, municipio, zona, secao FROM state WHERE uf = 'AC' AND cargo = 6
        AND numero = 1515 ORDER BY votos DESC, uf, municipio, zona, secao LIMIT 1""",
    "deputy technical nulls": """
        SELECT uf, municipio, zona, secao FROM state WHERE uf = 'AC' AND cargo = 6
        AND numero IN (4000, 4022, 4033) ORDER BY votos DESC, uf, municipio, zona, secao LIMIT 1""",
    "principal of an aggregated station": """
        SELECT uf, municipio, zona, secao_principal FROM places WHERE uf = 'AC' AND agregada
        ORDER BY ALL LIMIT 1""",
    "council of Fernando de Noronha": f"""
        SELECT DISTINCT uf, municipio, zona, secao FROM state WHERE municipio = {NORONHA}""",
    "party list under appeal": """
        SELECT uf, municipio, zona, secao FROM state WHERE uf = 'PE' AND cargo = 7
        AND numero = 33 ORDER BY votos DESC, uf, municipio, zona, secao LIMIT 1""",
    "unlisted candidate under appeal": """
        SELECT uf, municipio, zona, secao FROM state WHERE uf = 'PE' AND cargo = 6
        AND numero = 4033 ORDER BY votos DESC, uf, municipio, zona, secao LIMIT 1""",
    "list vote for a party with no list in the state": """
        SELECT uf, municipio, zona, secao FROM state WHERE uf = 'SE' AND cargo = 6
        AND numero = 77 ORDER BY votos DESC, uf, municipio, zona, secao LIMIT 1""",
    "votes cast abroad": """
        SELECT uf, municipio, zona, secao FROM president WHERE uf = 'ZZ' ORDER BY ALL LIMIT 1""",
}
AGGREGATED_STATION = """
    SELECT uf, municipio, zona, secao FROM places WHERE uf = 'AC' AND agregada
    ORDER BY ALL LIMIT 1"""


def synthetic_cpf(index: int) -> str:
    """Eleven digits with a deliberately wrong second check digit."""
    base = f"{index:09d}"
    first = (sum(int(d) * w for d, w in zip(base, range(10, 1, -1), strict=True)) * 10) % 11 % 10
    second = (
        (sum(int(d) * w for d, w in zip(base + str(first), range(11, 1, -1), strict=True)) * 10)
        % 11
        % 10
    )
    return f"{base}{first}{(second + 1) % 10}"


def read_rows(path: Path):
    with path.open(encoding="latin-1", newline="") as handle:
        yield from csv.reader(handle, delimiter=";", quotechar='"')


def write_rows(path: Path, header: list[str], rows: list[list[str]]) -> None:
    """Writes TSE's dialect: Latin-1, `;`, every field quoted."""
    path.parent.mkdir(parents=True, exist_ok=True)
    buffer = io.StringIO()
    writer = csv.writer(
        buffer, delimiter=";", quotechar='"', quoting=csv.QUOTE_ALL, lineterminator="\n"
    )
    writer.writerow(header)
    writer.writerows(rows)
    path.write_bytes(buffer.getvalue().encode("latin-1"))


def filter_csv(source: Path, target: Path, keep) -> None:
    rows = read_rows(source)
    header = next(rows)
    index = {name: position for position, name in enumerate(header)}
    write_rows(target, header, [row for row in rows if keep(row, index)])


def station_of(row: list[str], index: dict[str, int]) -> tuple[str, int, int, int]:
    return (
        row[index["SG_UF"]],
        int(row[index["CD_MUNICIPIO"]]),
        int(row[index["NR_ZONA"]]),
        int(row[index["NR_SECAO"]]),
    )


def cdn_path(url: str) -> Path:
    return OUT / "cdn" / url.removeprefix(REAL.cdn + "/")


def results_path(url: str) -> Path:
    return OUT / "results" / url.removeprefix(REAL.results + "/")


def main() -> None:
    downloader = Downloader(CACHE)
    scratch = Path(tempfile.mkdtemp())
    sources = bulk_sources(CONFIG, REAL)
    con = duckdb.connect()
    extracted = {key: downloader.extract(source, scratch) for key, source in sources.items()}
    state_csvs = {
        state: downloader.extract(state_votes_source(CONFIG, REAL, state), scratch)
        for state in FIXTURE_STATES
    }

    create_votes_table(con, "president")
    load_votes(con, "president", extracted["votes_president"], CONFIG.round)
    create_votes_table(con, "state")
    for csv_path in state_csvs.values():
        load_votes(con, "state", csv_path, CONFIG.round)
    load_places(con, extracted["places"], CONFIG.round)
    load_munzona(con, extracted["munzona"], CONFIG.round)

    stations: set[tuple] = set()
    for case, query in CASES.items():
        found = {tuple(row) for row in con.execute(query).fetchall()}
        if not found:
            raise SystemExit(f"no station covers: {case}")
        print(f"{case}: {sorted(found)}")
        stations |= found
    aggregated = {tuple(row) for row in con.execute(AGGREGATED_STATION).fetchall()}
    with_aggregated = stations | aggregated

    shutil.rmtree(OUT, ignore_errors=True)
    in_stations = lambda row, index: station_of(row, index) in stations  # noqa: E731
    filter_csv(
        extracted["votes_president"],
        cdn_path(sources["votes_president"].url).with_name(sources["votes_president"].member),
        in_stations,
    )
    for state, csv_path in state_csvs.items():
        source = state_votes_source(CONFIG, REAL, state)
        filter_csv(csv_path, cdn_path(source.url).with_name(source.member), in_stations)
    filter_csv(
        extracted["turnout"],
        cdn_path(sources["turnout"].url).with_name(sources["turnout"].member),
        in_stations,
    )
    filter_csv(
        extracted["places"],
        cdn_path(sources["places"].url).with_name(sources["places"].member),
        lambda row, index: station_of(row, index) in with_aggregated,
    )

    write_candidates(con, extracted["candidates"], sources["candidates"], stations)
    write_municipality_lists(downloader, stations)
    write_totals(con, downloader, stations, sources["munzona"])
    shutil.rmtree(scratch)
    print(f"fixtures written to {OUT}")


def write_candidates(con, csv_path: Path, source, stations: set[tuple]) -> None:
    station_table(con, stations)
    numbers = {
        (row[0], int(row[1]), int(row[2]))
        for row in con.execute("""
            SELECT uf, cargo, numero FROM state JOIN chosen USING (uf, municipio, zona, secao)
            UNION SELECT 'BR', cargo, numero FROM president
            JOIN chosen USING (uf, municipio, zona, secao)
        """).fetchall()
    }
    rows = read_rows(csv_path)
    header = next(rows)
    index = {name: position for position, name in enumerate(header)}
    kept = []
    for row in rows:
        key = (row[index["SG_UF"]], int(row[index["CD_CARGO"]]), int(row[index["NR_CANDIDATO"]]))
        if key in numbers or (key[0] == "BR" and key[1] == 2):
            kept.append(row)
    for position, row in enumerate(kept):
        row[index["NR_CPF_CANDIDATO"]] = synthetic_cpf(position + 1)
        row[index["NR_TITULO_ELEITORAL_CANDIDATO"]] = f"9{position + 1:011d}"
        row[index["DT_NASCIMENTO"]] = "01/01/1900"
        row[index["DS_EMAIL"]] = "NÃO DIVULGÁVEL"
        for column in BLANKED_ATTRIBUTES:
            row[index[column]] = "#NULO"
    write_rows(cdn_path(source.url).with_name(source.member), header, kept)


def station_table(con, stations: set[tuple]) -> None:
    con.execute(
        "CREATE OR REPLACE TABLE chosen "
        "(uf VARCHAR, municipio INTEGER, zona SMALLINT, secao SMALLINT)"
    )
    con.executemany("INSERT INTO chosen VALUES (?, ?, ?, ?)", sorted(stations))


def write_municipality_lists(downloader: Downloader, stations: set[tuple]) -> None:
    used = defaultdict(set)
    for uf, municipio, _, _ in stations:
        used[uf.lower()].add(f"{municipio:05d}")
    for election in [CONFIG.president, *(e.code for e in CONFIG.municipal)]:
        source = municipality_list_source(CONFIG, REAL, election)
        document = downloader.json(source)
        document["abr"] = [
            {**state, "mu": [m for m in state["mu"] if m["cd"] in used[state["cd"]]]}
            for state in document["abr"]
            if state["cd"] in used
        ]
        write_json(results_path(source.url), document)


def write_totals(con, downloader: Downloader, stations: set[tuple], munzona_source) -> None:
    """Recomputes TSE's aggregates and munzona totals for the chosen stations, keeping TSE's
    classification of every number."""
    station_table(con, stations)
    turnout_csv = cdn_path(bulk_sources(CONFIG, REAL)["turnout"].url).with_name(
        bulk_sources(CONFIG, REAL)["turnout"].member
    )
    load_turnout(con, turnout_csv, CONFIG.round)
    con.execute("""
        CREATE OR REPLACE TABLE chosen_votes AS
        SELECT v.* FROM state v JOIN chosen USING (uf, municipio, zona, secao)
        UNION ALL SELECT v.* FROM president v JOIN chosen USING (uf, municipio, zona, secao)
    """)

    areas = [(CONFIG.president, 1, "br", "br", "TRUE")]
    for uf in [*FIXTURE_STATES, "ZZ"]:
        areas.append((CONFIG.president, 1, uf.lower(), uf.lower(), f"uf = '{uf}'"))
    for uf in FIXTURE_STATES:
        for (cargo,) in con.execute(
            f"SELECT DISTINCT cargo FROM chosen_votes WHERE eleicao = {CONFIG.state} "
            f"AND uf = '{uf}' ORDER BY cargo"
        ).fetchall():
            areas.append((CONFIG.state, cargo, uf.lower(), uf.lower(), f"uf = '{uf}'"))
    for election in CONFIG.municipal:
        area = f"{election.state.lower()}{election.municipality:05d}"
        areas.append(
            (election.code, election.race, election.state.lower(), area,
             f"uf = '{election.state}' AND municipio = {election.municipality}")
        )  # fmt: skip

    real_munzona = {
        (election, cargo, uf, number): (name, destination)
        for election, cargo, uf, number, name, destination in con.execute(
            "SELECT DISTINCT eleicao, cargo, uf, numero, nome_urna, destino FROM munzona"
        ).fetchall()
    }
    munzona_rows = []
    for election, cargo, state, area, scope in areas:
        source = aggregate_source(CONFIG, REAL, election, cargo, state, area)
        document = downloader.json(source)
        proportional = cargo in PROPORTIONAL_RACES
        real = parse_aggregate(document, area, proportional)
        unlisted = unlisted_vote_types(
            con.execute(
                f"SELECT DISTINCT numero, destino FROM munzona WHERE eleicao = {election} "
                f"AND cargo = {cargo} AND uf = '{area[:2].upper()}' ORDER BY ALL"
            ).fetchall(),
            area,
        ) if election == CONFIG.state else {}  # fmt: skip
        scope_sql = f"eleicao = {election} AND cargo = {cargo} AND {scope}"
        votes = con.execute(
            f"SELECT uf, municipio, zona, numero, sum(votos) FROM chosen_votes "
            f"WHERE {scope_sql} GROUP BY ALL ORDER BY ALL"
        ).fetchall()
        by_number: dict[int, int] = defaultdict(int)
        by_type: dict[int, int] = defaultdict(int)
        for uf, municipio, zona, number, count in votes:
            vote_type = real.vote_type(number, proportional, unlisted)
            by_number[number] += count
            by_type[vote_type] += count
            listed = proportional and number in real.parties
            if election == CONFIG.state and not listed and vote_type not in (
                BLANK, NULL, TECHNICAL_NULL, PARTY_LIST
            ):  # fmt: skip
                name, destination = real_munzona[(election, cargo, uf, number)]
                munzona_rows.append(
                    (election, uf, municipio, zona, cargo, number, name, destination, count)
                )
        attendance, eligible = con.execute(
            f"SELECT sum(comparecimento), sum(aptos) FROM turnout WHERE {scope_sql}"
        ).fetchone()
        write_json(
            results_path(source.url),
            aggregate_document(document, real, by_number, by_type, attendance, eligible),
        )
    write_munzona(munzona_rows, munzona_source)


def aggregate_document(document, real, by_number, by_type, attendance, eligible) -> dict:
    race = document["carg"][0]
    groups = []
    for group in race.get("agr", []):
        parties = []
        for party in group.get("par", []):
            number = int(party["n"])
            candidates = [
                {key: candidate[key] for key in ("n", "nmu", "dvt", "st")}
                | {"vap": str(by_number.get(int(candidate["n"]), 0))}
                for candidate in party.get("cand", [])
                if int(candidate["n"]) in by_number
            ]
            if not candidates and number not in by_number:
                continue
            entry = {key: party[key] for key in ("n", "sg", "dvt") if key in party}
            entry["tval"] = str(by_number.get(number, 0)) if number in real.parties else "0"
            entry["cand"] = candidates
            parties.append(entry)
        if parties:
            groups.append({"par": parties})
    totals = {key: str(by_type.get(vote_type, 0)) for vote_type, key in TOTAL_KEYS.items()}
    valid = by_type.get(CANDIDATE, 0) + by_type.get(PARTY_LIST, 0)
    return {
        "ele": document["ele"],
        "carg": [{"cd": race["cd"], "nmn": race["nmn"], "nv": race["nv"], "agr": groups}],
        "v": totals | {"tv": str(sum(by_type.values())), "vv": str(valid)},
        "e": {"c": str(attendance or 0), "te": str(eligible or 0)},
    }


def write_munzona(rows: list[tuple], source) -> None:
    header = [
        "CD_ELEICAO", "NR_TURNO", "SG_UF", "CD_MUNICIPIO", "NR_ZONA", "CD_CARGO",
        "NR_CANDIDATO", "NM_URNA_CANDIDATO", "NM_TIPO_DESTINACAO_VOTOS", "QT_VOTOS_NOMINAIS",
    ]  # fmt: skip
    body = []
    for election, uf, municipio, zona, cargo, number, name, destination, votes in sorted(rows):
        body.append(
            [str(election), "1", uf, str(municipio), str(zona), str(cargo), str(number),
             name, destination, str(votes)]
        )  # fmt: skip
    write_rows(cdn_path(source.url).with_name(source.member), header, body)


if __name__ == "__main__":
    main()
