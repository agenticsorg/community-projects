# RFC-001: Governance Agent for Open Source Committee

**Status:** Draft
**Author:** Michael O'Boyle
**Date:** 2026-04-17
**GDoc:** [Open Source Project Intake: Rules and Processes](https://docs.google.com/document/d/1-WCg3ArxhllUpdyk1tJu3bHkQf92tdUm0u80GDM0Vj4/edit)

---

## 1. Summary

This RFC proposes a governance agent that turns the Agentics Foundation's open source intake process from a static Google Doc into a living, auditable system. The agent treats each project submission as a case, guides committee members through scoring and voting with structured prompts, enforces procedural rules as a state machine, and accumulates institutional memory over time. All decisions remain with humans. The agent handles the clerical, procedural, and analytical work that currently falls through the cracks between a document and a set of GitHub Actions workflows.

---

## 2. Motivation

The Foundation's governance process is defined in a 296-element Google Doc. The `community-projects` repo implements six GitHub Actions workflows that parse slash commands, tally votes, and update a JSON registry. These workflows are correct and useful. They are also thin: they parse text, count votes, and apply labels. They do not read the process document. They cannot detect when a submission resembles a prior one, when a scorer has a conflict of interest, when a vote contradicts the quorum rules, or when the GDoc itself has changed.

The gap is between automation and agency:

| Automation (what exists) | Agency (what this RFC adds) |
|---|---|
| Parses `/score` commands | Validates scores against rubric, flags anomalies |
| Tallies votes | Enforces state transitions (cannot vote before scoring) |
| Applies labels | Posts a Case Brief with context before review begins |
| Updates registry on approval | Detects similarity to prior submissions |
| Handles retraction votes | Monitors approved projects for risk signals |
| Reacts to events | Maintains a knowledge graph of submissions, members, and decisions |

The agent does not replace the workflows. It layers intelligence on top of them. The workflows remain the thin event handlers. The agent provides the context, memory, and procedural enforcement that a human committee chair would provide if they had perfect recall and unlimited patience.

---

## 3. How It Works

Every submission is a **case**. The agent follows a six-phase cycle for each case:

### Perceive
A new issue arrives (or a comment, label change, or scheduled event). The agent reads the event and extracts structured data: submitter identity, repository URL, category, scores, votes.

### Relate
The agent connects the new information to existing knowledge. Who is the submitter? Have they submitted before? Does the repository overlap with an approved project? Does the scorer have commits in the submitted repo (potential CoI)? What did similar submissions score?

### Prepare
The agent drafts a response for human review. This could be a Case Brief, a score summary, a vote tally with quorum status, or a risk alert. The response always includes its reasoning and source references.

### Wait
The agent posts its prepared output and stops. It does not proceed to the next phase autonomously. Humans read, discuss, score, and vote. The agent observes but does not act until the next event.

### Record
After each human action, the agent updates the case file: new score recorded, vote cast, state transition applied. All state is written as JSON to `data/rvf/` and committed to git.

### Monitor
For approved projects, the agent periodically checks for risk signals: license changes, maintainer departure, repository archival, dependency vulnerabilities. Findings are posted as comments on the original submission issue.

---

## 4. Human-in-the-Loop Protocol

### 4.1 Submission Arrives

When a new issue is opened with the `status:pending-review` label, the agent posts a **Case Brief**:

```markdown
### Case Brief: [Project Name]

**Submitter:** @username (member since YYYY-MM-DD, N prior submissions)
**Repository:** github.com/org/repo (stars, license, last commit, open issues)
**Category:** Project Donation / Website Listing / Co-Founder Search / Problem Support / Contributor Engagement
**Description:** [500-char description from form]

#### Prior Submissions
- None / [links to similar prior cases with similarity scores]

#### Conflict of Interest Scan
- @member-a has 12 commits in this repo (must declare CoI per GDoc items 107-110)
- No other conflicts detected

#### Predicted Score Range
- Based on N prior submissions in this category: 14-19 (median 17)

#### Escalation Flags
- [ ] Project offered for donation (GDoc item 77)
- [ ] Legal/licensing/IP concerns (GDoc item 78)
- [x] May become core Foundation asset (GDoc item 79)
- [ ] Reputational risk despite high score (GDoc item 80)

Committee members: score with `/score mission:N quality:N clarity:N impact:N risk:N`
```

### 4.2 Scoring Phase

Committee members score using the existing `/score` command. The existing `scoring.yml` workflow parses and displays scores. The agent adds:

- **Validation:** Confirms each score is 0-5, all five criteria present (already handled by workflow). Additionally checks that the scorer is not flagged for CoI on this submission.
- **Running summary:** After each score, posts an updated aggregate (mean, range, interpretation band per GDoc items 71-75).
- **Anomaly detection:** If a score deviates more than 2 standard deviations from the mean on any criterion, flags it for discussion. Does not block.

Extended scoring syntax (optional, backward-compatible):

```
/score mission:4 quality:3 clarity:5 impact:4 risk:3 --flags donation,legal --recommend escalate --notes "Strong mission fit but IP transfer needs legal review"
```

The `--flags`, `--recommend`, and `--notes` parameters are recorded in the case file. They do not affect the workflow's existing behavior.

### 4.3 Vote 1: Escalation

After scoring is complete, any committee member can initiate the escalation vote. The agent posts a **Vote 1 Prompt**:

```markdown
### Vote 1: Escalation Determination

**Question (GDoc item 81):** Does this submission require escalation to
senior leadership of the Foundation?

**Scores:** 3 reviewers, mean 19.3/25 (range 17-21)
**Escalation flags present:** May become core Foundation asset
**GDoc guidance (items 83a-83c):** Escalation is most commonly expected for
project donation requests, governance/legal/IP considerations, and projects
that may become core Foundation assets.

Vote: `/vote escalate` or `/vote no-escalate`
Quorum: 3 votes required. Simple majority (50% + 1).
```

### 4.4 Vote 2: Validation

If not escalated, the agent posts a **Vote 2 Prompt**:

```markdown
### Vote 2: Validation Decision

**Question (GDoc item 87):** Should this request be approved and supported
by the Foundation?

**Scores:** mean 19.3/25 — Suggested outcome: Approve or approve with conditions
**Escalation vote:** Not escalated (2-4)

Vote: `/vote approve`, `/vote approve-with-conditions`, `/vote decline`, or `/vote defer`
Quorum: 3 votes required. Simple majority determines outcome.
Ties default to DEFERRED (per existing workflow logic).
```

Note: The `approve-with-conditions` outcome is specified in GDoc items 139 and 276 but is not currently implemented in the `validation-vote.yml` workflow. This RFC includes it.

### 4.5 Decision Recorded

After a vote reaches quorum, the agent:

1. Records the full decision in `data/rvf/cases/{issue-number}.json`
2. Signs an attestation (see Section 6)
3. Updates the submission knowledge graph
4. Posts a decision summary with GDoc references for the authority behind each step

---

## 5. Slash Commands

| Command | Phase | Description |
|---|---|---|
| `/score mission:N quality:N clarity:N impact:N risk:N` | Scoring | Submit scores (0-5 each). Existing workflow parses and displays. |
| `/score ... --flags F1,F2` | Scoring | Attach escalation flags: `donation`, `legal`, `core-asset`, `reputational` |
| `/score ... --recommend R` | Scoring | Attach recommendation: `escalate`, `approve`, `approve-with-conditions`, `defer`, `decline` |
| `/score ... --notes "text"` | Scoring | Attach reviewer notes (max 500 chars) |
| `/vote escalate` | Vote 1 | Vote to escalate to senior leadership |
| `/vote no-escalate` | Vote 1 | Vote against escalation |
| `/vote approve` | Vote 2 | Vote to approve |
| `/vote approve-with-conditions` | Vote 2 | Vote to approve with conditions (GDoc item 139) |
| `/vote decline` | Vote 2 | Vote to decline |
| `/vote defer` | Vote 2 | Vote to defer |
| `/vote retract` | Retraction | Vote to retract a previously approved project |
| `/vote no-retract` | Retraction | Vote against retraction |
| `/coi @member` | Any | Declare a conflict of interest for a member on this submission |
| `/retract` | Post-approval | Propose retraction of an approved project |
| `/override` | Any | Committee chair overrides the agent's state (logged, requires rationale) |
| `/status` | Any | Agent posts current case state, scores, votes, and next expected action |

All commands require `MEMBER`, `OWNER`, or `COLLABORATOR` association (enforced by existing workflows, extended to new commands).

---

## 6. Intelligence Layer (RVF)

RVF (Receive, Validate, File) is the agent's intelligence backend. It starts simple and deepens with experience. Every capability has a concrete activation threshold.

### Day 1 Capabilities

| Capability | Method | Spec Reference |
|---|---|---|
| **Procedural enforcement** | Finite state machine. States: `submitted`, `scoring`, `escalation-vote`, `validation-vote`, `approved`, `declined`, `deferred`, `retracted`. Transitions enforced by the agent. Invalid transitions (e.g., voting before scoring) are rejected with an explanation. | GDoc items 128-151 (Decision Flow) |
| **CoI detection** | Graph BFS over the submission knowledge graph. Checks: does the scorer have commits in the submitted repo? Are they listed as a contributor, maintainer, or co-founder? Financial/professional ties require manual `/coi` declaration. | GDoc items 107-110 |
| **Similarity search** | Cosine similarity on 384-dimensional embeddings of submission descriptions. Threshold: 0.75 flags "similar prior submission." Uses the same embedding model as the PKM pi-search index. | No GDoc equivalent (additive intelligence) |
| **Attestation** | Each decision is signed with an Ed25519 key. The signature covers: issue number, decision state, vote tally, timestamp, and the git SHA of the spec that authorized the transition. Signatures are stored in the case file. This is not blockchain. It is a tamper-evident audit trail. | GDoc items 178-180 (Records & Transparency) |

### ~20 Submissions

| Capability | Method | Activation |
|---|---|---|
| **Score prediction** | k-nearest neighbors (k=5) over prior case embeddings. Predicts score range per criterion and overall. Shown in Case Brief as "Predicted Score Range." | Requires 20+ scored submissions for meaningful neighbors |
| **Outcome correlation** | Track which score patterns lead to which outcomes. Surface in Case Brief: "Submissions in this score range were approved 80% of the time." | Same threshold |

### Any GDoc Change

| Capability | Method | Activation |
|---|---|---|
| **Drift detection** | Section-level embedding comparison between the current GDoc and the last-indexed version. If any section's cosine similarity drops below 0.90, the agent opens an issue: "GDoc Section X changed. Current spec may be stale." | Runs on monthly schedule or manual trigger |
| **Scenario generation** | For each detected drift, the agent proposes new Gherkin scenarios that would test the changed behavior. Posted as a comment on the drift issue. | Triggered by drift detection |

### ~30 Approved Projects

| Capability | Method | Activation |
|---|---|---|
| **Risk monitoring** | Weekly check of approved project repositories. Signals: license file changed or removed, no commits in 90 days, maintainer count dropped to zero, repository archived, new CVEs in dependencies. | Requires 30+ approved projects to justify the monitoring overhead |
| **Retraction recommendation** | If risk signals accumulate (2+ signals for a single project), the agent posts an advisory comment on the project's submission issue. It does not initiate retraction. A committee member must `/retract` manually. | Same threshold |

### State Storage

All RVF state lives as JSON files in `data/rvf/`, committed to git:

```
data/rvf/
  cases/
    001.json          # Case file for issue #1
    002.json
  graph/
    members.json      # Member profiles, submission history
    repos.json        # Repository metadata, CoI edges
    decisions.json    # Decision log with attestations
  embeddings/
    submissions.json  # Description embeddings for similarity
  drift/
    gdoc-baseline.json  # Last-indexed GDoc section embeddings
```

No external databases. No hosted services. Everything is in the repo, versioned, and auditable.

---

## 7. Constitutional Layer

The agent's spec is derived from the GDoc. It adds nothing beyond it. Every spec element carries a `gdoc_ref` mapping to the source document.

### Mapping Structure

```json
{
  "state_machine": {
    "submitted_to_scoring": {
      "gdoc_ref": ["item-132", "item-133"],
      "description": "Proceed to scoring after intake validation passes",
      "authority": "human_only"
    },
    "scoring_to_escalation_vote": {
      "gdoc_ref": ["item-135"],
      "description": "Move to escalation vote after scoring complete",
      "authority": "human_only"
    }
  }
}
```

### Constraints

1. **Every state transition maps to a GDoc item.** If a transition cannot be traced to the GDoc, it does not exist in the spec.
2. **Decision states carry `authority: human_only`.** The agent can transition between procedural states (e.g., marking scoring as complete when all reviewers have scored). It cannot transition between decision states (e.g., moving from `validation-vote` to `approved`). Only human votes do that.
3. **The spec is a subset of the GDoc, never a superset.** The agent enforces what the GDoc says. It does not invent rules. Where the GDoc is ambiguous (e.g., what happens if a retraction vote fails), the agent logs the ambiguity and defers to committee judgment.
4. **GDoc items 73-75 are respected:** "These ranges are guidance only. The committee may override outcomes with rationale." The agent's score interpretation is advisory. The `/override` command exists for exactly this purpose.

---

## 8. Nervous System (GitHub Actions)

The existing six workflows remain unchanged. This RFC adds event routing that connects those workflows to the agent's intelligence layer.

### Design Principle

Logic lives in the spec, not in the workflows. Workflows are thin event handlers that call the agent with structured payloads. The agent interprets the event, consults the spec, and produces a response.

### Event Map

| Event | Trigger | Workflow | Agent Action |
|---|---|---|---|
| Issue opened | `issues.opened` | `on-submission.yml` (existing) | Post Case Brief |
| Score comment | `issue_comment.created` starting with `/score` | `scoring.yml` (existing) | Validate, update aggregate, check CoI |
| Escalation vote | `issue_comment.created` starting with `/vote escalate` or `/vote no-escalate` | `escalation-vote.yml` (existing) | Enforce state (must be in scoring/escalation-vote phase), update case |
| Validation vote | `issue_comment.created` starting with `/vote approve/decline/defer` | `validation-vote.yml` (existing) | Enforce state (must be in validation-vote phase), update case, record attestation |
| Retraction proposed | `issue_comment.created` equal to `/retract` | `retraction.yml` (existing) | Post retraction context (original scores, current risk signals) |
| Retraction vote | `issue_comment.created` starting with `/vote retract` or `/vote no-retract` | `retraction.yml` (existing) | Update case, record attestation |
| CoI declaration | `issue_comment.created` starting with `/coi` | New: `coi.yml` | Record in graph, flag in case file |
| Status request | `issue_comment.created` equal to `/status` | New: `status.yml` | Post current case state |
| Override | `issue_comment.created` starting with `/override` | New: `override.yml` | Log override with rationale, transition state |
| Weekly monitor | `schedule: cron '0 9 * * 1'` | New: `monitor.yml` | Check approved project repos for risk signals |
| Monthly drift check | `schedule: cron '0 9 1 * *'` | New: `drift-check.yml` | Compare GDoc sections against baseline embeddings |

### New Workflows

The four new workflows (`coi.yml`, `status.yml`, `override.yml`, `monitor.yml`, `drift-check.yml`) follow the same patterns as the existing six: pinned action versions, `SEC-003` association checks, concurrency groups, rate limiting.

---

## 9. When the GDoc Changes

The GDoc is the source of truth. The spec is derived. When they diverge, the spec is wrong.

### Detection

1. Monthly (or on-demand), the agent fetches the GDoc via the Google Docs API.
2. It splits the document into sections using heading boundaries.
3. It computes embeddings for each section.
4. It compares each section embedding against the stored baseline in `data/rvf/drift/gdoc-baseline.json`.
5. Sections with cosine similarity below 0.90 are flagged as changed.

### Response

The agent does not self-amend. It:

1. Opens a GitHub issue titled "GDoc Drift Detected: [Section Name]"
2. Posts the old and new section text (diffed)
3. Proposes new Gherkin scenarios that would test the changed behavior
4. Labels the issue `governance:drift`
5. Waits for a committee member to review and either update the spec or confirm the spec is still aligned

### Why 0.90?

Cosmetic edits (typo fixes, formatting) produce similarity above 0.95. Substantive changes (new criteria, changed thresholds, added outcomes) produce similarity below 0.85. The 0.90 threshold catches meaningful changes while ignoring noise. It is configurable in the spec.

---

## 10. Build Method: Red-Green BDD

The first deliverable is not code. It is feature files.

### Approach

1. Write Gherkin feature files that specify every testable behavior of the governance process.
2. Run them. They all fail (red).
3. Implement the agent until they pass (green).
4. When the GDoc changes, write new scenarios first, then update the implementation.

### Feature Files

Five feature files covering the complete process:

#### `features/eligibility.feature`
Tests Phase 0 gates: member status, repository requirements, submission completeness. Tests decline-without-review for each failure mode. Tests the "Foundation reserves the right to decline" discretionary authority (GDoc item 9).

Example scenario:
```gherkin
Scenario: Non-member submission is declined without review
  Given a submission from a non-member
  When the agent processes the submission
  Then the issue is labeled "status:declined"
  And a comment explains that only registered members may submit
  And no Case Brief is posted
```

#### `features/scoring.feature`
Tests the scoring rubric: all five criteria, 0-5 range validation, score interpretation bands (GDoc items 71-74), the advisory disclaimer (GDoc item 75), aggregate calculation, anomaly detection, CoI checking during scoring, and the extended `--flags`/`--recommend`/`--notes` syntax.

Example scenario:
```gherkin
Scenario: Score with conflict of interest is flagged
  Given submission #5 from @alice
  And @bob has 15 commits in the submitted repository
  When @bob posts "/score mission:4 quality:3 clarity:5 impact:4 risk:3"
  Then the agent posts a CoI warning referencing GDoc items 107-110
  And the score is recorded but marked "coi-unresolved"
```

#### `features/voting.feature`
Tests both votes: escalation (GDoc items 81-85) and validation (GDoc items 86-91). Tests quorum enforcement, simple majority calculation, tie-breaks defaulting to deferred, submitter exclusion from voting (SEC-012), last-vote-wins for changed minds, the "approve-with-conditions" outcome (GDoc item 139), and state transition enforcement (cannot vote before scoring).

Example scenario:
```gherkin
Scenario: Validation vote with approve-with-conditions outcome
  Given submission #7 is in state "validation-vote"
  And 2 members vote "/vote approve-with-conditions"
  And 1 member votes "/vote approve"
  When quorum is reached
  Then the outcome is "APPROVED WITH CONDITIONS"
  And the issue is labeled "status:approved-with-conditions"
  And the case file records the conditions requirement
```

#### `features/retraction.feature`
Tests the retraction path: proposal, re-scoring, vote, outcomes (GDoc items 92-106). Tests retraction grounds enumeration, the maintainer-status-update safeguard (GDoc item 123), escalation of high-risk retractions (GDoc item 101), and registry update on retraction.

Example scenario:
```gherkin
Scenario: Retraction proposed for abandoned project triggers status check
  Given project #3 was approved 180 days ago
  And the project repository has had no commits in 120 days
  When a committee member posts "/retract"
  Then the agent posts the retraction proposal
  And the agent recommends requesting a maintainer status update
    before proceeding to vote (per GDoc item 123)
```

#### `features/gdoc-examples.feature`
Encodes the four example submissions from the GDoc (items 222-254) as executable scenarios. These serve as calibration tests: if the agent produces different outcomes than the GDoc examples, the implementation is wrong.

Example scenario:
```gherkin
Scenario: GDoc Example 1 - Agentic-Policy-Engine (Donation, Escalated)
  Given a submission with:
    | field       | value                                              |
    | category    | Project Donation to the Agentics Foundation         |
    | description | Policy enforcement engine for agentic systems...   |
  And scores of mission:5 quality:4 clarity:5 impact:4 risk:3 (total 21)
  And the escalation flag "donation" is present
  When the escalation vote passes 6-1
  Then the outcome is "ESCALATED"
  And the case is referred to senior leadership
  And no validation vote occurs
```

---

## 11. Design Constraints

1. **Humans decide.** The agent enforces process and provides context. It never casts a vote, approves a submission, or initiates a retraction. Every decision state carries `authority: human_only`.

2. **The spec adds nothing beyond the GDoc.** Every rule, threshold, and state transition traces to a specific GDoc item via `gdoc_ref`. If it is not in the GDoc, it is not in the spec. The intelligence layer (similarity search, score prediction, risk monitoring) is additive analysis, not additive authority.

3. **RVF is swappable.** The intelligence backend is behind an interface. Swap cosine similarity for BM25. Swap kNN for a linear model. Swap Ed25519 for HMAC. The agent's behavior does not change because its behavior is defined by the spec, not the backend.

4. **GitHub infrastructure only.** Issues, comments, labels, Actions, and git. No external databases, no hosted services, no paid APIs (beyond the Google Docs API for drift detection). A committee member with repo access can audit every decision by reading JSON files.

5. **Works for 1 or 1,000 submissions.** The first submission gets a Case Brief, procedural enforcement, and attestation. The thousandth submission additionally gets score prediction, similarity matching, and trend analysis. The system degrades gracefully to its Day 1 capabilities if the intelligence layer fails.

6. **The GDoc is the source of truth.** The spec is derived. When they diverge, the agent raises an issue and waits. It never self-amends its constitutional layer.

7. **Existing workflows are preserved.** The six current `.github/workflows/` files continue to function independently. The agent layers on top. If the agent is disabled, the manual slash-command workflow still works exactly as it does today.

---

## 12. Files in This PR

```
RFC-001-governance-agent.md          # This document

features/
  eligibility.feature                # Phase 0 gate tests
  scoring.feature                    # Scoring rubric and CoI tests
  voting.feature                     # Escalation and validation vote tests
  retraction.feature                 # Retraction process tests
  gdoc-examples.feature              # GDoc example submissions as scenarios

spec/
  governance-agent.json              # Agent specification (state machine,
                                     #   gdoc_ref mappings, RVF config)
  state-machine.json                 # State definitions and valid transitions

data/rvf/
  .gitkeep                           # Directory structure for case files,
                                     #   graph, embeddings, drift baselines

.github/workflows/
  coi.yml                            # CoI declaration handler
  status.yml                         # Case status reporter
  override.yml                       # Committee chair override handler
  monitor.yml                        # Weekly approved-project risk check
  drift-check.yml                    # Monthly GDoc drift detection
```

---

## Appendix A: GDoc Section Index

For reference, the `gdoc_ref` identifiers used throughout this RFC map to the exhaustive checklist of 296 discrete process elements extracted from the canonical Google Doc.

| Section | Items | Topic |
|---|---|---|
| A | 1-9 | Eligibility |
| B | 10-17 | Submission Form |
| C | 18-23 | Categories |
| D | 24-70 | Scoring Rubric |
| E | 71-75 | Score Interpretation |
| F | 76-80 | Escalation Triggers |
| G | 81-85 | Vote 1: Escalation |
| H | 86-91 | Vote 2: Validation |
| I | 92-106 | Retraction |
| J | 107-127 | Edge Cases |
| K | 128-151 | Decision Flow |
| L | 152-181 | Committee Charter |
| M | 182-189 | Committee Powers |
| N | 190-218 | Bylaws |
| O | 219-221 | Guiding Principles |
| P | 222-254 | Example Submissions |
| Q | 255-257 | Communication |
| R | 258-280 | Score Sheet Template |
| Supp. | 281-296 | Scope, Disclaimers, Records, Training |
