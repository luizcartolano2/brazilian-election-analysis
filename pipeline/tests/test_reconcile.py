"""Each test breaks one number in a copy of the fixtures and expects the build to name it."""

import pytest
from conftest import run_build

from eleicoes.aggregates import MalformedAggregate, UnknownDestination
from eleicoes.reconcile import ReconciliationFailed
from eleicoes.sources import Bases, bulk_sources, round_config, state_votes_source

CONFIG = round_config(1)
REAL = Bases()
AC_GOVERNOR = "6259/dados/ac/ac-c0003-e006259-u.json"
AC_SENATE = "6259/dados/ac/ac-c0005-e006259-u.json"
PE_FEDERAL_DEPUTY = "6259/dados/pe/pe-c0006-e006259-u.json"


def failure(tse, tmp_path) -> list[str]:
    with pytest.raises(ReconciliationFailed) as caught:
        run_build(tse, tmp_path)
    assert not (tmp_path / "out").exists()
    return [str(mismatch) for mismatch in caught.value.mismatches]


def add_one_vote(tse, path, match) -> None:
    done = []

    def change(row):
        if not done and match(row):
            row["QT_VOTOS"] = str(int(row["QT_VOTOS"]) + 1)
            done.append(row)
            return True
        return False

    assert tse.edit_csv(path, change) == 1


def first_candidate(document) -> dict:
    return document["carg"][0]["agr"][0]["par"][0]["cand"][0]


def test_one_extra_vote_at_a_station(tse, tmp_path):
    votes = tse.csv_path(state_votes_source(CONFIG, REAL, "AC"))
    add_one_vote(tse, votes, lambda row: row["CD_CARGO"] == "3" and row["NR_VOTAVEL"] == "95")
    mismatches = failure(tse, tmp_path)
    assert any(
        "[station]" in m and "race 3" in m and "votes vs attendance x choices" in m
        for m in mismatches
    )
    assert any("[station]" in m and "blank votes" in m for m in mismatches)


def test_senate_votes_are_checked_against_two_choices(tse, tmp_path):
    def one_choice(document):
        document["v"]["tv"] = document["e"]["c"]

    tse.edit_json(tse.aggregate_path(AC_SENATE), one_choice)
    mismatches = failure(tse, tmp_path)
    assert any(
        "[station]" in m and "race 5" in m and "attendance x choices" in m for m in mismatches
    )


def test_a_ratio_that_is_not_whole_stops_the_build(tse, tmp_path):
    def add_one(document):
        document["v"]["tv"] = str(int(document["v"]["tv"]) + 1)

    tse.edit_json(tse.aggregate_path(AC_SENATE), add_one)
    with pytest.raises(MalformedAggregate, match="not a whole multiple"):
        run_build(tse, tmp_path)


def test_a_municipality_total_differs(tse, tmp_path):
    munzona = tse.csv_path(bulk_sources(CONFIG, REAL)["munzona"])
    done = []

    def change(row):
        if not done and row["SG_UF"] == "AC":
            row["QT_VOTOS_NOMINAIS"] = str(int(row["QT_VOTOS_NOMINAIS"]) + 1)
            done.append(row)
            return True
        return False

    tse.edit_csv(munzona, change)
    mismatches = failure(tse, tmp_path)
    expected = f"municipality {done[0]['CD_MUNICIPIO']} zone {done[0]['NR_ZONA']}"
    assert any("[municipality-zone]" in m and expected in m for m in mismatches)


def test_a_state_total_differs(tse, tmp_path):
    numbers = []

    def add_one(document):
        candidate = first_candidate(document)
        candidate["vap"] = str(int(candidate["vap"]) + 1)
        numbers.append(candidate["n"])

    tse.edit_json(tse.aggregate_path(AC_GOVERNOR), add_one)
    mismatches = failure(tse, tmp_path)
    assert any("[aggregate]" in m and f"votes for candidate {numbers[0]}" in m for m in mismatches)


def test_a_list_vote_assigned_to_the_wrong_party(tse, tmp_path):
    parties = []
    tse.edit_json(
        tse.aggregate_path(PE_FEDERAL_DEPUTY),
        lambda document: parties.extend(
            party["n"] for group in document["carg"][0]["agr"] for party in group["par"]
            if party["dvt"] == "Válido (legenda)"
        ),
    )  # fmt: skip
    votes = tse.csv_path(state_votes_source(CONFIG, REAL, "PE"))
    moved = []

    def move(row):
        if not moved and row["CD_CARGO"] == "6" and row["NR_VOTAVEL"] in parties:
            target = next(p for p in parties if p != row["NR_VOTAVEL"])
            moved.append((row["NR_VOTAVEL"], target))
            row["NR_VOTAVEL"] = target
            return True
        return False

    tse.edit_csv(votes, move)
    source, target = moved[0]
    mismatches = failure(tse, tmp_path)
    assert any(f"list votes for party {source}" in m for m in mismatches)
    assert any(f"list votes for party {target}" in m for m in mismatches)


def test_a_wrong_valid_total(tse, tmp_path):
    def add_one(document):
        document["v"]["vv"] = str(int(document["v"]["vv"]) + 1)

    tse.edit_json(tse.aggregate_path(AC_GOVERNOR), add_one)
    mismatches = failure(tse, tmp_path)
    assert any("[aggregate]" in m and "valid votes" in m for m in mismatches)


def test_every_mismatch_is_reported(tse, tmp_path):
    votes = tse.csv_path(state_votes_source(CONFIG, REAL, "AC"))
    add_one_vote(tse, votes, lambda row: row["CD_CARGO"] == "3" and row["NR_VOTAVEL"] == "95")

    def add_one(document):
        document["v"]["vv"] = str(int(document["v"]["vv"]) + 1)

    tse.edit_json(tse.aggregate_path(PE_FEDERAL_DEPUTY), add_one)
    mismatches = failure(tse, tmp_path)
    assert any(m.startswith("[station] AC") for m in mismatches)
    assert any(m.startswith("[aggregate] PE") and "valid votes" in m for m in mismatches)


def test_an_unknown_destination_stops_the_build(tse, tmp_path):
    tse.edit_json(
        tse.aggregate_path(AC_GOVERNOR),
        lambda document: first_candidate(document).update(dvt="Destino novo"),
    )
    with pytest.raises(UnknownDestination, match="Destino novo"):
        run_build(tse, tmp_path)


def test_council_votes_are_checked_against_one_choice(tse, tmp_path):
    def seven_choices(document):
        document["v"]["tv"] = str(int(document["e"]["c"]) * 7)

    tse.edit_json(tse.aggregate_path("6261/dados/pe/pe30015-c0025-e006261-u.json"), seven_choices)
    mismatches = failure(tse, tmp_path)
    assert any(
        "[station]" in m and "race 25" in m and "attendance x choices" in m for m in mismatches
    )
