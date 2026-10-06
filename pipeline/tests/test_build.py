import hashlib
import json
from pathlib import Path

import duckdb
import pytest
from conftest import run_build

from eleicoes.aggregates import ANNULLED_SUB_JUDICE, PARTY_LIST, TECHNICAL_NULL
from eleicoes.download import SourceUnavailable
from eleicoes.load import CANDIDATE_ALLOWLIST, quoted
from eleicoes.sources import Bases, bulk_sources, round_config

DATA = "2026/t1"


def query(path: Path, sql: str):
    return duckdb.connect().execute(sql.replace("FILE", f"read_parquet({quoted(path)})")).fetchall()


def votes(built: Path, cargo: int, state: str) -> Path:
    return built / DATA / "votos" / f"cargo={cargo}" / f"uf={state}.parquet"


def vote_type(built, cargo, state, station, number) -> set[int]:
    municipio, zona, secao = station
    return {
        row[0]
        for row in query(
            votes(built, cargo, state),
            f"SELECT DISTINCT tipo FROM FILE WHERE municipio = {municipio} AND zona = {zona} "
            f"AND secao = {secao} AND numero = {number}",
        )
    }


def test_layout(built):
    for state in ("AC", "PE", "SE", "ZZ"):
        assert votes(built, 1, state).exists()
        assert (built / DATA / "comparecimento" / f"uf={state}.parquet").exists()
        assert (built / DATA / "secoes" / f"uf={state}.parquet").exists()
        assert (built / DATA / "resumo" / f"{state.lower()}.json").exists()
    for state in ("AC", "PE", "SE"):
        for cargo in (3, 5, 6, 7):
            assert votes(built, cargo, state).exists()
            assert (
                built / DATA / "totais" / "municipio" / f"cargo={cargo}" / f"uf={state}.parquet"
            ).exists()
            assert (
                built / DATA / "totais" / "zona" / f"cargo={cargo}" / f"uf={state}.parquet"
            ).exists()
    assert votes(built, 25, "PE").exists()
    assert (built / DATA / "resumo" / "br.json").exists()
    assert (built / DATA / "candidatos.parquet").exists()
    assert (built / "2026" / "municipios.parquet").exists()


def test_votes_take_tses_classification(built):
    assert vote_type(built, 1, "AC", (1392, 9, 228), 28) == {TECHNICAL_NULL}
    assert vote_type(built, 6, "AC", (1082, 4, 241), 1515) == {ANNULLED_SUB_JUDICE}
    assert vote_type(built, 7, "PE", (23051, 86, 21), 33) == {ANNULLED_SUB_JUDICE}
    assert vote_type(built, 6, "PE", (25313, 3, 597), 4033) == {ANNULLED_SUB_JUDICE}
    assert vote_type(built, 6, "SE", (32077, 28, 20), 77) == {TECHNICAL_NULL}
    lists = query(votes(built, 6, "AC"), f"SELECT count(*) FROM FILE WHERE tipo = {PARTY_LIST}")
    assert lists[0][0] > 0


def test_aggregated_station_points_to_its_principal_and_has_no_votes(built):
    secoes = built / DATA / "secoes" / "uf=AC.parquet"
    aggregated = query(
        secoes, "SELECT municipio, zona, secao, secao_principal FROM FILE WHERE agregada"
    )
    assert len(aggregated) == 1
    municipio, zona, secao, principal = aggregated[0]
    assert principal != secao
    station_votes = (
        f"SELECT count(*) FROM FILE WHERE municipio = {municipio} AND zona = {zona} AND secao = "
    )
    assert query(votes(built, 1, "AC"), station_votes + str(secao))[0][0] == 0
    assert query(votes(built, 1, "AC"), station_votes + str(principal))[0][0] > 0


def test_polling_places_are_for_the_first_round_only(built):
    rows = query(
        built / DATA / "secoes" / "uf=AC.parquet",
        "SELECT count(*), count(DISTINCT (municipio, zona, secao)) FROM FILE",
    )
    assert rows[0][0] == rows[0][1]


def test_council_race(built):
    municipalities = query(votes(built, 25, "PE"), "SELECT DISTINCT municipio FROM FILE")
    assert municipalities == [(30015,)]
    manifest = json.loads((built / "manifest.json").read_text())
    assert ["pe30015", 6261, 25] in manifest["verificacoes"]["agregado"]


