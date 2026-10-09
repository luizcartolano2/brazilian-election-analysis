import csv
import re
from pathlib import Path

import duckdb
import pytest

from eleicoes.load import quoted
from eleicoes.privacy import (
    PersonalDataError,
    assert_no_personal_columns,
    is_valid_cpf,
    valid_cpfs_in,
)
from eleicoes.write import write_json, write_parquet

FIXTURES = Path(__file__).parent / "fixtures" / "data"


def test_check_digits():
    assert is_valid_cpf("12345678909")
    assert not is_valid_cpf("12345678900")
    assert not is_valid_cpf("11111111111")
    assert not is_valid_cpf("1234567890")


def test_finds_only_whole_valid_numbers():
    assert valid_cpfs_in("a;12345678909;b") == ["12345678909"]
    assert valid_cpfs_in("123456789090 12345678900") == []


def fixture_text(path: Path) -> str:
    """TSE's own sequence identifiers (`SQ_*` columns) are 11 or 12 digits, and about 1 in 100
    passes the CPF check by chance. They identify a candidacy, not a person, so they are skipped."""
    if path.suffix != ".csv":
        return path.read_bytes().decode("latin-1")
    with path.open(encoding="latin-1", newline="") as handle:
        rows = list(csv.reader(handle, delimiter=";", quotechar='"'))
    keep = [index for index, name in enumerate(rows[0]) if not name.startswith("SQ_")]
    return "\n".join(";".join(row[index] for index in keep) for row in rows)


def test_no_fixture_holds_a_real_cpf():
    for path in FIXTURES.rglob("*"):
        if path.is_file():
            found = valid_cpfs_in(fixture_text(path))
            assert found == [], f"{path} holds a number with valid CPF check digits"


# A run of 11 digits inside a hex checksum passes the CPF check about 1 time in 100.
CHECKSUM = re.compile(r"\b(?:[0-9a-f]{64}|[0-9a-f]{128})\b")


@pytest.mark.parametrize("output", ["built", "built_runoff"])
def test_no_output_holds_a_real_cpf(output, request):
    built = request.getfixturevalue(output)
    con = duckdb.connect()
    for path in built.rglob("*"):
        if path.suffix == ".parquet":
            rows = con.execute(f"SELECT * FROM read_parquet({quoted(path)})").fetchall()
            text = "\n".join(";".join(str(value) for value in row) for row in rows)
        elif path.is_file():
            text = CHECKSUM.sub("", path.read_text(encoding="utf-8"))
        else:
            continue
        assert valid_cpfs_in(text) == [], f"{path} holds a number with valid CPF check digits"


@pytest.mark.parametrize("column", ["NR_CPF_CANDIDATO", "titulo", "DS_EMAIL", "DT_NASCIMENTO"])
def test_personal_columns_are_refused(column):
    with pytest.raises(PersonalDataError):
        assert_no_personal_columns("candidatos", ["numero", column])


def test_writer_refuses_a_personal_column(tmp_path):
    con = duckdb.connect()
    with pytest.raises(PersonalDataError):
        write_parquet(con, "SELECT 1 AS numero, '000' AS nr_cpf", tmp_path / "out.parquet")
    assert not (tmp_path / "out.parquet").exists()


def test_json_writer_refuses_a_personal_key(tmp_path):
    with pytest.raises(PersonalDataError):
        write_json(tmp_path / "out.json", {"candidatos": [{"numero": 1, "cpf": "000"}]})
    assert not (tmp_path / "out.json").exists()
