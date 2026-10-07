"""Loads TSE's CSV files into DuckDB tables with the columns the dataset keeps."""

from pathlib import Path

import duckdb

from eleicoes.privacy import assert_no_personal_columns

# TSE's CSV dialect: Latin-1, `;`, text quoted. Reading every column as text and casting
# explicitly avoids DuckDB guessing a type from the first rows.
CSV_OPTIONS = "delim=';', header=true, quote='\"', encoding='latin-1', all_varchar=true"

CANDIDATE_ALLOWLIST = {
    "CD_ELEICAO": "eleicao",
    "NR_TURNO": "turno",
    "CD_CARGO": "cargo",
    "SG_UF": "uf",
    "NR_CANDIDATO": "numero",
    "NM_URNA_CANDIDATO": "nome_urna",
    "NR_PARTIDO": "partido_numero",
    "SG_PARTIDO": "partido_sigla",
    "NM_FEDERACAO": "federacao",
    "NM_COLIGACAO": "coligacao",
    "DS_SITUACAO_CANDIDATURA": "situacao",
}

RACES_WITH_VOTES = (1, 3, 5, 6, 7, 8)


class CandidateFileError(Exception):
    pass


def quoted(path: Path) -> str:
    return "'" + str(path).replace("'", "''") + "'"


NULL_MARKERS = ("#NULO#", "#NULO", "#NE#", "#NE")


def text_or_null(column: str) -> str:
    """TSE writes one of `NULL_MARKERS` where a text field has no value."""
    markers = ", ".join(f"'{marker}'" for marker in NULL_MARKERS)
    return f"CASE WHEN {column} IN ({markers}) THEN NULL ELSE {column} END"


def load_votes(con: duckdb.DuckDBPyConnection, table: str, csv: Path, round_number: int) -> None:
    con.execute(f"""
        INSERT INTO {table}
        SELECT CAST(CD_ELEICAO AS INTEGER), SG_UF, CAST(CD_CARGO AS TINYINT),
               CAST(CD_MUNICIPIO AS INTEGER), CAST(NR_ZONA AS SMALLINT),
               CAST(NR_SECAO AS SMALLINT), CAST(NR_VOTAVEL AS INTEGER),
               CAST(QT_VOTOS AS INTEGER)
        FROM read_csv({quoted(csv)}, {CSV_OPTIONS})
        WHERE CAST(NR_TURNO AS INTEGER) = {int(round_number)}
    """)


def create_votes_table(con: duckdb.DuckDBPyConnection, table: str) -> None:
    con.execute(f"""
        CREATE OR REPLACE TABLE {table} (
            eleicao INTEGER, uf VARCHAR, cargo TINYINT, municipio INTEGER,
            zona SMALLINT, secao SMALLINT, numero INTEGER, votos INTEGER)
    """)


def load_turnout(con: duckdb.DuckDBPyConnection, csv: Path, round_number: int) -> None:
    con.execute(f"""
        CREATE OR REPLACE TABLE turnout AS
        SELECT CAST(CD_ELEICAO AS INTEGER) eleicao, SG_UF uf, CAST(CD_CARGO AS TINYINT) cargo,
               CAST(CD_MUNICIPIO AS INTEGER) municipio, CAST(NR_ZONA AS SMALLINT) zona,
               CAST(NR_SECAO AS SMALLINT) secao, CAST(QT_APTOS AS INTEGER) aptos,
               CAST(QT_COMPARECIMENTO AS INTEGER) comparecimento,
               CAST(QT_ABSTENCOES AS INTEGER) abstencoes,
               CAST(QT_VOTOS_NOMINAIS AS INTEGER) nominais,
               CAST(QT_VOTOS_LEGENDA AS INTEGER) legenda,
               CAST(QT_VOTOS_BRANCOS AS INTEGER) brancos,
               CAST(QT_VOTOS_NULOS AS INTEGER) nulos,
               CAST(QT_VOTOS_ANULADOS_APU_SEP AS INTEGER) anulados_apurados_separado
        FROM read_csv({quoted(csv)}, {CSV_OPTIONS})
        WHERE CAST(NR_TURNO AS INTEGER) = {int(round_number)}
    """)


def coordinate(column: str) -> str:
    """TSE writes -1 for an unknown coordinate: every station abroad and some in Brazil."""
    value = f"TRY_CAST(replace({column}, ',', '.') AS DOUBLE)"
    return f"CASE WHEN {value} = -1 THEN NULL ELSE {value} END"


