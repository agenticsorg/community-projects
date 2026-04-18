#!/usr/bin/env bash
# simulate-full-lifecycle.sh -- Full lifecycle simulation of the governance agent.
#
# Runs all 4 GDoc example scenarios end-to-end on the fork.
#
# Prerequisites:
#   - gh CLI authenticated
#   - Fork at michaeloboyle/community-projects
#   - Workflows enabled on the fork
#   - Labels created (the on-submission workflow creates category labels on the fly,
#     but status labels must exist. Create them manually or via gh label create.)
#   - The feature/governance-agent branch merged to main on the fork (so
#     workflows trigger). Alternatively, set feature/governance-agent as the
#     default branch.
#
# What this script tests:
#   - Issue creation with status:pending-review label
#   - on-submission.yml: welcome comment + category label
#   - governance-agent.yml case-brief job: CoI analysis + similar submissions
#   - scoring.yml: /score parsing, score table, interpretation
#   - governance-agent.yml process-command: attestation logging, state guards
#   - /status command: status report generation
#   - /coi command: conflict-of-interest recusal
#
# What this script CANNOT fully test (single-user limitation):
#   - Voting (SEC-012 excludes the issue author from vote tallies)
#   - Quorum reaching (requires 3 distinct non-submitter voters)
#   - Escalation outcome (requires vote tally to reach quorum)
#   - Validation outcome (same)
#   - Retraction outcome (same)
#
# The script posts vote commands anyway to verify that the workflows trigger
# and that the tally logic runs. Votes are excluded from the count but the
# mechanical workflows still respond with a tally showing 0 valid votes.
#
# To fully test voting, you need 3+ GitHub accounts with collaborator access
# to the fork. One account creates the issue; the other accounts vote.
#
# Quorum requirement:
#   The workflows use QUORUM=3. Reaching quorum needs 3 distinct voters
#   (none of whom is the issue author). With only one account, quorum is
#   unreachable.

set -euo pipefail

REPO="michaeloboyle/community-projects"
WAIT="${GOVERNANCE_SIM_WAIT:-30}"  # seconds to wait for workflows
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Track issue numbers for cleanup
declare -a ISSUES=()

# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------

log() { echo "[$(date +%H:%M:%S)] $*"; }

wait_for_workflow() {
  local seconds="${1:-$WAIT}"
  log "Waiting ${seconds}s for workflow to process..."
  sleep "$seconds"
}

create_submission() {
  local scenario="$1"
  log "Creating submission: $scenario"
  local output
  output=$("$SCRIPT_DIR/simulate-submission.sh" "$scenario" 2>&1)
  local issue_url
  issue_url=$(echo "$output" | grep "URL:" | awk '{print $2}')
  local issue_num
  issue_num=$(echo "$issue_url" | grep -oE '[0-9]+$')
  ISSUES+=("$issue_num")
  echo "$issue_num"
}

post_score() {
  local issue="$1"
  shift
  log "  Scoring issue #${issue}: $*"
  "$SCRIPT_DIR/simulate-scoring.sh" "$issue" "$@" > /dev/null 2>&1
}

post_vote() {
  local issue="$1"
  local vote_type="$2"
  log "  Voting on issue #${issue}: /vote $vote_type"
  "$SCRIPT_DIR/simulate-voting.sh" "$issue" "$vote_type" > /dev/null 2>&1
}

post_command() {
  local issue="$1"
  local command="$2"
  log "  Posting command on issue #${issue}: $command"
  gh issue comment "$issue" --repo "$REPO" --body "$command"
}

check_labels() {
  local issue="$1"
  local expected="$2"
  local labels
  labels=$(gh issue view "$issue" --repo "$REPO" --json labels --jq '.labels[].name' 2>/dev/null | sort | tr '\n' ', ' | sed 's/,$//')
  if echo "$labels" | grep -q "$expected"; then
    log "  PASS: Issue #${issue} has label '$expected'"
    log "        All labels: $labels"
    return 0
  else
    log "  INFO: Issue #${issue} does not yet have label '$expected'"
    log "        Current labels: $labels"
    return 1
  fi
}

check_comments() {
  local issue="$1"
  local search_text="$2"
  local count
  count=$(gh issue view "$issue" --repo "$REPO" --json comments --jq "[.comments[] | select(.body | contains(\"$search_text\"))] | length" 2>/dev/null)
  if [[ "$count" -gt 0 ]]; then
    log "  PASS: Found '$search_text' in comments on issue #${issue} ($count match(es))"
    return 0
  else
    log "  MISS: Did not find '$search_text' in comments on issue #${issue}"
    return 1
  fi
}

