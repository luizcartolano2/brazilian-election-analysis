"""The TSE files one election round reads, and the URL of each."""

from dataclasses import dataclass

CDN_BASE = "https://cdn.tse.jus.br/estatistica/sead/odsele"
RESULTS_BASE = "https://resultados.tse.jus.br/oficial"

ABROAD = "ZZ"

PROPORTIONAL_RACES = frozenset({6, 7, 8})


@dataclass(frozen=True)
class MunicipalElection:
    code: int
    state: str
    municipality: int
    race: int


@dataclass(frozen=True)
class RoundConfig:
    year: int
    round: int
    president: int
    state: int
    municipal: tuple[MunicipalElection, ...]

    @property
    def cycle(self) -> str:
        return f"ele{self.year}"


ROUNDS = {
    1: RoundConfig(
        year=2026,
        round=1,
        president=6257,
        state=6259,
        municipal=(MunicipalElection(code=6261, state="PE", municipality=30015, race=25),),
    ),
}


@dataclass(frozen=True)
class Source:
    """One file to download. `member` names the CSV inside a zip, if the file is a zip."""

    key: str
    url: str
    member: str | None = None


@dataclass(frozen=True)
class Bases:
    cdn: str = CDN_BASE
    results: str = RESULTS_BASE


def round_config(round_number: int) -> RoundConfig:
    if round_number not in ROUNDS:
        raise ValueError(f"round {round_number} is not configured")
    return ROUNDS[round_number]


def bulk_sources(config: RoundConfig, bases: Bases) -> dict[str, Source]:
    year = config.year
    cdn = bases.cdn
    return {
        "votes_president": Source(
            "votes_president",
            f"{cdn}/votacao_secao/votacao_secao_{year}_BR.zip",
            f"votacao_secao_{year}_BR.csv",
        ),
        "turnout": Source(
            "turnout",
            f"{cdn}/detalhe_votacao_secao/detalhe_votacao_secao_{year}.zip",
            f"detalhe_votacao_secao_{year}_BRASIL.csv",
        ),
        "candidates": Source(
            "candidates",
            f"{cdn}/consulta_cand/consulta_cand_{year}.zip",
            f"consulta_cand_{year}_BRASIL.csv",
        ),
        "places": Source(
            "places",
            f"{cdn}/eleitorado_locais_votacao/eleitorado_local_votacao_{year}.zip",
            f"eleitorado_local_votacao_{year}_BRASIL.csv",
        ),
        "munzona": Source(
            "munzona",
            f"{cdn}/votacao_candidato_munzona/votacao_candidato_munzona_{year}.zip",
            f"votacao_candidato_munzona_{year}_BRASIL.csv",
        ),
    }


def state_votes_source(config: RoundConfig, bases: Bases, state: str) -> Source:
    year = config.year
    return Source(
        f"votes_{state}",
        f"{bases.cdn}/votacao_secao/votacao_secao_{year}_{state}.zip",
        f"votacao_secao_{year}_{state}.csv",
    )


def municipality_list_source(config: RoundConfig, bases: Bases, election: int) -> Source:
    return Source(
        f"municipalities_{election}",
        f"{bases.results}/{config.cycle}/{election}/config/mun-e{election:06d}-cm.json",
    )


def aggregate_source(
    config: RoundConfig, bases: Bases, election: int, race: int, state: str, area: str
) -> Source:
    """`area` is `br`, a lower-case state code, or a state code followed by a municipality code."""
    return Source(
        f"aggregate_{election}_{race}_{area}",
        f"{bases.results}/{config.cycle}/{election}/dados/{state.lower()}/"
        f"{area}-c{race:04d}-e{election:06d}-u.json",
    )
