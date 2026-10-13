"""The web playground's catalog names the same columns as the Parquet files of the pipeline."""

import json
import re
from pathlib import Path

import duckdb

from eleicoes.load import quoted

CATALOG = Path(__file__).parents[2] / "web" / "src" / "lib" / "playground" / "catalog.json"
PARTS = {"{turno}": "[12]", "{cargo}": r"\d{1,2}", "{uf}": "[A-Z]{2}"}


def compiled_tables() -> list[tuple[dict, re.Pattern[str]]]:
    tables = json.loads(CATALOG.read_text(encoding="utf-8"))["tables"]
    compiled = []
    for table in tables:
        parts = re.split(r"(\{turno\}|\{cargo\}|\{uf\})", table["path"])
        source = "".join(PARTS.get(part, re.escape(part)) for part in parts)
        compiled.append((table, re.compile(f"^{source}$")))
    return compiled


def catalog_mismatches(root: Path) -> tuple[list[str], set[str]]:
    """Each difference between a file under `root` and its catalog table, and the tables matched."""
    problems: list[str] = []
    matched: set[str] = set()
    tables = compiled_tables()
    for path in sorted(root.rglob("*.parquet")):
        relative = path.relative_to(root).as_posix()
        table = next((table for table, pattern in tables if pattern.match(relative)), None)
        if table is None:
            continue
        matched.add(table["name"])
        described = duckdb.connect().execute(
            f"DESCRIBE SELECT * FROM read_parquet({quoted(path)}, hive_partitioning = false)"
        )
        actual = {name: kind for name, kind, *_ in described.fetchall()}
        expected = {column["name"]: column["type"] for column in table["columns"]}
        name = table["name"]
        for column in sorted(actual.keys() - expected.keys()):
            problems.append(f"{relative}: column {column} is not in the catalog's {name}")
        for column in sorted(expected.keys() - actual.keys()):
            problems.append(f"{relative}: the catalog's {name} has {column}, the file lacks it")
        for column in sorted(actual.keys() & expected.keys()):
            if actual[column] != expected[column]:
                problems.append(
                    f"{relative}: column {column} is {actual[column]}, "
                    f"the catalog says {expected[column]}"
                )
    return problems, matched


def test_the_published_columns_match_the_catalog(built, built_runoff):
    problems, matched = catalog_mismatches(built)
    assert problems == []
    assert matched == {table["name"] for table, _ in compiled_tables()}
    runoff_problems, runoff_matched = catalog_mismatches(built_runoff)
    assert runoff_problems == []
    assert "votos_secao" in runoff_matched


ACRE = "2026/t1/votos/cargo=1/uf=AC.parquet"


def copy_with(built: Path, root: Path, select: str) -> None:
    target = root / ACRE
    target.parent.mkdir(parents=True)
    source = f"read_parquet({quoted(built / ACRE)}, hive_partitioning = false)"
    query = select.replace("FILE", source)
    duckdb.connect().execute(f"COPY ({query}) TO {quoted(target)} (FORMAT parquet)")


def test_a_renamed_column_fails(built, tmp_path):
    copy_with(built, tmp_path, "SELECT * RENAME (votos AS votos_total) FROM FILE")
    problems, _ = catalog_mismatches(tmp_path)
    assert problems == [
        f"{ACRE}: column votos_total is not in the catalog's votos_secao",
        f"{ACRE}: the catalog's votos_secao has votos, the file lacks it",
    ]


def test_an_extra_column_fails(built, tmp_path):
    copy_with(built, tmp_path, "SELECT *, 'synthetic' AS email FROM FILE")
    problems, _ = catalog_mismatches(tmp_path)
    assert problems == [f"{ACRE}: column email is not in the catalog's votos_secao"]
