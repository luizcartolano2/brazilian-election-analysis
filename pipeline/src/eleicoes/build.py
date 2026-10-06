"""Builds one round's dataset: load, classify, reconcile, then write. Nothing reaches the output
directory unless every check passes."""

import shutil
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import duckdb

from eleicoes.aggregates import (
    ANNULLED,
    ANNULLED_SUB_JUDICE,
    BLANK,
    CANDIDATE,
    NULL,
    PARTY_LIST,
    TECHNICAL_NULL,
    RaceAggregate,
    parse_aggregate,
    typed_a_party,
    unlisted_vote_types,
)
from eleicoes.download import Downloader
from eleicoes.load import (
    create_votes_table,
    load_candidates,
    load_munzona,
    load_places,
    load_turnout,
    load_votes,
)
from eleicoes.reconcile import (
    Mismatch,
    ReconciliationFailed,
    aggregate_mismatches,
    municipality_zone_mismatches,
    party_list_votes,
    station_mismatches,
)
from eleicoes.sources import (
    ABROAD,
    PROPORTIONAL_RACES,
    Bases,
    aggregate_source,
    bulk_sources,
    municipality_list_source,
    round_config,
    state_votes_source,
)
from eleicoes.write import file_records, write_json, write_parquet

CREDIT = {
    "pt": "Fonte: Tribunal Superior Eleitoral (TSE), Portal de Dados Abertos. Processamento: "
    "Brazilian Election Analysis (github.com/luizcartolano2/brazilian-election-analysis).",
    "en": "Source: Brazil's Superior Electoral Court (TSE), Open Data Portal. Processing: "
    "Brazilian Election Analysis (github.com/luizcartolano2/brazilian-election-analysis).",
}
SCHEMA_VERSION = 1
MANIFEST = "manifest.json"
REPORT_LIMIT = 50


class BuildError(Exception):
    pass


@dataclass
class BuildOptions:
    round_number: int
    out_dir: Path
    work_dir: Path
    commit: str
    states: tuple[str, ...] | None = None
    bases: Bases = field(default_factory=Bases)


def log(message: str) -> None:
    print(f"{time.strftime('%H:%M:%S')} {message}", file=sys.stderr, flush=True)


