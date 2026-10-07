import duckdb
import pytest

from eleicoes.load import CANDIDATE_ALLOWLIST, CandidateFileError, load_candidates

HEADER = [*CANDIDATE_ALLOWLIST, "NR_CPF_CANDIDATO", "DT_NASCIMENTO"]
SECRET_CPF = "98765432100"
SECRET_BIRTH = "31/12/1999"


def write_candidates(path, rows: list[str]) -> None:
    lines = [";".join(f'"{name}"' for name in HEADER), *rows]
    path.write_bytes(("\n".join(lines) + "\n").encode("latin-1"))


def good_row(number: int, status: str = "APTO") -> str:
    values = ["6259", "1", "6", "AC", str(number), "NOME", "15", "P15", "#NULO#", "#NE#",
              status, SECRET_CPF, SECRET_BIRTH]  # fmt: skip
    return ";".join(f'"{value}"' for value in values)


def test_keeps_only_the_allowlist(tmp_path):
    csv = tmp_path / "consulta_cand.csv"
    write_candidates(csv, [good_row(1501)])
    con = duckdb.connect()
    load_candidates(con, csv, round_number=1)
    columns = [row[0] for row in con.execute("DESCRIBE registry").fetchall()]
    assert columns == list(CANDIDATE_ALLOWLIST.values())
    assert con.execute("SELECT federacao, coligacao FROM registry").fetchall() == [(None, None)]


def test_a_parse_error_names_the_place_but_not_the_values(tmp_path):
    csv = tmp_path / "consulta_cand.csv"
    broken = good_row(1502).replace(f'"{SECRET_BIRTH}"', f'"{SECRET_BIRTH}')
    write_candidates(csv, [good_row(1501), broken])
    with pytest.raises(CandidateFileError) as caught:
        load_candidates(duckdb.connect(), csv, round_number=1)
    message = str(caught.value)
    assert "consulta_cand.csv" in message
    assert "line 3, column DT_NASCIMENTO" in message
    assert SECRET_CPF not in message and SECRET_BIRTH not in message
    assert caught.value.__cause__ is None


def test_a_row_with_a_missing_field_names_its_column(tmp_path):
    csv = tmp_path / "consulta_cand.csv"
    short = good_row(1502).rsplit(";", 1)[0]
    write_candidates(csv, [good_row(1501), good_row(1503), short])
    with pytest.raises(CandidateFileError, match="line 4, column DT_NASCIMENTO"):
        load_candidates(duckdb.connect(), csv, round_number=1)


@pytest.mark.parametrize("marker", ["#NE", "#NE#", "#NULO", "#NULO#"])
def test_tse_null_markers_become_null(tmp_path, marker):
    csv = tmp_path / "consulta_cand.csv"
    write_candidates(csv, [good_row(1501, status=marker)])
    con = duckdb.connect()
    load_candidates(con, csv, round_number=1)
    assert con.execute("SELECT situacao FROM registry").fetchall() == [(None,)]


def test_a_candidacy_listed_twice_is_kept_once(tmp_path):
    csv = tmp_path / "consulta_cand.csv"
    write_candidates(csv, [good_row(1501), good_row(1501)])
    con = duckdb.connect()
    load_candidates(con, csv, round_number=1)
    assert con.execute("SELECT count(*) FROM registry").fetchone() == (1,)