def test_summaries(built):
    state = json.loads((built / DATA / "resumo" / "ac.json").read_text())
    races = {race["cargo"]: race for race in state["corridas"]}
    assert set(races) == {1, 3, 5, 6, 7}
    assert races[5]["escolhas_por_eleitor"] == 2
    assert races[6]["escolhas_por_eleitor"] == 1
    assert races[6]["partidos"]
    brazil = json.loads((built / DATA / "resumo" / "br.json").read_text())
    president = brazil["corridas"][0]
    assert president["nulos_tecnicos"] > 0
    assert president["validos"] == sum(
        c["votos"] for c in president["candidatos"] if c["destino"] == "Válido"
    )


def test_candidate_columns_are_the_allowlist_plus_tses_destination_and_outcome(built):
    columns = [row[0] for row in duckdb.connect().execute(
        f"DESCRIBE SELECT * FROM read_parquet({quoted(built / DATA / 'candidatos.parquet')})"
    ).fetchall()]  # fmt: skip
    assert columns == [*CANDIDATE_ALLOWLIST.values(), "destino", "resultado"]


def test_council_candidates_come_from_the_aggregate(built):
    rows = query(
        built / DATA / "candidatos.parquet",
        "SELECT count(*) FROM FILE WHERE eleicao = 6261 AND destino IS NOT NULL",
    )
    assert rows[0][0] > 0


def test_unlisted_presidential_number_has_no_destination(built):
    rows = query(
        built / DATA / "candidatos.parquet",
        "SELECT DISTINCT destino FROM FILE WHERE cargo = 1 AND numero = 28",
    )
    assert rows == [(None,)]


def test_outcome_comes_from_the_aggregate(tse, tmp_path):
    path = tse.aggregate_path("6259/dados/ac/ac-c0003-e006259-u.json")

    def rename_outcome(document):
        document["carg"][0]["agr"][0]["par"][0]["cand"][0]["st"] = "Resultado do agregado"

    tse.edit_json(path, rename_outcome)
    out = run_build(tse, tmp_path)
    outcomes = query(
        out / DATA / "candidatos.parquet",
        "SELECT resultado FROM FILE WHERE cargo = 3 AND uf = 'AC'",
    )
    assert ("Resultado do agregado",) in outcomes


def data_checksums(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*"))
        if path.is_file() and path.name != "manifest.json"
    }


def test_two_builds_give_byte_identical_data(tse, tmp_path):
    first = run_build(tse, tmp_path, "first")
    second = run_build(tse, tmp_path, "second")
    assert data_checksums(first) == data_checksums(second)


def test_manifest_lists_every_file_and_source(built):
    manifest = json.loads((built / "manifest.json").read_text())
    assert manifest["parcial"] is False
    assert manifest["estados"] == ["AC", "PE", "SE", "ZZ"]
    listed = {entry["path"]: entry for entry in manifest["arquivos"]}
    on_disk = data_checksums(built)
    assert set(listed) == set(on_disk)
    for path, checksum in on_disk.items():
        assert listed[path]["sha256"] == checksum
        assert listed[path]["size"] == (built / path).stat().st_size
    for source in manifest["fontes"]:
        assert set(source) == {"key", "url", "size", "sha512", "downloaded_at"}
    assert {"votes_president", "turnout", "candidates", "places", "munzona"} <= {
        s["key"] for s in manifest["fontes"]
    }
    assert manifest["credito"]["pt"].startswith("Fonte: Tribunal Superior Eleitoral")


def test_partial_build_is_marked_and_skips_the_national_summary(tse, tmp_path):
    out = run_build(tse, tmp_path, states=("AC",))
    manifest = json.loads((out / "manifest.json").read_text())
    assert manifest["parcial"] is True
    assert manifest["estados"] == ["AC"]
    assert not (out / DATA / "resumo" / "br.json").exists()


def test_a_missing_source_stops_the_build_with_no_output(tse, tmp_path):
    turnout = bulk_sources(round_config(1), Bases())["turnout"]
    tse.csv_path(turnout).unlink()
    with pytest.raises(SourceUnavailable, match=turnout.key):
        run_build(tse, tmp_path)
    assert not (tmp_path / "out").exists()
