#!/usr/bin/env bash
# simulate-voting.sh -- Cast a governance vote on a submission issue.
#
# Usage: ./scripts/simulate-voting.sh <issue_number> <vote_type>
#
# Vote types (escalation phase):
#   escalate       - Vote to escalate to senior leadership
#   no-escalate    - Vote against escalation (proceed to validation)
#
# Vote types (validation phase):
#   approve        - Vote to approve the submission
#   decline        - Vote to decline the submission
#   defer          - Vote to defer (request more info)
#
# Vote types (retraction phase):
#   retract        - Vote to retract approval
#   no-retract     - Vote to keep the approval
#
# What happens:
#   The /vote command is picked up by the relevant workflow:
#   - escalation-vote.yml for escalate/no-escalate
#   - validation-vote.yml for approve/decline/defer
#   - retraction.yml for retract/no-retract
#
# Known limitations:
#   ALL voting workflows enforce SEC-012: the issue author cannot vote on
#   their own submission. Since both the issue and the comment are posted
#   by the same gh-authenticated user (the fork owner), votes will be
#   silently excluded from the tally.
#
#   To fully test the voting pipeline, you need either:
#   (a) Multiple GitHub accounts with collaborator access to the fork, OR
#   (b) A test-mode patch that disables the submitter check
#       (see simulate-full-lifecycle.sh for documentation)
#
#   Even without vote counting, posting /vote commands exercises:
#   - Workflow trigger detection
#   - Association checking (MEMBER/OWNER/COLLABORATOR)
#   - Comment parsing and tally generation
#   - Label management logic
#   - Rate limiting (SEC-008)

set -euo pipefail

REPO="michaeloboyle/community-projects"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <issue_number> <vote_type>"
  echo ""
  echo "Vote types:"
  echo "  Escalation: escalate, no-escalate"
  echo "  Validation: approve, decline, defer"
  echo "  Retraction: retract, no-retract"
  exit 1
fi

ISSUE="$1"
VOTE_TYPE="$2"

# Validate vote type
VALID_TYPES="escalate no-escalate approve decline defer retract no-retract"
if ! echo "$VALID_TYPES" | grep -qw "$VOTE_TYPE"; then
  echo "ERROR: Invalid vote type '$VOTE_TYPE'"
  echo "Valid types: $VALID_TYPES"
  exit 1
fi

COMMENT="/vote ${VOTE_TYPE}"

# Determine which workflow handles this vote
case "$VOTE_TYPE" in
  escalate|no-escalate)
    WORKFLOW="escalation-vote.yml"
    PHASE="Escalation"
    ;;
  approve|decline|defer)
    WORKFLOW="validation-vote.yml"
    PHASE="Validation"
    ;;
  retract|no-retract)
    WORKFLOW="retraction.yml"
    PHASE="Retraction"
    ;;
esac

echo "Posting vote on issue #${ISSUE} in ${REPO}..."
echo "  Vote: /vote ${VOTE_TYPE}"
echo "  Phase: ${PHASE}"
echo "  Workflow: ${WORKFLOW}"
echo ""

gh issue comment "$ISSUE" \
  --repo "$REPO" \
  --body "$COMMENT"

echo ""
echo "Vote posted. The ${WORKFLOW} workflow should respond within ~30 seconds."
echo ""
echo "NOTE: If you are the issue author, SEC-012 will exclude your vote from"
echo "the tally. The workflow will still fire and post a tally showing 0 votes."
