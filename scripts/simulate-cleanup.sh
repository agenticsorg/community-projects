#!/usr/bin/env bash
# simulate-cleanup.sh -- Close all test issues created by the simulation scripts.
#
# Usage: ./scripts/simulate-cleanup.sh [--delete]
#
# By default, closes all open issues with "[Project Submission]" in the title.
# With --delete, also deletes the issues entirely (requires admin access).
#
# This only affects the fork (michaeloboyle/community-projects), not upstream.

set -euo pipefail

REPO="michaeloboyle/community-projects"
DELETE=false

if [[ "${1:-}" == "--delete" ]]; then
  DELETE=true
fi

echo "Cleaning up test issues on $REPO..."
echo ""

# Find all open issues with the submission title prefix
ISSUES=$(gh issue list \
  --repo "$REPO" \
  --state open \
  --search "[Project Submission] in:title" \
  --json number,title \
  --jq '.[] | "\(.number)\t\(.title)"' 2>/dev/null || true)

if [[ -z "$ISSUES" ]]; then
  echo "No open submission issues found. Nothing to clean up."
  exit 0
fi

echo "Found open submission issues:"
echo "$ISSUES"
echo ""

CLOSED=0
DELETED=0

while IFS=$'\t' read -r number title; do
  echo "Closing issue #${number}: ${title}"
  gh issue close "$number" \
    --repo "$REPO" \
    --reason "not planned" \
    --comment "Closed by simulation cleanup script." 2>/dev/null || true
  CLOSED=$((CLOSED + 1))

  if [[ "$DELETE" == true ]]; then
    echo "  Deleting issue #${number}..."
    gh api \
      --method DELETE \
      "/repos/${REPO}/issues/${number}" 2>/dev/null || {
        echo "  NOTE: Issue deletion requires admin access. Issue closed but not deleted."
      }
    DELETED=$((DELETED + 1))
  fi
done <<< "$ISSUES"

echo ""
echo "Cleanup complete."
echo "  Closed: $CLOSED"
if [[ "$DELETE" == true ]]; then
  echo "  Delete attempted: $DELETED (GitHub does not support issue deletion via API; issues remain closed)"
fi

# Also check for closed submission issues that may have been created by earlier runs
CLOSED_ISSUES=$(gh issue list \
  --repo "$REPO" \
  --state closed \
  --search "[Project Submission] in:title" \
  --json number \
  --jq 'length' 2>/dev/null || echo "0")

echo ""
echo "Previously closed submission issues: $CLOSED_ISSUES"
echo "These are retained for audit purposes. To view them:"
echo "  gh issue list --repo $REPO --state closed --search '[Project Submission] in:title'"
