import hashlib
import json
from pathlib import Path

import duckdb
import pytest
from conftest import query, races, run_build

from eleicoes.aggregates import ANNULLED_SUB_JUDICE, PARTY_LIST, TECHNICAL_NULL
from eleicoes.build import BuildError
from eleicoes.download import SourceUnavailable
from eleicoes.load import CANDIDATE_ALLOWLIST, quoted
from eleicoes.reconcile import ReconciliationFailed, summary_mismatches
from eleicoes.sources import Bases, bulk_sources, round_config

DATA = "2026/t1"


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


def test_the_manifest_records_each_checked_summary(built):
    checked = json.loads((built / "manifest.json").read_text())["verificacoes"]["resumo"]
    assert ["pe", 6259, 6] in checked
    assert ["br", 6257, 1] in checked
    assert not [entry for entry in checked if entry[1] == 6261]


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


def test_party_candidate_votes_count_valid_candidates_only(built):
    """Acre's MDB has 1515 under appeal, whose votes stay out of the party's candidate votes."""
    deputy = races(built, "ac")[6]
    mdb = next(party for party in deputy["partidos"] if party["numero"] == 15)
    assert mdb["votos_candidatos"] == sum(
        candidate["votos"]
        for candidate in deputy["candidatos"]
        if candidate["partido"] == "MDB" and candidate["destino"] == "Válido"
    )
    for state in ("ac", "pe", "se"):
        for cargo in (6, 7):
            race = races(built, state)[cargo]
            lists = sum(
                party["votos_legenda"]
                for party in race["partidos"]
                if party["destino"] == "Válido (legenda)"
            )
            candidates = sum(party["votos_candidatos"] for party in race["partidos"])
            assert candidates + lists == race["validos"], (state, cargo)


ZOZOI = {
    "numero": 4033,
    "nome": "ZOZOI DO IBURA",
    "partido": "PSB",
    "votos": 13,
    "destino": "Anulado sub judice",
    "resultado": "",
}


def test_a_summary_names_a_candidate_the_aggregate_omits(built):
    """TSE's aggregate omits 4033 in Pernambuco. Its munzona file names the candidacy, and the
    candidate file gives its party."""
    assert ZOZOI in races(built, "pe")[6]["candidatos"]


def edit_pe_4033(tse, change) -> None:
    """Applies `change` to both of the candidate file's candidacies for 4033 in Pernambuco."""
    candidates = tse.csv_path(bulk_sources(round_config(1), Bases())["candidates"])

    def apply(row):
        if (row["SG_UF"], row["CD_CARGO"], row["NR_CANDIDATO"]) != ("PE", "6", "4033"):
            return False
        change(row)
        return True

    assert tse.edit_csv(candidates, apply) == 2


def test_the_ballot_name_picks_the_party_among_candidacies_that_share_a_number(tse, tmp_path):
    def move_the_other_candidacy(row):
        if row["NM_URNA_CANDIDATO"] == "GERMANA LACERDA":
            row.update(NR_PARTIDO="13", SG_PARTIDO="PT")

    edit_pe_4033(tse, move_the_other_candidacy)
    assert ZOZOI in races(run_build(tse, tmp_path), "pe")[6]["candidatos"]


def renumber(row):
    row["NR_CANDIDATO"] = "4099"


def rename(row):
    row["NM_URNA_CANDIDATO"] += " SOBRENOME"


def share_the_name_across_parties(row):
    if row["NM_URNA_CANDIDATO"] == "GERMANA LACERDA":
        row.update(NM_URNA_CANDIDATO="ZOZOI DO IBURA", NR_PARTIDO="13", SG_PARTIDO="PT")


def drop_the_party(row):
    if row["NM_URNA_CANDIDATO"] == "ZOZOI DO IBURA":
        row["NR_PARTIDO"] = "#NULO"


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (renumber, "candidate 4033 is in neither the aggregate nor the candidate file"),
        (rename, "candidate 4033 has 2 candidacies in the candidate file, and none has the ballot"),
        (share_the_name_across_parties, "candidate 4033 has two names or parties"),
        (drop_the_party, "candidate 4033 has no party in the candidate file"),
    ],
)
def test_a_candidate_the_aggregate_omits_needs_one_party(tse, tmp_path, change, message):
    edit_pe_4033(tse, change)
    with pytest.raises(BuildError, match=message):
        run_build(tse, tmp_path)
    assert not (tmp_path / "out").exists()


def test_the_summary_check_names_a_vote_with_no_line(built):
    deputy = races(built, "pe")[6]
    assert summary_mismatches(deputy, "PE") == []
    deputy["candidatos"] = [entry for entry in deputy["candidatos"] if entry["numero"] != 4033]
    assert [str(mismatch) for mismatch in summary_mismatches(deputy, "PE")] == [
        "[summary] PE race 6: annulled sub judice votes on named lines is 0, TSE says 13"
    ]


