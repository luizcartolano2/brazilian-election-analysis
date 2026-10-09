import json
from pathlib import Path

import pytest
from conftest import run_build
from test_build import query

from eleicoes.reconcile import ReconciliationFailed
from eleicoes.sources import Bases, aggregate_source, bulk_sources, round_config

DATA = "2026/t2"
PRESIDENT_FINALISTS = {13, 22}
GOVERNOR_FINALISTS = {10, 11}


def summary(built: Path, area: str) -> dict:
    return json.loads((built / DATA / "resumo" / f"{area}.json").read_text())


def races(built: Path, area: str) -> dict[int, dict]:
    return {race["cargo"]: race for race in summary(built, area)["corridas"]}


def test_a_state_without_a_governor_runoff_gets_president_only(built_runoff):
    for area in ("pe", "se", "zz"):
        assert set(races(built_runoff, area)) == {1}
    assert not (built_runoff / DATA / "votos" / "cargo=3" / "uf=PE.parquet").exists()


def test_the_runoff_state_gets_both_races(built_runoff):
    acre = races(built_runoff, "ac")
    assert {cargo: race["eleicao"] for cargo, race in acre.items()} == {1: 6258, 3: 6260}
    assert {c["numero"] for c in acre[3]["candidatos"]} == GOVERNOR_FINALISTS
    assert {c["numero"] for c in acre[1]["candidatos"]} == PRESIDENT_FINALISTS


def test_the_version_holds_round_two_only(built_runoff):
    manifest = json.loads((built_runoff / "manifest.json").read_text())
    assert manifest["turno"] == 2
    assert manifest["estados"] == ["AC", "PE", "SE", "ZZ"]
    assert summary(built_runoff, "br")["turno"] == 2
    assert not (built_runoff / "2026" / "t1").exists()
    assert ["br", 6258, 1] in manifest["verificacoes"]["agregado"]
    assert ["ac", 6260, 3] in manifest["verificacoes"]["agregado"]
    assert manifest["verificacoes"]["municipio_zona"] == [["AC", 6260, 3]]


def test_round_two_reconciles_with_tses_totals(built_runoff):
    president = races(built_runoff, "br")[1]
    assert president["validos"] == sum(c["votos"] for c in president["candidatos"])
    assert president["comparecimento"] == (
        president["validos"] + president["brancos"] + president["nulos"]
    )
    outcomes = sorted(c["resultado"] for c in president["candidatos"])
    assert outcomes == ["Eleito", "Não eleito"]


def test_the_candidates_are_the_finalists_of_round_two(built_runoff):
    rows = query(
        built_runoff / DATA / "candidatos.parquet",
        "SELECT DISTINCT turno, eleicao, cargo, uf, numero FROM FILE WHERE destino IS NOT NULL "
        "ORDER BY ALL",
    )
    assert {row[0] for row in rows} == {2}
    assert {(row[1], row[2], row[3], row[4]) for row in rows} == {
        *((6258, 1, "BR", number) for number in PRESIDENT_FINALISTS),
        *((6260, 3, "AC", number) for number in GOVERNOR_FINALISTS),
    }


def test_a_round_two_station_row_changed_by_one_vote_fails_the_build(tse, tmp_path):
    votes = tse.csv_path(bulk_sources(round_config(2), Bases())["votes_president"])
    done = []

    def add_one(row):
        if not done and row["NR_TURNO"] == "2" and row["NR_VOTAVEL"] == "13":
            row["QT_VOTOS"] = str(int(row["QT_VOTOS"]) + 1)
            done.append(row)
            return True
        return False

    assert tse.edit_csv(votes, add_one) == 1
    with pytest.raises(ReconciliationFailed) as caught:
        run_build(tse, tmp_path, round_number=2)
    assert not (tmp_path / "out").exists()
    mismatches = [str(mismatch) for mismatch in caught.value.mismatches]
    assert any(
        "[station]" in m and "election 6258" in m and "attendance x choices" in m
        for m in mismatches
    )
    assert any("[aggregate]" in m and "votes for candidate 13" in m for m in mismatches)


def test_a_round_one_row_never_reaches_round_two(tse, tmp_path):
    votes = tse.csv_path(bulk_sources(round_config(2), Bases())["votes_president"])

    def empty_round_one(row):
        if row["NR_TURNO"] != "1":
            return False
        row["QT_VOTOS"] = "0"
        return True

    assert tse.edit_csv(votes, empty_round_one) > 0
    out = run_build(tse, tmp_path, round_number=2)
    assert races(out, "br")[1]["validos"] > 0


def test_round_two_urls():
    config = round_config(2)
    governor = aggregate_source(config, Bases(), config.state, 3, "ac", "ac")
    assert governor.url == (
        "https://resultados.tse.jus.br/oficial/ele2026/6260/dados/ac/ac-c0003-e006260-u.json"
    )
    president = aggregate_source(config, Bases(), config.president, 1, "br", "br")
    assert president.url.endswith("/ele2026/6258/dados/br/br-c0001-e006258-u.json")
    assert config.municipal == ()
    assert bulk_sources(config, Bases()) == bulk_sources(round_config(1), Bases())


def test_round_three_is_not_configured():
    with pytest.raises(ValueError, match="round 3"):
        round_config(3)
