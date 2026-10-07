"""Writes Parquet and JSON outputs. Fixed ordering and settings make reruns byte-identical."""

import hashlib
import json
from pathlib import Path

import duckdb

from eleicoes.load import quoted
from eleicoes.privacy import assert_no_personal_columns

PARQUET_OPTIONS = "FORMAT parquet, COMPRESSION zstd, COMPRESSION_LEVEL 9, ROW_GROUP_SIZE 65536"


def write_parquet(con: duckdb.DuckDBPyConnection, query: str, path: Path) -> None:
    """`query` must carry its own ORDER BY over a unique key, or reruns can differ."""
    columns = [row[0] for row in con.execute(f"DESCRIBE {query}").fetchall()]
    assert_no_personal_columns(path.name, columns)
    path.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY ({query}) TO {quoted(path)} ({PARQUET_OPTIONS})")


def keys_of(document) -> list[str]:
    if isinstance(document, dict):
        return [*document, *(key for value in document.values() for key in keys_of(value))]
    if isinstance(document, list):
        return [key for value in document for key in keys_of(value)]
    return []


def write_json(path: Path, document: dict | list) -> None:
    assert_no_personal_columns(path.name, keys_of(document))
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(document, ensure_ascii=False, sort_keys=True, indent=1)
    path.write_text(text + "\n", encoding="utf-8")


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1 << 20):
            digest.update(chunk)
    return digest.hexdigest()


def file_records(root: Path, exclude: set[str]) -> list[dict]:
    return [
        {
            "path": path.relative_to(root).as_posix(),
            "size": path.stat().st_size,
            "sha256": sha256_of(path),
        }
        for path in sorted(root.rglob("*"))
        if path.is_file() and path.relative_to(root).as_posix() not in exclude
    ]
