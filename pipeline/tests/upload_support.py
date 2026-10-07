"""The local S3 server and the `aws` shim that the upload script tests share."""

import os
import shutil
import socket
import subprocess
from pathlib import Path

import boto3
import pytest
from moto.server import ThreadedMotoServer

BUCKET = "eleicoes-data"
REAL_AWS = shutil.which("aws")


@pytest.fixture(scope="module")
def endpoint():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    server = ThreadedMotoServer(ip_address="127.0.0.1", port=port, verbose=False)
    server.start()
    yield f"http://127.0.0.1:{port}"
    server.stop()


@pytest.fixture
def bucket(endpoint):
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name="us-east-1",
        aws_access_key_id="testing",
        aws_secret_access_key="testing",
    )
    client.create_bucket(Bucket=BUCKET)
    yield client
    for item in client.list_objects_v2(Bucket=BUCKET).get("Contents", []):
        client.delete_object(Bucket=BUCKET, Key=item["Key"])
    client.delete_bucket(Bucket=BUCKET)


def keys(bucket) -> list[str]:
    return sorted(item["Key"] for item in bucket.list_objects_v2(Bucket=BUCKET).get("Contents", []))


# Records each call. FAIL_CALL makes a matching call fail without running, like an interrupted
# upload. TAMPER_KEY overwrites that object right after the call that matches TAMPER_AFTER.
SHIM = """#!/bin/sh
printf '%s\\n' "$*" >> "$AWS_CALL_LOG"
if [ -n "$FAIL_CALL" ]; then
  case "$*" in *"$FAIL_CALL"*) exit 1 ;; esac
fi
"$REAL_AWS" "$@" || exit
if [ -n "$TAMPER_KEY" ]; then
  case "$*" in *"$TAMPER_AFTER"*)
    printf tampered | "$REAL_AWS" s3 cp - "s3://$R2_BUCKET/$TAMPER_KEY" \\
      --endpoint-url "$R2_ENDPOINT" --only-show-errors ;;
  esac
fi
"""


def run_upload(script: Path, tmp_path: Path, endpoint: str, args: list[str], **extra_env):
    """Runs an upload script with the `aws` shim first on PATH."""
    shim_dir = tmp_path / "bin"
    shim_dir.mkdir(exist_ok=True)
    shim = shim_dir / "aws"
    shim.write_text(SHIM)
    shim.chmod(0o755)
    calls = tmp_path / "aws-calls.log"
    calls.touch()
    env = {
        "PATH": f"{shim_dir}{os.pathsep}{os.environ['PATH']}",
        "HOME": str(tmp_path),
        "AWS_CONFIG_FILE": str(tmp_path / "no-aws-config"),
        "AWS_SHARED_CREDENTIALS_FILE": str(tmp_path / "no-aws-credentials"),
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "AWS_CALL_LOG": str(calls),
        "REAL_AWS": REAL_AWS or "aws",
        "R2_ENDPOINT": endpoint,
        "R2_BUCKET": BUCKET,
        **extra_env,
    }
    result = subprocess.run(
        ["bash", str(script), *args],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    return result, calls.read_text().splitlines()
