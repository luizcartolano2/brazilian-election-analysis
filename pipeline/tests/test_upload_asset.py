"""Runs `.github/scripts/upload-asset.sh` with the real AWS CLI against a local S3 server."""

import hashlib
import os
import shutil
from pathlib import Path

import pytest

# The CI job sets REQUIRE_UPLOAD_TESTS, so these tests skip only on a machine without the
# tools, and in the publish build job, which leaves the upload-tests group out on purpose.
if os.environ.get("REQUIRE_UPLOAD_TESTS") != "1":
    pytest.importorskip("moto.server", reason="needs `uv sync --group upload-tests`")
    if shutil.which("aws") is None:
        pytest.skip("needs the AWS CLI", allow_module_level=True)

from upload_support import BUCKET, bucket, endpoint, keys, run_upload  # noqa: E402

__all__ = ["bucket", "endpoint"]

SCRIPT = Path(__file__).resolve().parents[2] / ".github" / "scripts" / "upload-asset.sh"
VERSION = "1.33.1-dev57.0"
ASSET_PATH = f"assets/duckdb-wasm/{VERSION}"
PREFIX = f"{ASSET_PATH}/"
GEO_PATH = "assets/geo/ibge-2025/20261008-abc1234-37000000000"
FILES = {
    "duckdb-eh.wasm": b"\0asm module bytes",
    "extensions/v1.5.4/wasm_eh/parquet.duckdb_extension.wasm": b"\0asm extension bytes",
}


def write_sums(folder: Path, files: dict[str, bytes]) -> None:
    lines = sorted(f"{hashlib.sha256(body).hexdigest()}  {path}" for path, body in files.items())
    (folder / "SHA256SUMS").write_text("\n".join(lines) + "\n")


@pytest.fixture
def staged(tmp_path) -> Path:
    folder = tmp_path / "duckdb-assets"
    for path, body in FILES.items():
        (folder / path).parent.mkdir(parents=True, exist_ok=True)
        (folder / path).write_bytes(body)
    write_sums(folder, FILES)
    return folder


def run(tmp_path, endpoint, folder, asset_path=ASSET_PATH, **extra_env):
    return run_upload(SCRIPT, tmp_path, endpoint, [str(folder), asset_path], **extra_env)


def test_uploads_the_assets_then_the_sums(tmp_path, endpoint, bucket, staged):
    result, calls = run(tmp_path, endpoint, staged)

    assert result.returncode == 0, result.stderr
    assert keys(bucket) == sorted(PREFIX + path for path in [*FILES, "SHA256SUMS"])
    for path, body in FILES.items():
        assert bucket.get_object(Bucket=BUCKET, Key=PREFIX + path)["Body"].read() == body
    writes = [
        call for call in calls if call.startswith("s3 cp") and call.split()[3].startswith("s3://")
    ]
    assert writes[-1].split()[3] == f"s3://{BUCKET}/{PREFIX}SHA256SUMS"


def test_uploads_a_boundary_build(tmp_path, endpoint, bucket):
    files = {"br.json": b'{"type":"Topology"}', "pe.json": b"{}", "manifest.json": b"{}"}
    folder = tmp_path / "geo-assets"
    folder.mkdir()
    for path, body in files.items():
        (folder / path).write_bytes(body)
    write_sums(folder, files)

    result, _ = run(tmp_path, endpoint, folder, GEO_PATH)

    assert result.returncode == 0, result.stderr
    assert keys(bucket) == sorted(f"{GEO_PATH}/{path}" for path in [*files, "SHA256SUMS"])


def test_resumes_when_the_files_there_are_the_staged_ones(tmp_path, endpoint, bucket, staged):
    bucket.put_object(Bucket=BUCKET, Key=PREFIX + "duckdb-eh.wasm", Body=FILES["duckdb-eh.wasm"])

    result, calls = run(tmp_path, endpoint, staged)

    assert result.returncode == 0, result.stderr
    assert keys(bucket) == sorted(PREFIX + path for path in [*FILES, "SHA256SUMS"])
    writes = [call.split()[3] for call in calls if call.startswith("s3 cp")]
    assert f"s3://{BUCKET}/{PREFIX}duckdb-eh.wasm" not in writes


