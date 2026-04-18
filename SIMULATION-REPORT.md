# Simulation Test Report

**Date:** 2026-04-18
**Branch:** feature/governance-agent
**Fork:** michaeloboyle/community-projects

## Summary

Ran 4 simulated project submissions through the governance system on the fork.
All core workflows executed successfully. Two bugs found and fixed during testing.

## Test Issues Created

| # | Scenario | Category | Score | Expected Outcome |
|---|----------|----------|-------|------------------|
| 1 | Agentic-Policy-Engine | donation | 21/25 | Escalated |
| 2 | Agentic-Log-Visualizer | website-listing | 19/25 | Approved |
| 3 | Multi-Agent Communication Framework | support | 12/25 | Deferred |
| 4 | Agentic-Auto-Executor | contributors | (retraction candidate) | Retracted |

## Workflow Results

### On Submission (triage)
- **4/4 PASS.** All issues received welcome comments and category labels.

### Governance Agent: Case Brief
- **4/4 PASS.** All issues received structured case briefs with:
  - Submission summary parsed from issue form
  - Similar prior submissions from seed embeddings (ranked by category match)
  - CoI analysis (none detected, since submitters aren't in seed graph)
  - Predicted score range (insufficient data, expected for first submissions)
- **Bug found:** Concurrent attestation commits caused merge conflicts on issues #3 and #4.
  - Root cause: Per-issue concurrency groups allowed parallel commits to same JSONL file.
  - Fix: Added 3-attempt retry loop with conflict resolution (commit `b8f0105`).
  - Case briefs were still posted even when the commit step failed.

### Scoring
- **3/3 PASS.** Score tables posted with correct totals and interpretation bands.
  - Issue #1: 21/25, "Strong candidate for approval or escalation"
  - Issue #2: 19/25, "Approve or approve with conditions" (from scoring workflow)
  - Issue #3: 12/25, "Defer or request clarification"
- `status:scoring` label applied automatically on all three.

### /status Command
- **PASS.** Returns structured status table with current labels, score count, vote count,
  CoI recusals, and pending actions. Correctly reported "2 more score(s) needed to reach quorum."
- **Bug found:** Initially suppressed by 60-second rate limiter. Fixed by reducing to 10s (commit `07bc071`).

### /coi Command
- **2/2 PASS.** Recusal recorded in both RVF graph (new edges) and attestation log.
  - Issue #1: "I am affiliated with Acme AI Labs, the submitting organization"
  - Issue #4: "I have a financial interest in the submitting organization"
- Graph correctly stores `recused_from` edges with timestamps and reasons.

### /override Command
- **PASS (rejection).** SEC-012 correctly blocked the issue submitter from overriding their own submission.

### /vote Command
- **Limited testing.** SEC-012 correctly excludes the issue author from voting.
  Since all issues were created by the fork owner (michaeloboyle), votes were excluded from tallies.
  The escalation-vote workflow posted tally with 0/3 votes, demonstrating correct submitter exclusion.
- **Full voting requires 3+ GitHub users with collaborator access.** This is a known limitation
  of single-user fork testing.

### Attestation Log
- **PASS.** 6 entries recorded across the simulation:
  1. Case brief transition for issue #1 (new -> case-brief-generated)
  2. Case brief transition for issue #2
  3. Self-vote blocked for michaeloboyle on issue #2 (SEC-012 audit)
  4. CoI recusal for michaeloboyle on issue #1
  5. CoI recusal for michaeloboyle on issue #4
  (Issues #3 and #4 case brief attestations lost to commit race condition, fixed in subsequent commits)

### RVF Graph
- **PASS.** Graph updated with 2 CoI recusal edges during simulation.

### Workflow Structural Validation
- **7/7 PASS.** All workflow files pass 49/49 structural checks (YAML syntax, triggers, jobs,
  no tabs, permissions block, pinned actions, name field).

## Local Test Suite
- **82/82 PASS.** All unit tests pass:
  - state-machine.test.js: 33 tests (all paths, guards, invalid transitions)
  - rvf.test.js: 20 tests (graph BFS, CoI detection, embeddings, attestation)
  - commands.test.js: 29 tests (score/vote/coi/override parsing and validation)

## Bugs Found and Fixed

| Bug | Severity | Root Cause | Fix |
|-----|----------|------------|-----|
| Attestation commit race condition | Medium | Per-issue concurrency groups allowed parallel commits to `attestation.jsonl` | Added 3-attempt retry loop with conflict resolution |
| /status and /coi responses suppressed | Low | 60-second rate limit window was too aggressive | Reduced to 10 seconds |

## Known Limitations

1. **Single-user voting.** SEC-012 prevents the issue author from voting on their own issue.
   Full voting flow requires 3+ distinct GitHub users with collaborator access.
2. **Scoring self-exclusion asymmetry.** The scoring workflow (`scoring.yml`) does not exclude
   submitters, but the governance agent logs a `self_vote_blocked` attestation. The mechanical
   workflow still posts the score table. This should be harmonized.
3. **Attestation loss on failed commits.** When the attestation commit fails, the case brief
   comment is still posted but the attestation entry is lost. The retry fix helps but does not
   guarantee delivery. A future improvement: store attestation in the issue comment itself as
   a fallback.

## What to Test Next (requires multiple collaborators)

- [ ] Full voting lifecycle: 3+ committee members score, vote escalation, vote validation
- [ ] Quorum enforcement: verify the system waits when quorum is not met
- [ ] Tie-breaking: verify ties default to DEFERRED
- [ ] Retraction lifecycle: approve a project, then propose and vote on retraction
- [ ] Concurrent voting: multiple votes arriving within seconds of each other
