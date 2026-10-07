#!/usr/bin/env bash
# Uploads one built dataset to R2 as a new, immutable version: data files first, then
# manifest.json, so a version without a manifest is an incomplete one.
#
# Usage: upload-version.sh <dist dir> <version id>
# Reads R2_ENDPOINT, R2_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.
set -euo pipefail

usage="usage: upload-version.sh <dist dir> <version id>"
dist=${1:?$usage}
version=${2:?$usage}
: "${R2_ENDPOINT:?R2_ENDPOINT is not set}"
: "${R2_BUCKET:?R2_BUCKET is not set}"

# R2 has rejected the checksum headers that newer AWS CLI versions send by default. This
# script checks every file's SHA-256 against the manifest itself.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
export AWS_DEFAULT_REGION=auto
export AWS_PAGER=""

fail() {
  echo "upload-version: $*" >&2
  exit 1
}

# The Worker serves only keys whose segments use these characters.
safe_path='^[A-Za-z0-9_.=-]+(/[A-Za-z0-9_.=-]+)*$'

[[ $version =~ ^[0-9]{8}-[0-9a-f]{7,40}-[0-9]+$ ]] ||
  fail "the version id '$version' is not <YYYYMMDD>-<commit>-<run id>"
manifest="$dist/manifest.json"
[[ -f $manifest ]] || fail "$dist has no manifest.json"
[[ $(jq '.parcial' "$manifest") == false ]] ||
  fail "the manifest must say parcial: false, which means that the build covered every state"
[[ $(jq '.fontes_tse' "$manifest") == true ]] ||
  fail "the manifest must say fontes_tse: true, which means that every source came from TSE"

listed=$(jq -r '.arquivos[] | "\(.path) \(.size) \(.sha256)"' "$manifest" | LC_ALL=C sort)
[[ -n $listed ]] || fail "the manifest lists no files"

# Checks that <dir> holds exactly the manifest's data files, with their sizes and SHA-256.
check_files() {
  local dir=$1 what=$2 present path size sha256 actual
  present=$(cd "$dir" && find . -type f ! -path ./manifest.json | sed 's|^\./||' | LC_ALL=C sort)
  [[ $present == "$(cut -d' ' -f1 <<<"$listed")" ]] ||
    fail "$what differ from the files the manifest lists"
  while read -r path size sha256; do
    [[ $path =~ $safe_path && /$path/ != */../* && /$path/ != */./* ]] ||
      fail "the manifest lists '$path', which the Worker does not serve"
    actual=$(wc -c <"$dir/$path")
    [[ $((actual)) -eq $size ]] || fail "$what: $path has $((actual)) bytes, the manifest says $size"
    actual=$(sha256sum "$dir/$path" | cut -d' ' -f1)
    [[ $actual == "$sha256" ]] || fail "$what: the SHA-256 of $path differs from the manifest"
  done <<<"$listed"
}

check_files "$dist" "the built files"

prefix="v/$version"
# The backticks are JMESPath's literal syntax, not a shell expansion.
# shellcheck disable=SC2016
count_query='length(Contents || `[]`)'
existing=$(aws s3api list-objects-v2 --endpoint-url "$R2_ENDPOINT" --bucket "$R2_BUCKET" \
  --prefix "$prefix/" --max-keys 1 --no-paginate --query "$count_query" --output text)
[[ $existing == 0 ]] || fail "$prefix/ already holds files, and a version is never overwritten"

aws s3 cp "$dist" "s3://$R2_BUCKET/$prefix/" --recursive --exclude manifest.json \
  --endpoint-url "$R2_ENDPOINT" --only-show-errors

# Read the data back before the manifest makes the version complete.
readback=$(mktemp -d)
trap 'rm -rf "$readback"' EXIT
aws s3 cp "s3://$R2_BUCKET/$prefix/" "$readback" --recursive \
  --endpoint-url "$R2_ENDPOINT" --only-show-errors
check_files "$readback" "the files in R2"

aws s3 cp "$manifest" "s3://$R2_BUCKET/$prefix/manifest.json" \
  --endpoint-url "$R2_ENDPOINT" --only-show-errors

manifest_sha256=$(sha256sum "$manifest" | cut -d' ' -f1)
echo "Published $prefix/ with $(wc -l <<<"$listed" | tr -d ' ') data files."
echo "manifest.json SHA-256: $manifest_sha256"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  {
    echo "### Published data version"
    echo
    echo "- Version: \`$version\`"
    echo "- manifest.json SHA-256: \`$manifest_sha256\`"
  } >>"$GITHUB_STEP_SUMMARY"
fi