def test_refuses_a_file_there_that_differs(tmp_path, endpoint, bucket, staged):
    bucket.put_object(Bucket=BUCKET, Key=PREFIX + "duckdb-eh.wasm", Body=b"earlier")

    result, calls = run(tmp_path, endpoint, staged)

    assert result.returncode != 0
    assert "differs from the staged file" in result.stderr
    assert keys(bucket) == [PREFIX + "duckdb-eh.wasm"]
    copies = [call.split() for call in calls if call.startswith("s3 cp")]
    assert not any(target.startswith("s3://") for _, _, _, target, *_ in copies)


@pytest.mark.parametrize(
    ("key", "message"),
    [("SHA256SUMS", "already complete"), ("other.wasm", "not one of these assets")],
    ids=["a complete path", "an unknown file"],
)
def test_refuses_a_path_it_cannot_resume(tmp_path, endpoint, bucket, staged, key, message):
    bucket.put_object(Bucket=BUCKET, Key=PREFIX + key, Body=b"x")

    result, _ = run(tmp_path, endpoint, staged)

    assert result.returncode != 0
    assert message in result.stderr
    assert keys(bucket) == [PREFIX + key]


def test_refuses_a_file_that_differs_from_its_sum(tmp_path, endpoint, bucket, staged):
    (staged / "duckdb-eh.wasm").write_bytes(b"\0asm something else")

    result, calls = run(tmp_path, endpoint, staged)

    assert result.returncode != 0
    assert "SHA-256 of duckdb-eh.wasm" in result.stderr
    assert calls == []


def test_refuses_a_file_the_sums_do_not_list(tmp_path, endpoint, bucket, staged):
    (staged / "extra.wasm").write_bytes(b"\0asm")

    result, calls = run(tmp_path, endpoint, staged)

    assert result.returncode != 0
    assert calls == []


def test_withholds_the_sums_when_a_stored_file_differs(tmp_path, endpoint, bucket, staged):
    result, _ = run(
        tmp_path,
        endpoint,
        staged,
        TAMPER_KEY=PREFIX + "duckdb-eh.wasm",
        TAMPER_AFTER="duckdb-eh.wasm s3://",
    )

    assert result.returncode != 0
    assert "the files in R2" in result.stderr
    assert PREFIX + "SHA256SUMS" not in keys(bucket)


@pytest.mark.parametrize(
    "line",
    [
        "a[$(touch${IFS}ran)]  duckdb-eh.wasm",
        f"{'a' * 64}  ../escape.wasm",
        f"{'a' * 64}  duckdb-eh.wasm extra",
    ],
    ids=["code in the sum", "a path out of the folder", "a third field"],
)
def test_refuses_a_malformed_sums_line(tmp_path, endpoint, bucket, staged, line):
    (staged / "SHA256SUMS").write_text(line + "\n")

    result, calls = run(tmp_path, endpoint, staged)

    assert result.returncode != 0
    assert calls == []
    assert not (tmp_path / "ran").exists()


@pytest.mark.parametrize(
    "asset_path",
    [
        VERSION,
        "assets/duckdb-wasm/../1.0.0",
        "assets/duckdb-wasm/latest",
        "assets/duckdb-wasm/1.0",
        "assets/duckdb-wasm/1.0.0/x",
        "assets/geo/ibge-2025/latest",
        "assets/geo/ibge-2025/20261008-abc1234-1/x",
        "assets/geo/ibge-2024/20261008-abc1234-1",
        "assets/geo/20261008-abc1234-1",
        "assets/other/1.0.0",
        "v/20261007-67d59ff-37656362427",
    ],
)
def test_refuses_any_other_asset_path(tmp_path, endpoint, bucket, staged, asset_path):
    result, calls = run(tmp_path, endpoint, staged, asset_path)

    assert result.returncode != 0
    assert "is neither" in result.stderr
    assert calls == []
