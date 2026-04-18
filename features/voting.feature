@governance @voting
Feature: Committee Voting on Submissions
  The governance agent facilitates two sequential votes for each submission:
  Vote 1 (Escalation) determines whether senior leadership must review.
  Vote 2 (Validation) determines the final outcome if not escalated.
  The agent never votes. It tallies, validates eligibility, and transitions state.

  Background:
    Given a committee of 5 members: "alice", "bob", "carol", "dan", "eve"
    And a submission "SUB-100" by submitter "frank"
    And the scoring phase for "SUB-100" is complete

  # ---------------------------------------------------------------------------
  # Vote 1: Escalation (Phase 3)
  # ---------------------------------------------------------------------------

  @gdoc-phase-3 @vote1
  Scenario: Valid escalation vote recorded from committee member
    When "alice" submits "/vote escalate" on "SUB-100"
    Then the agent records an escalation vote from "alice"
    And the agent confirms the vote with a reaction or reply

  @gdoc-phase-3 @vote1
  Scenario: Non-committee-member vote rejected
    Given "mallory" is not a committee member
    When "mallory" submits "/vote escalate" on "SUB-100"
    Then the agent rejects the vote
    And the agent replies that only committee members may vote

  @gdoc-phase-3 @vote1
  Scenario: Submitter cannot vote on own submission
    Given "frank" is a committee member
    When "frank" submits "/vote escalate" on "SUB-100"
    Then the agent rejects the vote
    And the agent replies that submitters cannot vote on their own submissions

  @gdoc-phase-3 @vote1 @quorum
  Scenario: Quorum not met after all available votes cast
    # Quorum = simple majority of committee = 3 of 5
    Given "alice" submits "/vote escalate" on "SUB-100"
    And "bob" submits "/vote no-escalate" on "SUB-100"
    And no further votes are cast within the voting window
    Then the agent reports that quorum has not been met
    And the agent does not force a decision
    And the submission remains in "vote-1-pending" state

  @gdoc-phase-3 @vote1
  Scenario: Escalation majority routes submission to senior leadership
    # Simple majority = 50% + 1 = 3 of 5
    When "alice" submits "/vote escalate" on "SUB-100"
    And "bob" submits "/vote escalate" on "SUB-100"
    And "carol" submits "/vote escalate" on "SUB-100"
    Then the agent tallies 3 escalate vs 0 no-escalate
    And the agent declares escalation carries by simple majority
    And the submission transitions to "escalated" state
    And the agent notifies senior leadership for review

  @gdoc-phase-3 @vote1
  Scenario: No-escalation majority advances submission to Vote 2
    When "alice" submits "/vote no-escalate" on "SUB-100"
    And "bob" submits "/vote no-escalate" on "SUB-100"
    And "carol" submits "/vote no-escalate" on "SUB-100"
    Then the agent tallies 0 escalate vs 3 no-escalate
    And the agent declares no-escalation carries by simple majority
    And the submission transitions to "vote-2-pending" state

  @gdoc-phase-3 @vote1 @amendment
  Scenario: Amended vote replaces previous vote from same member
    When "alice" submits "/vote escalate" on "SUB-100"
    And "alice" submits "/vote no-escalate" on "SUB-100"
    Then the agent records "alice" as voting "no-escalate"
    And the agent discards the earlier "escalate" vote from "alice"

  # ---------------------------------------------------------------------------
  # Escalation Triggers (Phase 2b) -- inform vote, do not bypass it
  # ---------------------------------------------------------------------------

  @gdoc-phase-2b @escalation-triggers
  Scenario: Donation category flagged but escalation still requires a vote
    # GDoc validation finding E-04: triggers INFORM the vote, do not bypass it
    Given submission "SUB-100" has category "Project Donation"
    And the agent flags "Project offered for donation to Foundation" as an escalation trigger
    Then the escalation trigger is visible to committee members during Vote 1
    But the submission is not automatically escalated
    And the submission remains in "vote-1-pending" state until votes are tallied

  @gdoc-phase-2b @escalation-triggers
  Scenario: Legal concern flagged as escalation trigger
    Given the scoring phase identifies "licensing concern" on "SUB-100"
    Then the agent flags "Legal, licensing, or IP concerns identified" as an escalation trigger
    And the trigger is recorded on "SUB-100" metadata
    But the submission is not automatically escalated

  @gdoc-phase-2b @escalation-triggers
  Scenario: Potential core asset flagged as escalation trigger
    Given scoring commentary on "SUB-100" notes "could become core Foundation infrastructure"
    Then the agent flags "May become core Foundation asset" as an escalation trigger
    But the submission is not automatically escalated

  @gdoc-phase-2b @escalation-triggers
  Scenario: Reputational risk flagged despite high score
    Given submission "SUB-100" has a total score of 23 out of 25
    And scoring commentary on "SUB-100" notes "reputational risk due to controversial maintainer"
    Then the agent flags "Reputational risk despite high overall score" as an escalation trigger
    But the submission is not automatically escalated

  # ---------------------------------------------------------------------------
  # Vote 2: Validation (Phase 4)
  # ---------------------------------------------------------------------------

  @gdoc-phase-4 @vote2
  Scenario: Vote 2 approve majority results in approval
    Given the submission "SUB-100" is in "vote-2-pending" state
    When "alice" submits "/vote approve" on "SUB-100"
    And "bob" submits "/vote approve" on "SUB-100"
    And "carol" submits "/vote approve" on "SUB-100"
    Then the agent tallies 3 approve, 0 approve-with-conditions, 0 decline, 0 defer
    And the agent declares the submission approved by simple majority
    And the submission transitions to "approved" state

  @gdoc-phase-4 @vote2
  Scenario: Vote 2 approve-with-conditions majority
    # GDoc Step 4, items 135-138
    Given the submission "SUB-100" is in "vote-2-pending" state
    When "alice" submits "/vote approve-with-conditions" on "SUB-100"
    And "bob" submits "/vote approve-with-conditions" on "SUB-100"
    And "carol" submits "/vote approve-with-conditions" on "SUB-100"
    Then the agent tallies 0 approve, 3 approve-with-conditions, 0 decline, 0 defer
    And the agent declares the submission approved with conditions
    And the submission transitions to "approved-with-conditions" state
    And the agent requests the committee to document the conditions

  @gdoc-phase-4 @vote2
  Scenario: Vote 2 decline majority closes the issue
    Given the submission "SUB-100" is in "vote-2-pending" state
    When "alice" submits "/vote decline" on "SUB-100"
    And "bob" submits "/vote decline" on "SUB-100"
    And "carol" submits "/vote decline" on "SUB-100"
    Then the agent tallies 0 approve, 0 approve-with-conditions, 3 decline, 0 defer
    And the agent declares the submission declined by simple majority
    And the submission transitions to "declined" state
    And the associated issue is closed

  @gdoc-phase-4 @vote2
  Scenario: Vote 2 defer majority notifies submitter
    Given the submission "SUB-100" is in "vote-2-pending" state
    When "alice" submits "/vote defer" on "SUB-100"
    And "bob" submits "/vote defer" on "SUB-100"
    And "carol" submits "/vote defer" on "SUB-100"
    Then the agent tallies 0 approve, 0 approve-with-conditions, 0 decline, 3 defer
    And the agent declares the submission deferred
    And the submission transitions to "deferred" state
    And the agent notifies the submitter "frank" of the deferral

  @gdoc-phase-4 @vote2 @SEC-010
  Scenario: Vote 2 tie defaults to deferred
    # Existing workflow SEC-010: ties default to DEFERRED
    Given the submission "SUB-100" is in "vote-2-pending" state
    And a committee of 4 eligible voters for this submission
    When "alice" submits "/vote approve" on "SUB-100"
    And "bob" submits "/vote decline" on "SUB-100"
    And "carol" submits "/vote approve" on "SUB-100"
    And "dan" submits "/vote decline" on "SUB-100"
    Then the agent tallies 2 approve, 0 approve-with-conditions, 2 decline, 0 defer
    And the agent declares a tie
    And the submission transitions to "deferred" state per SEC-010

  # ---------------------------------------------------------------------------
  # Conflict of Interest (Edge case J1)
  # ---------------------------------------------------------------------------

  @coi @edge-case-J1
  Scenario: Committee member declares conflict of interest
    Given "bob" is a contributor to the project in submission "SUB-100"
    When "bob" submits "/coi Contributor to this project" on "SUB-100"
    Then the agent records the conflict of interest declaration from "bob"
    And "bob" is recused from scoring on "SUB-100"
    And "bob" is recused from voting on "SUB-100"
    And the recusal is recorded in the submission audit log

  @coi @edge-case-J1
  Scenario: CoI abstention does not block quorum
    Given "bob" has declared a conflict of interest on "SUB-100"
    And the committee has 5 members
    # bob is recused, 4 eligible voters remain, quorum = 3 of 5
    # Abstention is recorded but does NOT reduce the quorum denominator
    When "alice" submits "/vote escalate" on "SUB-100"
    And "carol" submits "/vote escalate" on "SUB-100"
    And "dan" submits "/vote no-escalate" on "SUB-100"
    Then quorum is met with 3 votes cast out of 5 committee members
    And "bob" is listed as abstained due to conflict of interest

  @coi @edge-case-J1
  Scenario: Agent detects potential conflict of interest via shared organization
    Given "bob" is associated with organization "AcmeCorp" in the member graph
    And submission "SUB-100" submitter "frank" is associated with organization "AcmeCorp"
    Then the agent flags a potential conflict of interest for "bob"
    And the agent prompts "bob" to declare or dismiss the potential conflict

  @coi @edge-case-J1
  Scenario: CoI grounds include all specified relationships
    # Grounds: contributor, maintainer, co-founder, financially involved, professionally involved
    When "carol" submits "/coi Co-founder of the submitted project" on "SUB-100"
    Then the agent accepts the declaration
    And "carol" is recused from scoring and voting on "SUB-100"

  # ---------------------------------------------------------------------------
  # Agent behavior constraints
  # ---------------------------------------------------------------------------

  @agent-behavior
  Scenario: Agent never casts a vote
    Given the submission "SUB-100" is in "vote-1-pending" state
    Then the agent does not submit any vote on "SUB-100"
    And the agent only tallies, validates, and transitions state

  @agent-behavior @override
  Scenario: Committee override records divergence from score interpretation
    Given the submission "SUB-100" has a score of 14 out of 25
    And the score interpretation suggests "defer"
    When "alice" submits "/override Committee believes project has exceptional strategic value" on "SUB-100"
    Then the agent records the override rationale from "alice"
    And the override is visible in the submission audit log
    And voting proceeds normally with the override noted

  @agent-behavior @state-machine
  Scenario: Cannot vote before scoring phase is complete
    Given the scoring phase for "SUB-200" is not yet complete
    When "alice" submits "/vote escalate" on "SUB-200"
    Then the agent rejects the vote
    And the agent replies that voting cannot begin until scoring is complete
    And the submission "SUB-200" remains in "scoring" state
