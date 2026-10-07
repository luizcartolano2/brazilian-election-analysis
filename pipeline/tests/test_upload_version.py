"""Runs `.github/scripts/upload-version.sh` with the real AWS CLI against a local S3 server."""

import json
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

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / ".github" / "scripts" / "upload-version.sh"
WEB_FIXTURES = REPO / "web" / "fixtures"
VERSION = "20261007-abc1234-42"
PREFIX = f"v/{VERSION}/"


@pytest.fixture
def dist(tmp_path) -> Path:
    """The web fixtures are a real pipeline output, marked here as a complete build from TSE."""
    folder = tmp_path / "dist"
    shutil.copytree(WEB_FIXTURES, folder)
    edit_manifest(folder, fontes_tse=True, parcial=False)
    return folder


def edit_manifest(folder: Path, remove: tuple[str, ...] = (), **changes) -> None:
    path = folder / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    for key in remove:
        manifest.pop(key)
    manifest.update(changes)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")


def edit_first_entry(folder: Path, **changes) -> None:
    path = folder / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    manifest["arquivos"][0].update(changes)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")


def listed_files(folder: Path) -> list[str]:
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    return [record["path"] for record in manifest["arquivos"]]


def run_script(tmp_path: Path, endpoint: str, dist: Path, version: str = VERSION, **extra_env):
    return run_upload(SCRIPT, tmp_path, endpoint, [str(dist), version], **extra_env)


def test_uploads_every_file_then_the_manifest_last(tmp_path, endpoint, bucket, dist):
    result, calls = run_script(tmp_path, endpoint, dist)

    assert result.returncode == 0, result.stderr
    expected = sorted(PREFIX + path for path in [*listed_files(dist), "manifest.json"])
    assert keys(bucket) == expected
    copies = [call.split()[2:4] for call in calls if call.startswith("s3 cp")]
    # Data up, data read back, manifest up, manifest read back.
    assert [source.startswith("s3://") for source, _ in copies] == [False, True, False, True]
    writes = [(source, target) for source, target in copies if target.startswith("s3://")]
    assert writes[-1] == (f"{dist}/manifest.json", f"s3://{BUCKET}/{PREFIX}manifest.json")
    stored = bucket.get_object(Bucket=BUCKET, Key=PREFIX + "manifest.json")["Body"].read()
    assert stored == (dist / "manifest.json").read_bytes()
    assert "manifest.json SHA-256: " in result.stdout


def test_a_failed_data_upload_leaves_no_manifest(tmp_path, endpoint, bucket, dist):
    result, _ = run_script(tmp_path, endpoint, dist, FAIL_CALL="--exclude manifest.json")

    assert result.returncode != 0
    assert PREFIX + "manifest.json" not in keys(bucket)


def test_a_failed_read_back_leaves_no_manifest(tmp_path, endpoint, bucket, dist):
    result, _ = run_script(tmp_path, endpoint, dist, FAIL_CALL=f"s3 cp s3://{BUCKET}/")

    assert result.returncode != 0
    assert keys(bucket) == sorted(PREFIX + path for path in listed_files(dist))


def test_withholds_the_manifest_when_a_stored_file_differs(tmp_path, endpoint, bucket, dist):
    tampered = listed_files(dist)[0]

    result, _ = run_script(
        tmp_path,
        endpoint,
        dist,
        TAMPER_KEY=PREFIX + tampered,
        TAMPER_AFTER="--exclude manifest.json",
    )

    assert result.returncode != 0
    assert f"the files in R2: {tampered}" in result.stderr
    assert PREFIX + "manifest.json" not in keys(bucket)


def test_fails_when_the_stored_manifest_differs(tmp_path, endpoint, bucket, dist):
    result, _ = run_script(
        tmp_path,
        endpoint,
        dist,
        TAMPER_KEY=PREFIX + "manifest.json",
        TAMPER_AFTER=f"{dist}/manifest.json s3://",
    )

    assert result.returncode != 0
    assert "the manifest stored in R2 differs" in result.stderr
    assert "manifest.json SHA-256" not in result.stdout


def test_never_runs_code_from_a_manifest_field(tmp_path, endpoint, bucket, dist):
    marker = tmp_path / "ran"
    edit_first_entry(dist, size=f"BASH_VERSINFO[$(touch${{IFS}}{marker})]")

    result, calls = run_script(tmp_path, endpoint, dist)

    assert result.returncode != 0
    assert not marker.exists()
    assert calls == []


@pytest.mark.parametrize(
    "changes",
    [
        {"size": "870"},
        {"size": -1},
        {"size": 1.5},
        {"sha256": "ABC"},
        {"sha256": None},
        {"path": 7},
    ],
    ids=["size as text", "negative size", "fractional size", "short hash", "no hash", "path"],
)
def test_refuses_a_malformed_file_entry(tmp_path, endpoint, bucket, dist, changes):
    edit_first_entry(dist, **changes)

    result, calls = run_script(tmp_path, endpoint, dist)

    assert result.returncode != 0
    assert "malformed entry" in result.stderr
    assert calls == []


