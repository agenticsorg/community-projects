@governance @gdoc-examples @integration
Feature: GDoc Scored Submission Examples (End-to-End)
  Four concrete submission examples from the governance GDoc (items 246-285)
  exercise the full pipeline: intake, scoring, escalation triggers, voting,
  and final outcome. Each scenario verifies that the agent drives the correct
  state transitions for a given archetype.

  Background:
    Given a committee of 5 members: "alice", "bob", "carol", "dan", "eve"
    And the governance agent is running
    And all committee members are eligible to score and vote

  # ---------------------------------------------------------------------------
  # Example 1: Agentic-Policy-Engine (GDoc items 246-256)
  # Archetype: "Strong candidate / Escalation-worthy"
  # ---------------------------------------------------------------------------

  @gdoc-example-1 @gdoc-phase-1 @gdoc-phase-2 @gdoc-phase-3
  Scenario: Agentic-Policy-Engine scores 21/25 and is escalated due to donation category
    # GDoc items 246-256
    # Category: Project Donation
    # Score: 21/25 (Mission:5, Quality:4, Clarity:5, Impact:4, Risk:3)
    # Flags: Donation category, potential core asset
    # Outcome: ESCALATED

    # Phase 1: Intake
    Given "frank" submits a new request for "Agentic-Policy-Engine"
    And the submission category is "Project Donation"
    And the submission description is "Policy engine for agentic systems with declarative rule definitions"
    Then the agent creates an issue for "Agentic-Policy-Engine"
    And the agent assigns the issue to the committee
    And the submission transitions to "scoring" state

    # Phase 2: Scoring
    When committee member "alice" scores "Agentic-Policy-Engine" with:
      | criterion          | score |
      | Mission & Values   | 5     |
      | Technical Quality  | 4     |
      | Documentation      | 5     |
      | Community Impact   | 4     |
      | Risk & Governance  | 3     |
    And committee member "bob" scores "Agentic-Policy-Engine" with:
      | criterion          | score |
      | Mission & Values   | 5     |
      | Technical Quality  | 4     |
      | Documentation      | 5     |
      | Community Impact   | 4     |
      | Risk & Governance  | 3     |
    And committee member "carol" scores "Agentic-Policy-Engine" with:
      | criterion          | score |
      | Mission & Values   | 5     |
      | Technical Quality  | 4     |
      | Documentation      | 5     |
      | Community Impact   | 4     |
      | Risk & Governance  | 3     |
    Then the agent calculates the consensus score as 21 out of 25

    # Phase 2b: Escalation triggers
    And the agent flags "Project offered for donation to Foundation" as an escalation trigger
    And the agent flags "May become core Foundation asset" as an escalation trigger

    # Phase 3: Vote 1 (Escalation)
    When the submission transitions to "vote-1-pending" state
    And "alice" submits "/vote escalate" on "Agentic-Policy-Engine"
    And "bob" submits "/vote escalate" on "Agentic-Policy-Engine"
    And "carol" submits "/vote escalate" on "Agentic-Policy-Engine"
    Then the agent tallies 3 escalate vs 0 no-escalate
    And the agent declares escalation carries by simple majority
    And the submission transitions to "escalated" state
    And the agent notifies senior leadership for review
    And the final outcome for "Agentic-Policy-Engine" is "ESCALATED"

  # ---------------------------------------------------------------------------
  # Example 2: Agentic-Log-Visualizer (GDoc items 257-268)
  # Archetype: "Solid / Approve locally"
  # ---------------------------------------------------------------------------

  @gdoc-example-2 @gdoc-phase-1 @gdoc-phase-2 @gdoc-phase-3 @gdoc-phase-4
  Scenario: Agentic-Log-Visualizer scores 19/25 and is approved without escalation
    # GDoc items 257-268
    # Category: Website Listing + Contributor Engagement (multi-category)
    # Score: 19/25 (Mission:4, Quality:4, Clarity:4, Impact:4, Risk:3)
    # No escalation flags
    # Outcome: APPROVED

    # Phase 1: Intake
    Given "grace" submits a new request for "Agentic-Log-Visualizer"
    And the submission category is "Website Listing, Contributor Engagement"
    And the submission description is "Interactive visualization tool for multi-agent system logs"
    Then the agent creates an issue for "Agentic-Log-Visualizer"
    And the agent assigns the issue to the committee
    And the submission transitions to "scoring" state

    # Phase 2: Scoring
    When committee member "alice" scores "Agentic-Log-Visualizer" with:
      | criterion          | score |
      | Mission & Values   | 4     |
      | Technical Quality  | 4     |
      | Documentation      | 4     |
      | Community Impact   | 4     |
      | Risk & Governance  | 3     |
    And committee member "bob" scores "Agentic-Log-Visualizer" with:
      | criterion          | score |
      | Mission & Values   | 4     |
      | Technical Quality  | 4     |
      | Documentation      | 4     |
      | Community Impact   | 4     |
      | Risk & Governance  | 3     |
    And committee member "carol" scores "Agentic-Log-Visualizer" with:
      | criterion          | score |
      | Mission & Values   | 4     |
      | Technical Quality  | 4     |
      | Documentation      | 4     |
      | Community Impact   | 4     |
      | Risk & Governance  | 3     |
    Then the agent calculates the consensus score as 19 out of 25

    # Phase 2b: No escalation triggers
    And the agent identifies no escalation triggers

    # Phase 3: Vote 1 (Escalation)
    When the submission transitions to "vote-1-pending" state
    And "alice" submits "/vote no-escalate" on "Agentic-Log-Visualizer"
    And "bob" submits "/vote no-escalate" on "Agentic-Log-Visualizer"
    And "carol" submits "/vote no-escalate" on "Agentic-Log-Visualizer"
    Then the agent tallies 0 escalate vs 3 no-escalate
    And the agent declares no-escalation carries by simple majority
    And the submission transitions to "vote-2-pending" state

    # Phase 4: Vote 2 (Validation)
    When "alice" submits "/vote approve" on "Agentic-Log-Visualizer"
    And "bob" submits "/vote approve" on "Agentic-Log-Visualizer"
    And "carol" submits "/vote approve" on "Agentic-Log-Visualizer"
    Then the agent tallies 3 approve, 0 approve-with-conditions, 0 decline, 0 defer
    And the agent declares the submission approved by simple majority
    And the submission transitions to "approved" state
    And the final outcome for "Agentic-Log-Visualizer" is "APPROVED"

  # ---------------------------------------------------------------------------
  # Example 3: Unnamed Multi-Agent System (GDoc items 269-278)
  # Archetype: "Weak / Defer"
  # ---------------------------------------------------------------------------

  @gdoc-example-3 @gdoc-phase-1 @gdoc-phase-2 @gdoc-phase-3 @gdoc-phase-4
  Scenario: Unnamed Multi-Agent System scores 12/25 and is deferred on clarity concerns
    # GDoc items 269-278
    # Category: Problem Support
    # Score: 12/25 (Mission:3, Quality:2, Clarity:2, Impact:3, Risk:2)
    # No escalation flags
    # Outcome: DEFERRED

    # Phase 1: Intake
    Given "hank" submits a new request for "Unnamed-Multi-Agent-System"
    And the submission category is "Problem Support"
    And the submission description is "Multi-agent coordination framework for distributed task execution"
    Then the agent creates an issue for "Unnamed-Multi-Agent-System"
    And the agent assigns the issue to the committee
    And the submission transitions to "scoring" state

    # Phase 2: Scoring
    When committee member "alice" scores "Unnamed-Multi-Agent-System" with:
      | criterion          | score |
      | Mission & Values   | 3     |
      | Technical Quality  | 2     |
      | Documentation      | 2     |
      | Community Impact   | 3     |
      | Risk & Governance  | 2     |
    And committee member "bob" scores "Unnamed-Multi-Agent-System" with:
      | criterion          | score |
      | Mission & Values   | 3     |
      | Technical Quality  | 2     |
      | Documentation      | 2     |
      | Community Impact   | 3     |
      | Risk & Governance  | 2     |
    And committee member "carol" scores "Unnamed-Multi-Agent-System" with:
      | criterion          | score |
      | Mission & Values   | 3     |
      | Technical Quality  | 2     |
      | Documentation      | 2     |
      | Community Impact   | 3     |
      | Risk & Governance  | 2     |
    Then the agent calculates the consensus score as 12 out of 25

    # Phase 2b: No escalation triggers
    And the agent identifies no escalation triggers

    # Phase 3: Vote 1 (Escalation)
    When the submission transitions to "vote-1-pending" state
    And "alice" submits "/vote no-escalate" on "Unnamed-Multi-Agent-System"
    And "bob" submits "/vote no-escalate" on "Unnamed-Multi-Agent-System"
    And "carol" submits "/vote no-escalate" on "Unnamed-Multi-Agent-System"
    Then the agent tallies 0 escalate vs 3 no-escalate
    And the agent declares no-escalation carries by simple majority
    And the submission transitions to "vote-2-pending" state

    # Phase 4: Vote 2 (Validation)
    When "alice" submits "/vote defer" on "Unnamed-Multi-Agent-System"
    And "bob" submits "/vote defer" on "Unnamed-Multi-Agent-System"
    And "carol" submits "/vote defer" on "Unnamed-Multi-Agent-System"
    Then the agent tallies 0 approve, 0 approve-with-conditions, 0 decline, 3 defer
    And the agent declares the submission deferred
    And the submission transitions to "deferred" state
    And the agent notifies the submitter "hank" of the deferral
    And the agent cites clarity and quality concerns in the deferral notice
    And the final outcome for "Unnamed-Multi-Agent-System" is "DEFERRED"

  # ---------------------------------------------------------------------------
  # Example 4: Agentic-Auto-Executor (GDoc items 279-285)
  # Archetype: "Retraction case"
  # ---------------------------------------------------------------------------

  @gdoc-example-4 @gdoc-phase-6 @retraction
  Scenario: Agentic-Auto-Executor is retracted after score degradation and conduct violation
    # GDoc items 279-285
    # Category: Previously approved, now retraction
    # Original score: assumed high (approved submission)
    # Re-score: 9/25 (Mission:2, Quality:2, Clarity:2, Impact:2, Risk:1)
    # Flags: Security concern, conduct violation
    # Outcome: RETRACTED

    # Setup: previously approved submission
    Given "ivan" previously submitted "Agentic-Auto-Executor"
    And "Agentic-Auto-Executor" was approved with an original score of 21 out of 25
    And the submission "Agentic-Auto-Executor" is in "approved" state

    # Phase 6: Retraction proposal
    When "alice" submits "/retract Security vulnerability exploited in production; maintainer violated code of conduct" on "Agentic-Auto-Executor"
    Then the agent accepts the retraction proposal
    And the agent records the grounds as "code-of-conduct-violation" and "legal-reputational-risk"
    And the submission "Agentic-Auto-Executor" transitions to "retraction-review" state

    # Re-scoring with original rubric
    When committee member "alice" re-scores "Agentic-Auto-Executor" with:
      | criterion          | score |
      | Mission & Values   | 2     |
      | Technical Quality  | 2     |
      | Documentation      | 2     |
      | Community Impact   | 2     |
      | Risk & Governance  | 1     |
    And committee member "bob" re-scores "Agentic-Auto-Executor" with:
      | criterion          | score |
      | Mission & Values   | 2     |
      | Technical Quality  | 2     |
      | Documentation      | 2     |
      | Community Impact   | 2     |
      | Risk & Governance  | 1     |
    And committee member "carol" re-scores "Agentic-Auto-Executor" with:
      | criterion          | score |
      | Mission & Values   | 2     |
      | Technical Quality  | 2     |
      | Documentation      | 2     |
      | Community Impact   | 2     |
      | Risk & Governance  | 1     |
    Then the agent calculates the re-score as 9 out of 25
    And the agent reports significant score degradation from 21 to 9

    # Retraction vote
    When "alice" submits "/vote retract" on "Agentic-Auto-Executor"
    And "bob" submits "/vote retract" on "Agentic-Auto-Executor"
    And "carol" submits "/vote retract" on "Agentic-Auto-Executor"
    And "dan" submits "/vote retract" on "Agentic-Auto-Executor"
    Then the agent tallies 4 retract vs 0 retain
    And the agent declares retraction carries by simple majority
    And the submission "Agentic-Auto-Executor" transitions to "retracted" state
    And the project is removed from the Foundation website
    And Foundation support is withdrawn
    And collaboration is terminated
    And the submitter "ivan" is notified of the retraction and grounds
    And the agent notes that conduct violations override technical merit
    And the final outcome for "Agentic-Auto-Executor" is "RETRACTED"
