#!/usr/bin/env bash
# Uploads the DuckDB assets to R2 under a new, immutable path: the files first, then
# SHA256SUMS, after reading the files back.
#
# Usage: upload-asset.sh <dir> <package version>
# Reads R2_ENDPOINT, R2_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.
set -euo pipefail

usage="usage: upload-asset.sh <dir> <package version>"
dir=${1:?$usage}
version=${2:?$usage}
: "${R2_ENDPOINT:?R2_ENDPOINT is not set}"
: "${R2_BUCKET:?R2_BUCKET is not set}"

# R2 has rejected the checksum headers that newer AWS CLI versions send by default. This
# script checks every file's SHA-256 itself.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
export AWS_DEFAULT_REGION=auto
export AWS_PAGER=""

fail() {
  echo "upload-asset: $*" >&2
  exit 1
}

# The Worker serves only keys whose segments use these characters.
safe_path='^[A-Za-z0-9_.=-]+(/[A-Za-z0-9_.=-]+)*$'

[[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] ||
  fail "the package version '$version' is not a version number"
prefix="assets/duckdb-wasm/$version"
sums="$dir/SHA256SUMS"
[[ -f $sums ]] || fail "$dir has no SHA256SUMS"
listed=$(LC_ALL=C sort -k2 "$sums")
[[ -n $listed ]] || fail "SHA256SUMS lists no files"

# The list comes from the build job, which runs third-party code, so each line is checked
# for its form before any value is used.
while read -r sha256 path extra; do
  [[ -z ${extra:-} && $sha256 =~ ^[0-9a-f]{64}$ && $path =~ $safe_path ]] ||
    fail "SHA256SUMS has a malformed line"
  [[ /$path/ != */../* && /$path/ != */./* ]] || fail "SHA256SUMS lists '$path'"
done <<<"$listed"

check_files() {
  local folder=$1 what=$2 present sha256 path actual
  [[ -z $(find "$folder" ! -type f ! -type d) ]] ||
    fail "$what include an entry that is neither a file nor a folder"
  present=$(cd "$folder" && find . -type f ! -path ./SHA256SUMS | sed 's|^\./||' | LC_ALL=C sort)
  [[ $present == "$(awk '{print $2}' <<<"$listed")" ]] ||
    fail "$what differ from the files SHA256SUMS lists"
  while read -r sha256 path; do
    actual=$(sha256sum "$folder/$path" | cut -d' ' -f1)
    [[ $actual == "$sha256" ]] || fail "$what: the SHA-256 of $path differs from SHA256SUMS"
  done <<<"$listed"
}

check_files "$dir" "the staged files"

# The backticks are JMESPath's literal syntax, not a shell expansion.
# shellcheck disable=SC2016
count_query='length(Contents || `[]`)'
existing=$(aws s3api list-objects-v2 --endpoint-url "$R2_ENDPOINT" --bucket "$R2_BUCKET" \
  --prefix "$prefix/" --max-keys 1 --no-paginate --query "$count_query" --output text)
[[ $existing == 0 ]] || fail "$prefix/ already holds files, and an asset path is never overwritten"

aws s3 cp "$dir" "s3://$R2_BUCKET/$prefix/" --recursive --exclude SHA256SUMS \
  --no-follow-symlinks --endpoint-url "$R2_ENDPOINT" --only-show-errors

readback=$(mktemp -d)
trap 'rm -rf "$readback"' EXIT
aws s3 cp "s3://$R2_BUCKET/$prefix/" "$readback" --recursive \
  --endpoint-url "$R2_ENDPOINT" --only-show-errors
check_files "$readback" "the files in R2"

aws s3 cp "$sums" "s3://$R2_BUCKET/$prefix/SHA256SUMS" \
  --endpoint-url "$R2_ENDPOINT" --only-show-errors
echo "Published $prefix/ with $(wc -l <<<"$listed" | tr -d ' ') files."
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  {
    echo "### Published DuckDB assets"
    echo
    echo "- Path: \`$prefix/\`"
  } >>"$GITHUB_STEP_SUMMARY"
fi