def path_for_key_length(length: int) -> str:
    """A manifest path whose key `v/<version>/<path>` has exactly `length` characters."""
    remaining = length - len(PREFIX) - len(".json")
    segments = []
    while remaining > 200:
        segments.append("a" * 199)
        remaining -= 200
    segments.append("a" * remaining)
    return "/".join(segments) + ".json"


@pytest.mark.parametrize("length", [1024, 1025])
def test_refuses_a_key_longer_than_r2_allows(tmp_path, endpoint, bucket, dist, length):
    # The file is never created: macOS limits a whole path to 1,024 characters, and the
    # length check runs before the folder is read.
    path = path_for_key_length(length)
    assert len(PREFIX + path) == length
    edit_first_entry(dist, path=path)

    result, calls = run_script(tmp_path, endpoint, dist)

    assert result.returncode != 0
    assert ("longer than R2's 1024 characters" in result.stderr) == (length > 1024)
    assert calls == []


def test_refuses_a_manifest_that_is_not_json(tmp_path, endpoint, bucket, dist):
    (dist / "manifest.json").write_text("{not json")

    result, calls = run_script(tmp_path, endpoint, dist)

    assert result.returncode != 0
    assert "not a JSON object" in result.stderr
    assert calls == []


def test_refuses_a_symlink(tmp_path, endpoint, bucket, dist):
    (dist / "2026" / "link.json").symlink_to(tmp_path / "no-aws-credentials")

    result, calls = run_script(tmp_path, endpoint, dist)

    assert result.returncode != 0
    assert "neither a file nor a folder" in result.stderr
    assert calls == []


def test_refuses_a_version_path_that_holds_files(tmp_path, endpoint, bucket, dist):
    bucket.put_object(Bucket=BUCKET, Key=PREFIX + "2026/t1/resumo/br.json", Body=b"earlier")

    result, calls = run_script(tmp_path, endpoint, dist)

    assert result.returncode != 0
    assert "already holds files" in result.stderr
    assert keys(bucket) == [PREFIX + "2026/t1/resumo/br.json"]
    assert not any(call.startswith("s3 cp") for call in calls)


def test_refuses_a_file_that_changed_after_the_build(tmp_path, endpoint, bucket, dist):
    changed = dist / listed_files(dist)[0]
    changed.write_bytes(changed.read_bytes() + b"\0")

    result, calls = run_script(tmp_path, endpoint, dist)

    assert result.returncode != 0
    assert listed_files(dist)[0] in result.stderr
    assert keys(bucket) == []
    assert calls == []


def test_refuses_same_size_corruption(tmp_path, endpoint, bucket, dist):
    changed = dist / listed_files(dist)[0]
    content = bytearray(changed.read_bytes())
    content[-1] ^= 0xFF
    changed.write_bytes(bytes(content))

    result, _ = run_script(tmp_path, endpoint, dist)

    assert result.returncode != 0
    assert "SHA-256" in result.stderr
    assert keys(bucket) == []


@pytest.mark.parametrize(
    "changes",
    [
        {"parcial": True},
        {"remove": ("parcial",)},
        {"fontes_tse": False},
        {"remove": ("fontes_tse",)},
    ],
    ids=["partial", "partial missing", "other sources", "sources missing"],
)
def test_refuses_a_build_that_cannot_be_published(tmp_path, endpoint, bucket, dist, changes):
    edit_manifest(dist, **changes)

    result, calls = run_script(tmp_path, endpoint, dist)

    assert result.returncode != 0
    assert keys(bucket) == []
    assert calls == []


def test_refuses_a_file_the_manifest_does_not_list(tmp_path, endpoint, bucket, dist):
    (dist / "2026" / "extra.json").write_text("{}")

    result, calls = run_script(tmp_path, endpoint, dist)

    assert result.returncode != 0
    assert "differ from the files the manifest lists" in result.stderr
    assert calls == []


def test_refuses_a_listed_file_that_is_missing(tmp_path, endpoint, bucket, dist):
    (dist / listed_files(dist)[-1]).unlink()

    result, calls = run_script(tmp_path, endpoint, dist)

    assert result.returncode != 0
    assert calls == []


@pytest.mark.parametrize(
    "version", ["../20261007-abc1234-42", "20261007-abc1234", "2026107-abc1234-42", "x"]
)
def test_refuses_a_malformed_version_id(tmp_path, endpoint, bucket, dist, version):
    result, calls = run_script(tmp_path, endpoint, dist, version)

    assert result.returncode != 0
    assert "version id" in result.stderr
    assert calls == []