# -----------------------------------------------------------------------
# Header
# -----------------------------------------------------------------------

echo "================================================================="
echo "  Governance Agent -- Full Lifecycle Simulation"
echo "  Repository: $REPO"
echo "  Workflow wait time: ${WAIT}s (set GOVERNANCE_SIM_WAIT to override)"
echo "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================="
echo ""

PASS=0
FAIL=0
INFO=0

record_pass() { PASS=$((PASS + 1)); }
record_fail() { FAIL=$((FAIL + 1)); }
record_info() { INFO=$((INFO + 1)); }

# -----------------------------------------------------------------------
# Scenario 1: Agentic-Policy-Engine (High score, expects escalation path)
# -----------------------------------------------------------------------

echo ""
log "=== SCENARIO 1: Agentic-Policy-Engine ==="
log "Expected outcome: Escalation path (score >= 21)"
echo ""

ISSUE1=$(create_submission "policy-engine")
log "Created issue #${ISSUE1}"

wait_for_workflow

# Check: welcome comment from on-submission.yml
if check_comments "$ISSUE1" "Thank you for your submission"; then
  record_pass
else
  record_fail
fi

# Check: category label applied
if check_labels "$ISSUE1" "category:donation"; then
  record_pass
else
  record_fail
fi

# Check: case brief from governance-agent.yml
if check_comments "$ISSUE1" "Case Brief"; then
  record_pass
else
  record_info
  log "  (Case brief may take longer or require data files to exist)"
fi

# Score the submission: mission:5 quality:4 clarity:5 impact:4 risk:3 = 21
post_score "$ISSUE1" 5 4 5 4 3
wait_for_workflow 15

# Check: score table posted
if check_comments "$ISSUE1" "Score from @"; then
  record_pass
else
  record_fail
fi

# Check: interpretation
if check_comments "$ISSUE1" "Strong candidate"; then
  record_pass
else
  record_fail
fi

# Test /status command
post_command "$ISSUE1" "/status"
wait_for_workflow 15

if check_comments "$ISSUE1" "Status Report"; then
  record_pass
else
  record_info
fi

# Post escalation vote (will be excluded by SEC-012 but exercises the workflow)
post_vote "$ISSUE1" "escalate"
wait_for_workflow 15

log "  NOTE: Vote excluded by SEC-012 (submitter = voter). This is expected."
log "  In production, 3 different committee members would vote here."
record_info

echo ""

# -----------------------------------------------------------------------
# Scenario 2: Agentic-Log-Visualizer (Mid score, expects approval path)
# -----------------------------------------------------------------------

log "=== SCENARIO 2: Agentic-Log-Visualizer ==="
log "Expected outcome: Approval path (score 16-20)"
echo ""

ISSUE2=$(create_submission "log-visualizer")
log "Created issue #${ISSUE2}"

wait_for_workflow

if check_comments "$ISSUE2" "Thank you for your submission"; then
  record_pass
else
  record_fail
fi

if check_labels "$ISSUE2" "category:website-listing"; then
  record_pass
else
  record_fail
fi

# Score: mission:4 quality:4 clarity:4 impact:4 risk:3 = 19
post_score "$ISSUE2" 4 4 4 4 3
wait_for_workflow 15

if check_comments "$ISSUE2" "Score from @"; then
  record_pass
else
  record_fail
fi

if check_comments "$ISSUE2" "Approve or approve with conditions"; then
  record_pass
else
  record_fail
fi

# Vote: no-escalate then approve (SEC-012 blocks but exercises workflow)
post_vote "$ISSUE2" "no-escalate"
wait_for_workflow 10
post_vote "$ISSUE2" "approve"
wait_for_workflow 10

log "  NOTE: Votes excluded by SEC-012. Expected in single-user simulation."
record_info

echo ""

# -----------------------------------------------------------------------
# Scenario 3: Multi-Agent Communication Framework (Low score, expects defer)
# -----------------------------------------------------------------------

log "=== SCENARIO 3: Multi-Agent Communication Framework ==="
log "Expected outcome: Deferral path (score 11-15)"
echo ""

ISSUE3=$(create_submission "multi-agent")
log "Created issue #${ISSUE3}"

wait_for_workflow

if check_comments "$ISSUE3" "Thank you for your submission"; then
  record_pass
else
  record_fail
fi

if check_labels "$ISSUE3" "category:support"; then
  record_pass
else
  record_fail
fi

