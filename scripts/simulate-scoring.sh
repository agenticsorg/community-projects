#!/usr/bin/env bash
# simulate-scoring.sh -- Post a /score command on a submission issue.
#
# Usage: ./scripts/simulate-scoring.sh <issue_number> <mission> <quality> <clarity> <impact> <risk> [--flags <flags>] [--recommend <rec>]
#
# Arguments:
#   issue_number  - The GitHub issue number to score
#   mission       - Mission & Values Alignment score (0-5)
#   quality       - Project Quality & Maturity score (0-5)
#   clarity       - Clarity of Request score (0-5)
#   impact        - Community Impact score (0-5)
#   risk          - Risk & Governance (inverse) score (0-5)
#
# Optional flags:
#   --flags <flags>  - Flag string, e.g. "license-review,security-review"
#   --recommend <rec> - Recommendation note appended after the score
#
# Example:
#   ./scripts/simulate-scoring.sh 42 5 4 5 4 3
#   ./scripts/simulate-scoring.sh 42 3 2 2 3 2 --flags "early-stage" --recommend "Needs more maturity"
#
# What happens:
#   1. Posts a /score comment that scoring.yml parses
#   2. scoring.yml responds with a formatted score table
#   3. governance-agent.yml records the attestation
#
# Known limitations:
#   - governance-agent.yml (SEC-012) blocks submitters from scoring their own
#     issue. Since gh posts as the fork owner (who also created the issue),
#     the governance-agent will log a self_vote_blocked attestation entry.
#   - The scoring.yml workflow does NOT enforce this restriction, so the
#     score table will still be posted by scoring.yml.
#   - In production, different committee members would score from their own accounts.

set -euo pipefail

REPO="michaeloboyle/community-projects"

if [[ $# -lt 6 ]]; then
  echo "Usage: $0 <issue_number> <mission> <quality> <clarity> <impact> <risk> [--flags <flags>] [--recommend <rec>]"
  echo ""
  echo "Each score must be 0 to 5."
  exit 1
fi

ISSUE="$1"
MISSION="$2"
QUALITY="$3"
CLARITY="$4"
IMPACT="$5"
RISK="$6"
shift 6

# Parse optional arguments
FLAGS=""
RECOMMEND=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --flags)
      FLAGS="$2"
      shift 2
      ;;
    --recommend)
      RECOMMEND="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate scores are 0-5
for score_name in MISSION QUALITY CLARITY IMPACT RISK; do
  val="${!score_name}"
  if ! [[ "$val" =~ ^[0-5]$ ]]; then
    echo "ERROR: $score_name must be 0-5 (got '$val')"
    exit 1
  fi
done

TOTAL=$((MISSION + QUALITY + CLARITY + IMPACT + RISK))

# Build the score comment
COMMENT="/score mission:${MISSION} quality:${QUALITY} clarity:${CLARITY} impact:${IMPACT} risk:${RISK}"

if [[ -n "$FLAGS" ]]; then
  COMMENT="${COMMENT} flags:${FLAGS}"
fi

if [[ -n "$RECOMMEND" ]]; then
  COMMENT="${COMMENT}
${RECOMMEND}"
fi

echo "Posting score on issue #${ISSUE} in ${REPO}..."
echo "  Score: mission:${MISSION} quality:${QUALITY} clarity:${CLARITY} impact:${IMPACT} risk:${RISK}"
echo "  Total: ${TOTAL}/25"
if [[ -n "$FLAGS" ]]; then
  echo "  Flags: ${FLAGS}"
fi
if [[ -n "$RECOMMEND" ]]; then
  echo "  Recommend: ${RECOMMEND}"
fi
echo ""

gh issue comment "$ISSUE" \
  --repo "$REPO" \
  --body "$COMMENT"

echo ""
echo "Score posted. The scoring.yml workflow should respond within ~30 seconds."
echo ""
echo "Interpretation:"
if [[ $TOTAL -ge 21 ]]; then
  echo "  Total ${TOTAL}/25 -> Strong candidate for approval or escalation"
elif [[ $TOTAL -ge 16 ]]; then
  echo "  Total ${TOTAL}/25 -> Approve or approve with conditions"
elif [[ $TOTAL -ge 11 ]]; then
  echo "  Total ${TOTAL}/25 -> Defer or request clarification"
else
  echo "  Total ${TOTAL}/25 -> Decline"
fi