class Build:
    def __init__(self, options: BuildOptions, downloader: Downloader):
        self.options = options
        self.config = round_config(options.round_number)
        self.downloader = downloader
        self.complete = options.states is None
        self.states: list[str] = []
        self.municipal = {election.code: election for election in self.config.municipal}
        self.aggregates: dict[tuple[int, int, str], RaceAggregate] = {}
        self.mismatches: list[Mismatch] = []
        self.checked: dict[str, list] = {"municipality_zone": [], "aggregate": []}
        prefix = f"{self.config.year}/t{self.config.round}"
        self.staging = options.work_dir / "staging"
        self.data_root = self.staging / prefix
        self.year_root = self.staging / str(self.config.year)

    def run(self) -> Path:
        out_dir = self.options.out_dir
        if out_dir.exists() and any(out_dir.iterdir()):
            raise BuildError(f"{out_dir} is not empty")
        work = self.options.work_dir
        work.mkdir(parents=True, exist_ok=True)
        shutil.rmtree(self.staging, ignore_errors=True)
        database = work / "build.duckdb"
        database.unlink(missing_ok=True)
        self.con = duckdb.connect(str(database))
        try:
            self._choose_states()
            self._load_shared()
            for state in self.states:
                self._build_state(state)
            self._national()
            if self.mismatches:
                self._report_and_fail()
            self._write_candidates()
            self._write_municipalities()
            self._write_manifest()
        finally:
            self.con.close()
            database.unlink(missing_ok=True)
        out_dir.parent.mkdir(parents=True, exist_ok=True)
        if out_dir.exists():
            out_dir.rmdir()
        shutil.move(str(self.staging), str(out_dir))
        log(f"build complete: {out_dir}")
        return out_dir

    # Loading

    def _choose_states(self) -> None:
        """The presidential municipality list names every state TSE published, abroad included,
        so a complete build covers exactly those."""
        document = self.downloader.json(
            municipality_list_source(self.config, self.options.bases, self.config.president)
        )
        published = sorted(state["cd"].upper() for state in document["abr"])
        if self.options.states is None:
            self.states = published
            return
        unknown = sorted(set(self.options.states) - set(published))
        if unknown:
            raise BuildError(f"unknown state codes: {', '.join(unknown)}")
        self.states = sorted(self.options.states)

    def _extracted(self, source) -> Path:
        return self.downloader.extract(source, self.options.work_dir / "extracted")

    def _keep_states(self, table: str) -> None:
        if not self.complete:
            states = ", ".join(f"'{state}'" for state in [*self.states, "BR"])
            self.con.execute(f"DELETE FROM {table} WHERE uf NOT IN ({states})")

    def _load_shared(self) -> None:
        sources = bulk_sources(self.config, self.options.bases)
        round_number = self.config.round
        steps = [
            ("president votes", "votes_president", None),
            ("turnout", "turnout", load_turnout),
            ("polling places", "places", load_places),
            ("municipality and zone totals", "munzona", load_munzona),
            ("candidates", "candidates", load_candidates),
        ]
        create_votes_table(self.con, "president_votes")
        for label, key, loader in steps:
            log(f"loading {label}")
            csv = self._extracted(sources[key])
            if loader is None:
                load_votes(self.con, "president_votes", csv, round_number)
                self._keep_states("president_votes")
            else:
                loader(self.con, csv, round_number)
                table = {"candidates": "registry"}.get(key, key)
                self._keep_states(table)
            csv.unlink()
        self._load_municipalities()
        self.con.execute("""
            CREATE OR REPLACE TABLE national (
                eleicao INTEGER, cargo TINYINT, tipo TINYINT, numero INTEGER, votos BIGINT)
        """)

    def _load_municipalities(self) -> None:
        rows = []
        for election in [self.config.president, *self.municipal]:
            document = self.downloader.json(
                municipality_list_source(self.config, self.options.bases, election)
            )
            for state in document["abr"]:
                for municipality in state["mu"]:
                    rows.append(
                        (
                            int(municipality["cd"]),
                            int(municipality["cdi"]) if municipality.get("cdi") else None,
                            municipality["nm"],
                            state["cd"].upper(),
                            municipality.get("c") == "s",
                        )
                    )
        self.con.execute("""
            CREATE OR REPLACE TABLE municipalities (
                municipio INTEGER, ibge INTEGER, nome VARCHAR, uf VARCHAR, capital BOOLEAN)
        """)
        self.con.executemany("INSERT INTO municipalities VALUES (?, ?, ?, ?, ?)", sorted(set(rows)))

    # One state

    def _build_state(self, state: str) -> None:
        log(f"building {state}")
        con = self.con
        create_votes_table(con, "state_votes")
        con.execute(
            "INSERT INTO state_votes SELECT * FROM president_votes WHERE uf = $s", {"s": state}
        )
        if state != ABROAD:
            csv = self._extracted(state_votes_source(self.config, self.options.bases, state))
            load_votes(con, "state_votes", csv, self.config.round)
            csv.unlink()

        municipal_codes = ", ".join(str(code) for code in self.municipal) or "NULL"
        races = con.execute(
            f"SELECT DISTINCT eleicao, cargo, "
            f"CASE WHEN eleicao IN ({municipal_codes}) THEN municipio END "
            f"FROM state_votes ORDER BY ALL"
        ).fetchall()
        race_rows, class_rows, scopes = [], [], []
        for eleicao, cargo, municipio in races:
            if eleicao in self.municipal:
                area, race_municipality = f"{state.lower()}{municipio:05d}", municipio
            else:
                area, race_municipality = state.lower(), None
            if (eleicao, cargo, area) in self.aggregates:
                continue
            aggregate = parse_aggregate(
                self.downloader.json(
                    aggregate_source(self.config, self.options.bases, eleicao, cargo, state, area)
                ),
                area,
                proportional=cargo in PROPORTIONAL_RACES,
            )
            self.aggregates[(eleicao, cargo, area)] = aggregate
            race_rows.append((eleicao, cargo, race_municipality, aggregate.choices_per_voter))
            numbers = con.execute(
                "SELECT DISTINCT numero FROM state_votes WHERE eleicao = $e AND cargo = $c "
                "AND ($m IS NULL OR municipio = $m)",
                {"e": eleicao, "c": cargo, "m": race_municipality},
            ).fetchall()
            proportional = cargo in PROPORTIONAL_RACES
            unlisted = unlisted_vote_types(
                con.execute(
                    "SELECT DISTINCT numero, destino FROM munzona "
                    "WHERE uf = $s AND eleicao = $e AND cargo = $c ORDER BY ALL",
                    {"s": state, "e": eleicao, "c": cargo},
                ).fetchall(),
                aggregate.label,
            )
            class_rows.extend(
                (
                    eleicao,
                    cargo,
                    race_municipality,
                    number,
                    aggregate.vote_type(number, proportional, unlisted),
                    typed_a_party(number, proportional),
                )
                for (number,) in numbers
            )
            scope = f"eleicao = {eleicao} AND cargo = {cargo}"
            if race_municipality is not None:
                scope += f" AND municipio = {race_municipality}"
            scopes.append((aggregate, scope))

        con.execute("""
            CREATE OR REPLACE TABLE races (
                eleicao INTEGER, cargo TINYINT, municipio INTEGER, choices INTEGER)
        """)
        con.executemany("INSERT INTO races VALUES (?, ?, ?, ?)", race_rows)
        con.execute("""
            CREATE OR REPLACE TABLE classes (
                eleicao INTEGER, cargo TINYINT, municipio INTEGER, numero INTEGER, tipo TINYINT,
                lista BOOLEAN)
        """)
        con.executemany("INSERT INTO classes VALUES (?, ?, ?, ?, ?, ?)", class_rows)
        con.execute("""
            CREATE OR REPLACE TABLE classified AS
            SELECT v.eleicao, v.cargo, v.municipio, v.zona, v.secao, c.tipo, c.lista,
                   v.numero, v.votos
            FROM state_votes v LEFT JOIN classes c
              ON c.eleicao = v.eleicao AND c.cargo = v.cargo AND c.numero = v.numero
             AND (c.municipio IS NULL OR c.municipio = v.municipio)
        """)
        unclassified = con.execute("SELECT count(*) FROM classified WHERE tipo IS NULL").fetchone()[
            0
        ]
        if unclassified:
            raise BuildError(f"{state}: {unclassified} vote rows have no vote type")
        con.execute(
            f"CREATE OR REPLACE VIEW turnout_state AS SELECT * FROM turnout WHERE uf = '{state}'"
        )

        self.mismatches += station_mismatches(con, state)
        zone_mismatches, covered = municipality_zone_mismatches(con, state)
        self.mismatches += zone_mismatches
        self.checked["municipality_zone"] += [[state, eleicao, cargo] for eleicao, cargo in covered]
        for aggregate, scope in scopes:
            self.mismatches += aggregate_mismatches(
                con, aggregate, "classified", "turnout_state", scope, state
            )
            self.checked["aggregate"].append([aggregate.area, aggregate.election, aggregate.race])

        con.execute(
            "INSERT INTO national SELECT eleicao, cargo, tipo, numero, sum(votos) FROM classified "
            "WHERE eleicao = $p GROUP BY ALL",
            {"p": self.config.president},
        )
        self._write_state(state, scopes)
        con.execute("DROP TABLE state_votes; DROP TABLE classified")

    def _write_state(self, state: str, scopes: list[tuple[RaceAggregate, str]]) -> None:
        con = self.con
        root = self.data_root
        for (cargo,) in con.execute(
            "SELECT DISTINCT cargo FROM classified ORDER BY cargo"
        ).fetchall():
            write_parquet(
                con,
                f"SELECT municipio, zona, secao, tipo, numero, votos FROM classified "
                f"WHERE cargo = {cargo} ORDER BY municipio, zona, secao, tipo, numero",
                root / "votos" / f"cargo={cargo}" / f"uf={state}.parquet",
            )
            write_parquet(
                con,
                f"SELECT municipio, tipo, numero, sum(votos)::INTEGER votos FROM classified "
                f"WHERE cargo = {cargo} GROUP BY ALL ORDER BY municipio, tipo, numero",
                root / "totais" / "municipio" / f"cargo={cargo}" / f"uf={state}.parquet",
            )
            write_parquet(
                con,
                f"SELECT municipio, zona, tipo, numero, sum(votos)::INTEGER votos FROM classified "
                f"WHERE cargo = {cargo} GROUP BY ALL ORDER BY municipio, zona, tipo, numero",
                root / "totais" / "zona" / f"cargo={cargo}" / f"uf={state}.parquet",
            )
        write_parquet(
            con,
            "SELECT municipio, zona, secao, cargo, aptos, comparecimento, abstencoes, nominais, "
            "legenda, brancos, nulos FROM turnout_state ORDER BY municipio, zona, secao, cargo",
            root / "comparecimento" / f"uf={state}.parquet",
        )
        write_parquet(
            con,
            f"SELECT municipio, zona, secao, local_votacao, agregada, secao_principal, nome_local, "
            f"endereco, bairro, latitude, longitude, eleitores FROM places WHERE uf = '{state}' "
            f"ORDER BY municipio, zona, secao",
            root / "secoes" / f"uf={state}.parquet",
        )
        races = [
            self._summary(aggregate, "classified", "turnout_state", scope)
            for aggregate, scope in scopes
            if aggregate.election not in self.municipal
        ]
        write_json(root / "resumo" / f"{state.lower()}.json", self._summary_document(state, races))

    # Brazil as a whole

    def _national(self) -> None:
        president = self.config.president
        area = "br"
        aggregate = parse_aggregate(
            self.downloader.json(
                aggregate_source(self.config, self.options.bases, president, 1, "br", area)
            ),
            area,
            proportional=False,
        )
        self.aggregates[(president, 1, area)] = aggregate
        if not self.complete:
            log("partial build: skipping the national presidential check and summary")
            return
        scope = f"eleicao = {president} AND cargo = 1"
        self.mismatches += aggregate_mismatches(
            self.con, aggregate, "national", "turnout", scope, "BR"
        )
        self.checked["aggregate"].append([area, president, 1])
        summary = self._summary(aggregate, "national", "turnout", scope)
        write_json(self.data_root / "resumo" / "br.json", self._summary_document("BR", [summary]))

    # Summaries

    def _summary(self, aggregate: RaceAggregate, votes: str, turnout: str, scope: str) -> dict:
        con = self.con
        by_number = dict(
            con.execute(
                f"SELECT numero, sum(votos) FROM {votes} WHERE {scope} AND tipo != {PARTY_LIST} "
                "GROUP BY numero"
            ).fetchall()
        )
        by_type = dict(
            con.execute(
                f"SELECT tipo, sum(votos) FROM {votes} WHERE {scope} GROUP BY tipo"
            ).fetchall()
        )
        eligible, attendance, abstention = con.execute(
            f"SELECT coalesce(sum(aptos), 0), coalesce(sum(comparecimento), 0), "
            f"coalesce(sum(abstencoes), 0) FROM {turnout} WHERE {scope}"
        ).fetchone()
        candidates = sorted(
            (
                {
                    "numero": candidate.number,
                    "nome": candidate.ballot_name,
                    "partido": candidate.party,
                    "votos": int(by_number.get(candidate.number, 0)),
                    "destino": candidate.destination,
                    "resultado": candidate.outcome,
                }
                for candidate in aggregate.candidates.values()
            ),
            key=lambda entry: (-entry["votos"], entry["numero"]),
        )
        by_party = party_list_votes(con, aggregate, votes, scope)
        candidate_votes: dict[int, int] = {}
        for candidate in aggregate.candidates.values():
            candidate_votes[candidate.party_number] = candidate_votes.get(
                candidate.party_number, 0
            ) + int(by_number.get(candidate.number, 0))
        parties = sorted(
            (
                {
                    "numero": party.number,
                    "sigla": party.acronym,
                    "destino": party.destination,
                    "votos_legenda": int(by_party.get(party.number, 0)),
                    "votos_candidatos": candidate_votes.get(party.number, 0),
                }
                for party in aggregate.parties.values()
            ),
            key=lambda entry: (
                -(entry["votos_legenda"] + entry["votos_candidatos"]),
                entry["numero"],
            ),
        )

        def total(vote_type: int) -> int:
            return int(by_type.get(vote_type, 0))

        return {
            "eleicao": aggregate.election,
            "cargo": aggregate.race,
            "nome": aggregate.race_name,
            "vagas": aggregate.seats,
            "escolhas_por_eleitor": aggregate.choices_per_voter,
            "aptos": int(eligible),
            "comparecimento": int(attendance),
            "abstencoes": int(abstention),
            "validos": total(CANDIDATE) + total(PARTY_LIST),
            "nominais": total(CANDIDATE),
            "legenda": total(PARTY_LIST),
            "brancos": total(BLANK),
            "nulos": total(NULL),
            "nulos_tecnicos": total(TECHNICAL_NULL),
            "anulados": total(ANNULLED),
            "anulados_sub_judice": total(ANNULLED_SUB_JUDICE),
            "candidatos": candidates,
            "partidos": parties,
        }

    def _summary_document(self, area: str, races: list[dict]) -> dict:
        return {
            "versao_esquema": SCHEMA_VERSION,
            "ano": self.config.year,
            "turno": self.config.round,
            "area": area,
            "corridas": sorted(races, key=lambda race: (race["eleicao"], race["cargo"])),
        }

    # Tables for the whole round

    def _write_candidates(self) -> None:
        con = self.con
        con.execute("""
            CREATE OR REPLACE TABLE aggregate_candidates (
                eleicao INTEGER, cargo TINYINT, uf VARCHAR, numero INTEGER, nome_urna VARCHAR,
                partido_numero INTEGER, partido_sigla VARCHAR, destino VARCHAR, resultado VARCHAR)
        """)
        rows = []
        for (eleicao, cargo, area), aggregate in self.aggregates.items():
            if eleicao == self.config.president and area != "br":
                continue
            uf = "BR" if area == "br" else area[:2].upper()
            rows += [
                (eleicao, cargo, uf, candidate.number, candidate.ballot_name,
                 candidate.party_number, candidate.party, candidate.destination, candidate.outcome)
                for candidate in aggregate.candidates.values()
            ]  # fmt: skip
        con.executemany("INSERT INTO aggregate_candidates VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
        built = ", ".join(f"'{state}'" for state in [*self.states, "BR"])
        write_parquet(
            con,
            f"""
            WITH registry_built AS (SELECT * FROM registry WHERE uf IN ({built})),
            matched AS (
                SELECT r.*, a.destino, a.resultado
                FROM registry_built r LEFT JOIN aggregate_candidates a
                  ON a.eleicao = r.eleicao AND a.cargo = r.cargo AND a.uf = r.uf
                 AND a.numero = r.numero AND a.nome_urna = r.nome_urna),
            aggregate_only AS (
                SELECT a.eleicao, {self.config.round}::TINYINT turno, a.cargo, a.uf, a.numero,
                       a.nome_urna, a.partido_numero, a.partido_sigla,
                       NULL::VARCHAR federacao, NULL::VARCHAR coligacao, NULL::VARCHAR situacao,
                       a.destino, a.resultado
                FROM aggregate_candidates a ANTI JOIN registry_built r
                  ON a.eleicao = r.eleicao AND a.cargo = r.cargo AND a.uf = r.uf
                 AND a.numero = r.numero AND a.nome_urna = r.nome_urna)
            SELECT eleicao, turno, cargo, uf, numero, nome_urna, partido_numero, partido_sigla,
                   federacao, coligacao, situacao, destino, resultado
            FROM (SELECT * FROM matched UNION ALL BY NAME SELECT * FROM aggregate_only)
            ORDER BY ALL
            """,
            self.data_root / "candidatos.parquet",
        )

    def _write_municipalities(self) -> None:
        write_parquet(
            self.con,
            "SELECT municipio, ibge, nome, uf, capital FROM municipalities ORDER BY municipio",
            self.year_root / "municipios.parquet",
        )

    def _write_manifest(self) -> None:
        manifest = {
            "versao_esquema": SCHEMA_VERSION,
            "ano": self.config.year,
            "turno": self.config.round,
            "commit": self.options.commit,
            "gerado_em": self.downloader.clock(),
            "parcial": not self.complete,
            "estados": self.states,
            "credito": CREDIT,
            "fontes": self.downloader.records(),
            "verificacoes": {
                "secao": "todas as seções e cargos",
                "municipio_zona": sorted(self.checked["municipality_zone"]),
                "agregado": sorted(self.checked["aggregate"]),
            },
            "arquivos": file_records(self.staging, exclude={MANIFEST}),
        }
        write_json(self.staging / MANIFEST, manifest)

    def _report_and_fail(self) -> None:
        report = self.options.work_dir / "reconciliation-report.txt"
        report.write_text("\n".join(str(mismatch) for mismatch in self.mismatches) + "\n")
        for mismatch in self.mismatches[:REPORT_LIMIT]:
            log(str(mismatch))
        if len(self.mismatches) > REPORT_LIMIT:
            log(f"... and {len(self.mismatches) - REPORT_LIMIT} more")
        log(f"every mismatch is listed in {report}")
        shutil.rmtree(self.staging, ignore_errors=True)
        raise ReconciliationFailed(self.mismatches)