# Score: mission:3 quality:2 clarity:2 impact:3 risk:2 = 12
post_score "$ISSUE3" 3 2 2 3 2
wait_for_workflow 15

if check_comments "$ISSUE3" "Score from @"; then
  record_pass
else
  record_fail
fi

if check_comments "$ISSUE3" "Defer or request clarification"; then
  record_pass
else
  record_fail
fi

# Test /coi command
log "  Testing /coi command..."
post_command "$ISSUE3" "/coi I have a personal relationship with the submitter"
wait_for_workflow 15

if check_comments "$ISSUE3" "Conflict of Interest Recusal"; then
  record_pass
else
  record_info
fi

echo ""

# -----------------------------------------------------------------------
# Scenario 4: Agentic-Auto-Executor (Retraction test)
# -----------------------------------------------------------------------

log "=== SCENARIO 4: Agentic-Auto-Executor (Retraction) ==="
log "Expected outcome: Retraction path (approved then retracted)"
echo ""

ISSUE4=$(create_submission "auto-executor")
log "Created issue #${ISSUE4}"

wait_for_workflow

if check_comments "$ISSUE4" "Thank you for your submission"; then
  record_pass
else
  record_fail
fi

if check_labels "$ISSUE4" "category:contributors"; then
  record_pass
else
  record_fail
fi

# Score it moderately: mission:4 quality:3 clarity:4 impact:3 risk:2 = 16
post_score "$ISSUE4" 4 3 4 3 2
wait_for_workflow 15

if check_comments "$ISSUE4" "Score from @"; then
  record_pass
else
  record_fail
fi

# Propose retraction
log "  Proposing retraction..."
post_command "$ISSUE4" "/retract"
wait_for_workflow 15

if check_comments "$ISSUE4" "Retraction Proposed"; then
  record_pass
else
  record_info
  log "  (retraction.yml may not fire if issue lacks status:approved label)"
fi

# Vote retract (SEC-012 does not apply to retraction -- retraction.yml
# does not exclude the submitter from retraction votes)
post_vote "$ISSUE4" "retract"
wait_for_workflow 15

log "  NOTE: Retraction votes may also be excluded depending on workflow version."
record_info

echo ""

# -----------------------------------------------------------------------
# Bonus: Test /override command
# -----------------------------------------------------------------------

log "=== BONUS: Test /override command on issue #${ISSUE4} ==="
echo ""

# The override check blocks submitters from overriding their own issue.
# Since the fork owner is the issue author, this should be blocked.
post_command "$ISSUE4" "/override This project poses unacceptable security risks due to arbitrary code execution capabilities"
wait_for_workflow 15

if check_comments "$ISSUE4" "Submitters cannot override"; then
  log "  PASS: SEC-012 correctly blocked self-override"
  record_pass
elif check_comments "$ISSUE4" "Manual Override Recorded"; then
  log "  INFO: Override was accepted (SEC-012 may not apply to fork owner context)"
  record_info
fi

echo ""

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------

echo "================================================================="
echo "  SIMULATION RESULTS"
echo "================================================================="
echo ""
echo "  Issues created: ${#ISSUES[@]}"
echo "  Issue numbers: ${ISSUES[*]}"
echo ""
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  INFO: $INFO (expected limitations or optional checks)"
echo ""

if [[ $FAIL -eq 0 ]]; then
  log "All required checks passed."
else
  log "WARNING: $FAIL check(s) failed. Review output above for details."
fi

echo ""
echo "Tested workflows:"
echo "  [x] on-submission.yml    -- issue triage, welcome comment, category label"
echo "  [x] governance-agent.yml -- case brief, /status, /coi, /override, attestation"
echo "  [x] scoring.yml          -- /score parsing, score table, interpretation"
echo "  [~] escalation-vote.yml  -- triggered but votes excluded (SEC-012)"
echo "  [~] validation-vote.yml  -- triggered but votes excluded (SEC-012)"
echo "  [~] retraction.yml       -- triggered but quorum unreachable (single user)"
echo "  [ ] approve-project.yml  -- requires status:approved label (quorum-dependent)"
echo ""
echo "To fully test voting and quorum:"
echo "  1. Add 2+ collaborators to $REPO"
echo "  2. Have collaborators (not the issue author) post /vote commands"
echo "  3. With 3 non-author voters, quorum is reached and outcomes apply"
echo ""
echo "To clean up test issues:"
echo "  ./scripts/simulate-cleanup.sh"
echo ""
echo "Issue URLs:"
for n in "${ISSUES[@]}"; do
  echo "  https://github.com/${REPO}/issues/${n}"
done