def load_places(con: duckdb.DuckDBPyConnection, csv: Path, round_number: int) -> None:
    con.execute(f"""
        CREATE OR REPLACE TABLE places AS
        SELECT SG_UF uf, CAST(CD_MUNICIPIO AS INTEGER) municipio,
               CAST(NR_ZONA AS SMALLINT) zona, CAST(NR_SECAO AS SMALLINT) secao,
               CAST(NR_LOCAL_VOTACAO AS INTEGER) local_votacao,
               CAST(CD_TIPO_SECAO_AGREGADA AS INTEGER) = 2 agregada,
               CAST(NR_SECAO_PRINCIPAL AS SMALLINT) secao_principal,
               {text_or_null("NM_LOCAL_VOTACAO")} nome_local,
               {text_or_null("DS_ENDERECO")} endereco,
               {text_or_null("NM_BAIRRO")} bairro,
               {coordinate("NR_LATITUDE")} latitude,
               {coordinate("NR_LONGITUDE")} longitude,
               CAST(QT_ELEITOR_SECAO AS INTEGER) eleitores
        FROM read_csv({quoted(csv)}, {CSV_OPTIONS})
        WHERE CAST(NR_TURNO AS INTEGER) = {int(round_number)}
    """)


def load_munzona(con: duckdb.DuckDBPyConnection, csv: Path, round_number: int) -> None:
    con.execute(f"""
        CREATE OR REPLACE TABLE munzona AS
        SELECT CAST(CD_ELEICAO AS INTEGER) eleicao, SG_UF uf, CAST(CD_CARGO AS TINYINT) cargo,
               CAST(CD_MUNICIPIO AS INTEGER) municipio, CAST(NR_ZONA AS SMALLINT) zona,
               CAST(NR_CANDIDATO AS INTEGER) numero, NM_URNA_CANDIDATO nome_urna,
               NM_TIPO_DESTINACAO_VOTOS destino,
               sum(CAST(QT_VOTOS_NOMINAIS AS INTEGER)) votos
        FROM read_csv({quoted(csv)}, {CSV_OPTIONS})
        WHERE CAST(NR_TURNO AS INTEGER) = {int(round_number)}
        GROUP BY ALL
    """)


def load_candidates(con: duckdb.DuckDBPyConnection, csv: Path, round_number: int) -> None:
    """Reads only allowlisted columns. DuckDB quotes the raw row in CSV errors, so errors are
    re-raised with the file, line and column only: CI logs are public.

    TSE lists some candidacies twice. Once projected to the allowlist the copies are
    identical, so they are kept once."""
    selected = ", ".join(
        f"{text_or_null(source)} {target}" for source, target in CANDIDATE_ALLOWLIST.items()
    )
    races = ", ".join(str(race) for race in RACES_WITH_VOTES)
    try:
        con.execute(f"""
            CREATE OR REPLACE TABLE registry AS
            SELECT DISTINCT * FROM (
                SELECT * REPLACE (
                    CAST(eleicao AS INTEGER) AS eleicao, CAST(turno AS TINYINT) AS turno,
                    CAST(cargo AS TINYINT) AS cargo, CAST(numero AS INTEGER) AS numero,
                    CAST(partido_numero AS INTEGER) AS partido_numero)
                FROM (SELECT {selected} FROM read_csv({quoted(csv)}, {CSV_OPTIONS}))
                WHERE CAST(turno AS INTEGER) = {int(round_number)}
                  AND CAST(cargo AS INTEGER) IN ({races}))
        """)
    except duckdb.Error as error:
        raise CandidateFileError(sanitized_csv_error(csv, error)) from None
    assert_no_personal_columns(
        "registry", [row[0] for row in con.execute("DESCRIBE registry").fetchall()]
    )


def sanitized_csv_error(csv: Path, error: Exception) -> str:
    """DuckDB's message quotes raw rows and does not reliably name the CSV line, so the file is
    scanned here instead. Nothing from a row reaches the message except its line number and
    the header name of the field at fault."""
    line, column = locate_csv_problem(csv)
    return f"cannot read {csv.name}: {type(error).__name__} at line {line}, column {column}"


def split_fields(raw: str) -> tuple[list[str], int | None]:
    """Splits one line on `;` outside quotes. Returns the fields and, when a quote is left
    open, the index of the field that opened it."""
    fields, current, in_quotes, opened = [], [], False, None
    for char in raw:
        if char == '"':
            if not in_quotes:
                opened = len(fields)
            in_quotes = not in_quotes
        elif char == ";" and not in_quotes:
            fields.append("".join(current))
            current = []
            continue
        current.append(char)
    fields.append("".join(current))
    return fields, opened if in_quotes else None


def locate_csv_problem(csv: Path) -> tuple[str, str]:
    with csv.open(encoding="latin-1", newline="") as handle:
        header, _ = split_fields(handle.readline().rstrip("\r\n"))
        names = [name.strip('"') for name in header]
        for number, raw in enumerate(handle, start=2):
            fields, open_field = split_fields(raw.rstrip("\r\n"))
            if open_field is not None:
                return str(number), names[min(open_field, len(names) - 1)]
            if len(fields) != len(names):
                return str(number), names[min(len(fields), len(names) - 1)]
    return "unknown", "unknown"
