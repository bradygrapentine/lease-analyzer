#!/usr/bin/env bash
# scripts/rebase-and-merge.sh — atomic rebase-then-merge for high-stakes PRs.
#
# Wave 49 introduced the gh-native merge path (gh pr merge --auto --squash)
# as the default; the up-to-date-branch requirement is no longer enforced
# by branch protection because squash merging makes it redundant. For PRs
# touching `app/src/security/`, `app/src/audit/`, or `app/src/storage/`,
# we still want rebase-before-merge so a semantic conflict is caught by
# *the rebase failing* rather than by post-merge `ci` blowing up on main.
#
# Use this script for those high-stakes PRs. The default merge path stays
# `gh pr merge --auto --squash --delete-branch`.
#
# Usage:
#   scripts/rebase-and-merge.sh [<pr-number>]
#
# If <pr-number> is omitted, infers from the current branch via gh pr view.

set -euo pipefail

if [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ]; then
  echo "error: refusing to run on main." >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
PR_NUM="${1:-$(gh pr view --json number --jq '.number' 2>/dev/null || true)}"
if [ -z "$PR_NUM" ]; then
  echo "error: could not infer PR number from branch '$BRANCH'. Pass it as the first argument." >&2
  exit 1
fi

echo "→ Fetching origin..."
git fetch origin --quiet

echo "→ Rebasing $BRANCH onto origin/main..."
if ! git rebase origin/main; then
  echo "error: rebase produced conflicts. Resolve them, then re-run this script." >&2
  exit 1
fi

echo "→ Force-pushing with lease..."
git push --force-with-lease origin "$BRANCH"

echo "→ Enabling auto-merge (squash) on PR #$PR_NUM..."
gh pr merge "$PR_NUM" --auto --squash --delete-branch

echo "✓ Done. PR #$PR_NUM will merge once CI is green."