def test_the_summary_check_adds_up_the_party_table(built):
    deputy = races(built, "ac")[6]
    deputy["partidos"][0]["votos_candidatos"] += 1
    valid = deputy["validos"]
    assert [str(mismatch) for mismatch in summary_mismatches(deputy, "AC")] == [
        f"[summary] AC race 6: party totals is {valid + 1}, TSE says {valid}"
    ]


def test_a_president_candidate_that_brazils_aggregate_omits_stops_the_build(built, tse, tmp_path):
    """The states' aggregates still list 16, so every other check passes, and the Brazil
    summary has no line for its votes."""

    def drop_16(document):
        for group in document["carg"][0]["agr"]:
            for party in group["par"]:
                party["cand"] = [entry for entry in party["cand"] if int(entry["n"]) != 16]

    tse.edit_json(tse.aggregate_path("6257/dados/br/br-c0001-e006257-u.json"), drop_16)
    with pytest.raises(ReconciliationFailed) as caught:
        run_build(tse, tmp_path)
    nominal = races(built, "br")[1]["nominais"]
    assert [str(mismatch) for mismatch in caught.value.mismatches] == [
        f"[summary] BR race 1: candidate votes on named lines is {nominal - 2}, TSE says {nominal}"
    ]


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


def test_each_classified_candidate_number_has_one_row(built):
    rows = query(
        built / DATA / "candidatos.parquet",
        "SELECT eleicao, cargo, uf, numero FROM FILE WHERE destino IS NOT NULL "
        "GROUP BY ALL HAVING count(*) > 1",
    )
    assert rows == []


@pytest.mark.parametrize(("cargo", "uf", "numero"), [(5, "PE", 300), (6, "AC", 1567)])
def test_names_spelled_differently_still_match(built, cargo, uf, numero):
    rows = query(
        built / DATA / "candidatos.parquet",
        f"SELECT partido_numero, destino FROM FILE WHERE eleicao = 6259 AND cargo = {cargo} "
        f"AND uf = '{uf}' AND numero = {numero}",
    )
    assert len(rows) == 1
    partido_numero, destino = rows[0]
    assert partido_numero is not None and destino is not None


def test_a_candidate_the_aggregate_omits_takes_the_munzona_destination(built):
    """Two candidacies share 4033 in Pernambuco after a substitution. Only the one TSE counted
    gets the destination its municipality-and-zone file gives."""
    rows = query(
        built / DATA / "candidatos.parquet",
        "SELECT nome_urna, destino FROM FILE WHERE cargo = 6 AND uf = 'PE' AND numero = 4033 "
        "ORDER BY nome_urna",
    )
    assert rows == [("GERMANA LACERDA", None), ("ZOZOI DO IBURA", "Anulado sub judice")]


def test_turnout_totals_per_municipality_and_zone(built):
    stations = built / DATA / "comparecimento" / "uf=AC.parquet"
    expected = query(
        stations, "SELECT cargo, sum(comparecimento) FROM FILE GROUP BY cargo ORDER BY cargo"
    )
    for level in ("municipio", "zona"):
        totals = built / DATA / "totais" / level / "comparecimento" / "uf=AC.parquet"
        assert (
            query(
                totals, "SELECT cargo, sum(comparecimento) FROM FILE GROUP BY cargo ORDER BY cargo"
            )
            == expected
        )


def test_unknown_coordinates_are_null(built):
    rows = query(built / DATA / "secoes" / "uf=ZZ.parquet", "SELECT DISTINCT latitude FROM FILE")
    assert rows == [(None,)]


def test_a_build_from_other_urls_is_marked(built):
    manifest = json.loads((built / "manifest.json").read_text())
    assert manifest["fontes_tse"] is False


def municipality_list(tse, election: int) -> Path:
    return (
        tse.data / "results" / "ele2026" / str(election) / "config" / f"mun-e{election:06d}-cm.json"
    )


def test_an_invalid_state_code_stops_the_build(tse, tmp_path):
    tse.edit_json(
        municipality_list(tse, 6257), lambda document: document["abr"][0].update(cd="a'c")
    )
    with pytest.raises(BuildError, match="invalid state code"):
        run_build(tse, tmp_path)


def test_a_repeated_state_is_built_once(tse, tmp_path):
    out = run_build(tse, tmp_path, states=("AC", "AC"))
    assert json.loads((out / "manifest.json").read_text())["estados"] == ["AC"]


def test_conflicting_municipality_lists_stop_the_build(tse, tmp_path):
    def rename(document):
        document["abr"][0]["mu"][0]["nm"] = "OUTRO NOME"

    tse.edit_json(municipality_list(tse, 6261), rename)
    with pytest.raises(BuildError, match="differs between TSE's lists"):
        run_build(tse, tmp_path)
