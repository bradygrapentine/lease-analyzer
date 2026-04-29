#!/usr/bin/env bash
# scripts/flake-watch.sh — surface tests that flaked on main in the last 30 days.
#
# A "flake" here is a CI run on `main` that failed-then-passed via rerun
# (the runner-id appears twice in `gh run list` output, once with
# `conclusion=failure` and once with `conclusion=success`, on the same
# `headSha`). This script lists those SHAs and the failed-step output
# excerpts so flaky tests can be added to `app/src/test/known-flakes.md`.
#
# Usage:
#   scripts/flake-watch.sh
#
# Run weekly or on demand. Read-only against GitHub.

set -euo pipefail

DAYS="${DAYS:-30}"
LIMIT="${LIMIT:-100}"

echo "→ Scanning last $LIMIT ci runs on main for failed-then-passed retries..."

# Get all ci-workflow runs on main, including retries.
runs="$(gh run list \
  --workflow ci \
  --branch main \
  --limit "$LIMIT" \
  --json databaseId,headSha,conclusion,createdAt,attempt \
  --jq '.[] | "\(.headSha[:7]) \(.conclusion) attempt=\(.attempt) id=\(.databaseId) at=\(.createdAt)"')"

if [ -z "$runs" ]; then
  echo "(no runs found)"
  exit 0
fi

# Group by headSha. A SHA with both a failure and a later success is a flake.
declare -A sha_failures
declare -A sha_successes

while IFS= read -r line; do
  sha="$(echo "$line" | awk '{print $1}')"
  concl="$(echo "$line" | awk '{print $2}')"
  case "$concl" in
    failure) sha_failures[$sha]+="$line"$'\n' ;;
    success) sha_successes[$sha]+="$line"$'\n' ;;
  esac
done <<< "$runs"

flake_count=0
for sha in "${!sha_failures[@]}"; do
  if [ -n "${sha_successes[$sha]:-}" ]; then
    flake_count=$((flake_count + 1))
    echo ""
    echo "─── Flake on $sha ───"
    echo "Failures:"
    echo "${sha_failures[$sha]}" | sed 's/^/  /'
    echo "Successes (retry):"
    echo "${sha_successes[$sha]}" | sed 's/^/  /'
  fi
done

echo ""
if [ "$flake_count" -eq 0 ]; then
  echo "✓ No flakes detected in the last $LIMIT runs."
else
  echo "⚠ $flake_count flake(s) found. Inspect failed runs to identify the culprit test, add to app/src/test/known-flakes.md."
fi
