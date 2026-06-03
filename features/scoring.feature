# Agentics Foundation Governance Agent -- Independent Scoring
# Source: Governance GDoc, Phase 2 (Independent Scoring), Internal Scoring Rubric
# Status: RED (no implementation)

@gdoc-phase-2
Feature: Independent scoring of submissions
  As the governance agent
  I need to enforce the scoring rubric and aggregate reviewer scores
  So that submissions are evaluated consistently and transparently

  Background:
    Given a submission that has passed all three eligibility gates
    And the submission has been assigned to the scoring phase

  # ──────────────────────────────────────────────────────────
  # Scoring Rubric: Five Criteria (0-5 each, max 25)
  # GDoc Internal Scoring Rubric, Section G
  # ──────────────────────────────────────────────────────────

  @gdoc-section-G @rubric
  Scenario: Valid score with all five criteria recorded
    Given a reviewer is assigned to score the submission
    When the reviewer submits scores for all five criteria:
      | criterion                    | score |
      | Mission & Values Alignment   | 4     |
      | Project Quality & Maturity   | 3     |
      | Clarity of Request           | 5     |
      | Community Impact             | 4     |
      | Risk & Governance            | 3     |
    Then the score sheet is accepted
    And the total score is 19

  @gdoc-section-G @rubric @validation
  Scenario: Score above maximum is rejected
    Given a reviewer is assigned to score the submission
    When the reviewer submits a score of 6 for "Mission & Values Alignment"
    Then the score is rejected
    And the rejection reason is "Score must be between 0 and 5"

  @gdoc-section-G @rubric @validation
  Scenario: Negative score is rejected
    Given a reviewer is assigned to score the submission
    When the reviewer submits a score of -1 for "Community Impact"
    Then the score is rejected
    And the rejection reason is "Score must be between 0 and 5"

  @gdoc-section-G @rubric @validation
  Scenario: Score sheet with missing criteria is rejected
    Given a reviewer is assigned to score the submission
    When the reviewer submits scores for only 4 of 5 criteria:
      | criterion                    | score |
      | Mission & Values Alignment   | 4     |
      | Project Quality & Maturity   | 3     |
      | Clarity of Request           | 5     |
      | Community Impact             | 4     |
    Then the score sheet is rejected
    And the rejection reason is "All five criteria must be scored"

  # ──────────────────────────────────────────────────────────
  # Criterion Definitions and Anchor Points
  # GDoc Internal Scoring Rubric
  # ──────────────────────────────────────────────────────────

  @gdoc-section-G @rubric @criterion-definitions
  Scenario: Mission and Values Alignment criterion uses correct anchor points
    Given the scoring rubric defines "Mission & Values Alignment"
    Then score 0 to 1 means "Misaligned with Foundation mission"
    And score 3 means "Generally aligned with Foundation mission"
    And score 5 means "Strongly reinforces Foundation mission"

  @gdoc-section-G @rubric @criterion-definitions
  Scenario: Project Quality and Maturity criterion uses correct anchor points
    Given the scoring rubric defines "Project Quality & Maturity"
    Then score 0 to 1 means "Incomplete or unclear"
    And score 3 means "Functional"
    And score 5 means "Production-ready"

  @gdoc-section-G @rubric @criterion-definitions
  Scenario: Clarity of Request criterion uses correct anchor points
    Given the scoring rubric defines "Clarity of Request"
    Then score 0 to 1 means "Vague"
    And score 3 means "Clear with limited detail"
    And score 5 means "Precise and actionable"

  @gdoc-section-G @rubric @criterion-definitions
  Scenario: Community Impact criterion uses correct anchor points
    Given the scoring rubric defines "Community Impact"
    Then score 0 to 1 means "Narrow or self-serving"
    And score 3 means "Useful to a subset of the community"
    And score 5 means "Broad, high-impact benefit"

  # GDoc: Risk & Governance is INVERTED (higher = less risk = better)
  @gdoc-section-G @rubric @criterion-definitions @inverted
  Scenario: Risk and Governance criterion is inverted
    Given the scoring rubric defines "Risk & Governance"
    Then score 0 to 1 means "High or unclear risk"
    And score 3 means "Manageable risk"
    And score 5 means "Minimal risk"
    And the criterion is marked as inverted scoring

  # ──────────────────────────────────────────────────────────
  # Score Interpretation Bands
  # GDoc: "Rubric is advisory, not mechanical"
  # These bands SUGGEST outcomes but do not determine them.
  # ──────────────────────────────────────────────────────────

  @gdoc-section-G @interpretation
  Scenario: Total score of 22 suggests strong candidate for approval
    Given a reviewer submits a complete score sheet with total 22
    Then the score interpretation band is "Strong candidate for approval or escalation"
    And the suggested score range is 21 to 25

  @gdoc-section-G @interpretation
  Scenario: Total score of 18 suggests approve or approve with conditions
    Given a reviewer submits a complete score sheet with total 18
    Then the score interpretation band is "Approve or approve with conditions"
    And the suggested score range is 16 to 20

  @gdoc-section-G @interpretation
  Scenario: Total score of 13 suggests defer or request clarification
    Given a reviewer submits a complete score sheet with total 13
    Then the score interpretation band is "Defer or request clarification"
    And the suggested score range is 11 to 15

  @gdoc-section-G @interpretation
  Scenario: Total score of 8 suggests decline
    Given a reviewer submits a complete score sheet with total 8
    Then the score interpretation band is "Decline"
    And the suggested score range is 0 to 10

  # GDoc: committee may override score interpretation with rationale
  @gdoc-section-G @interpretation @override
  Scenario: Committee overrides score interpretation with documented rationale
    Given a submission has an aggregate score of 9
    And the score interpretation band is "Decline"
    When the committee votes to approve the submission
    And the committee provides a rationale for overriding the score interpretation
    Then the submission decision is "Approve"
    And the override rationale is recorded
    And the original score interpretation is preserved for audit

  # ──────────────────────────────────────────────────────────
  # Score Sheet Fields: Flags
  # GDoc Internal Scoring Rubric -- per-reviewer flags
  # ──────────────────────────────────────────────────────────

  @gdoc-section-G @flags
  Scenario: Score with flags is recorded
    Given a reviewer is assigned to score the submission
    When the reviewer submits a complete score sheet with the following flags:
      | flag                       |
      | Donation/Stewardship       |
      | Legal/licensing concern    |
    Then the score sheet is accepted
    And the flags are recorded on the score sheet

  @gdoc-section-G @flags
  Scenario: All defined flag types are recognized
    Given the scoring rubric defines the following flags:
      | flag                       |
      | Donation/Stewardship       |
      | Legal/licensing concern    |
      | Reputational risk          |
      | Security/safety concern    |
      | Conflict of interest       |
    Then each flag can be set on a score sheet

  @gdoc-section-G @flags
  Scenario: Score sheet without flags is valid
    Given a reviewer is assigned to score the submission
    When the reviewer submits a complete score sheet with no flags
    Then the score sheet is accepted
    And no flags are recorded

  # ──────────────────────────────────────────────────────────
  # Score Sheet Fields: Recommendation
  # GDoc Internal Scoring Rubric
  # ──────────────────────────────────────────────────────────

  @gdoc-section-G @recommendation
  Scenario: Score with recommendation is recorded
    Given a reviewer is assigned to score the submission
    When the reviewer submits a complete score sheet
    And the reviewer selects recommendation "Approve with Conditions"
    Then the score sheet is accepted
    And the recommendation is "Approve with Conditions"

  @gdoc-section-G @recommendation
  Scenario: All defined recommendation types are recognized
    Given the scoring rubric defines the following recommendations:
      | recommendation           |
      | Escalate                 |
      | Approve                  |
      | Approve with Conditions  |
      | Defer                    |
      | Decline                  |
      | Retract                  |
    Then each recommendation can be selected on a score sheet

  # ──────────────────────────────────────────────────────────
  # Score Sheet Fields: Notes
  # GDoc Internal Scoring Rubric -- per-criterion notes
  # and general reviewer notes
  # ──────────────────────────────────────────────────────────

  @gdoc-section-G @notes
  Scenario: Score with per-criterion notes is recorded
    Given a reviewer is assigned to score the submission
    When the reviewer submits a complete score sheet with notes for each criterion:
      | criterion                    | note                                        |
      | Mission & Values Alignment   | Strong alignment with open-source principles |
      | Project Quality & Maturity   | Tests present but coverage below 60%         |
      | Clarity of Request           | Request is well-scoped                       |
      | Community Impact             | Addresses a gap in existing tooling           |
      | Risk & Governance            | No significant governance concerns            |
    Then the score sheet is accepted
    And notes are recorded for each criterion

  @gdoc-section-G @notes
  Scenario: Score with general reviewer notes is recorded
    Given a reviewer is assigned to score the submission
    When the reviewer submits a complete score sheet
    And the reviewer includes general notes "Recommend fast-tracking due to community demand"
    Then the score sheet is accepted
    And the reviewer notes field contains "Recommend fast-tracking due to community demand"

  @gdoc-section-G @notes
  Scenario: Score sheet without notes is valid
    Given a reviewer is assigned to score the submission
    When the reviewer submits a complete score sheet with no notes
    Then the score sheet is accepted

  # ──────────────────────────────────────────────────────────
  # Reviewer Independence and Aggregation
  # GDoc Phase 2 -- each reviewer scores independently.
  # Charter Section 9 -- individual scores are confidential,
  # only aggregates are shared.
  # ──────────────────────────────────────────────────────────

  @gdoc-phase-2 @independence
  Scenario: Each reviewer scores independently
    Given reviewer "Alice" is assigned to score the submission
    And reviewer "Bob" is assigned to score the submission
    When "Alice" submits her score sheet
    Then "Bob" cannot see Alice's individual scores
    And "Bob" scores the submission independently

  @gdoc-phase-2 @independence @aggregation
  Scenario: Multiple reviewers produce an aggregate score
    Given reviewer "Alice" submits a score sheet with total 20
    And reviewer "Bob" submits a score sheet with total 16
    And reviewer "Carol" submits a score sheet with total 22
    When all assigned reviewers have submitted scores
    Then the aggregate score is computed from all reviewer totals
    And individual reviewer scores are not disclosed

  # GDoc Charter Section 9: only aggregate scores shared
  @gdoc-phase-2 @charter-section-9 @confidentiality
  Scenario: Individual reviewer scores remain confidential
    Given reviewer "Alice" submits a score sheet with total 20
    And reviewer "Bob" submits a score sheet with total 16
    When the submission score summary is generated
    Then the summary includes the aggregate score
    And the summary does not include individual reviewer scores
    And the summary does not attribute scores to named reviewers

  # ──────────────────────────────────────────────────────────
  # Conflict of Interest
  # GDoc -- submitter cannot score their own submission
  # ──────────────────────────────────────────────────────────

  @gdoc-phase-2 @conflict-of-interest
  Scenario: Submitter cannot score their own submission
    Given "Alice" is the submitter of the submission
    When "Alice" is assigned as a reviewer for the same submission
    Then the assignment is rejected
    And the rejection reason is "Submitter cannot score their own submission"

  @gdoc-phase-2 @conflict-of-interest
  Scenario: Reviewer who declares a conflict of interest is recused
    Given reviewer "Bob" is assigned to score the submission
    When "Bob" declares a conflict of interest
    Then "Bob" is recused from scoring the submission
    And the conflict of interest flag is recorded
    And a replacement reviewer is required

  # ──────────────────────────────────────────────────────────
  # Score Total Calculation
  # ──────────────────────────────────────────────────────────

  @gdoc-section-G @calculation
  Scenario: Total score is the sum of all five criteria
    Given a reviewer submits the following scores:
      | criterion                    | score |
      | Mission & Values Alignment   | 5     |
      | Project Quality & Maturity   | 5     |
      | Clarity of Request           | 5     |
      | Community Impact             | 5     |
      | Risk & Governance            | 5     |
    Then the total score is 25

  @gdoc-section-G @calculation
  Scenario: Minimum possible total score is zero
    Given a reviewer submits the following scores:
      | criterion                    | score |
      | Mission & Values Alignment   | 0     |
      | Project Quality & Maturity   | 0     |
      | Clarity of Request           | 0     |
      | Community Impact             | 0     |
      | Risk & Governance            | 0     |
    Then the total score is 0

  @gdoc-section-G @calculation
  Scenario: Partial scores produce correct total
    Given a reviewer submits the following scores:
      | criterion                    | score |
      | Mission & Values Alignment   | 2     |
      | Project Quality & Maturity   | 1     |
      | Clarity of Request           | 3     |
      | Community Impact             | 0     |
      | Risk & Governance            | 4     |
    Then the total score is 10

  # ──────────────────────────────────────────────────────────
  # Boundary: Score Interpretation is Advisory
  # GDoc: "Rubric is advisory, not mechanical"
  # The score bands guide but do not dictate outcomes.
  # ──────────────────────────────────────────────────────────

  @gdoc-section-G @interpretation @advisory
  Scenario: Score interpretation band is advisory and does not automatically determine outcome
    Given a submission has an aggregate score of 22
    And the score interpretation band is "Strong candidate for approval or escalation"
    Then the committee is not required to approve the submission
    And the interpretation band is presented as guidance only

  @gdoc-section-G @interpretation @advisory
  Scenario: Low-scoring submission can be approved with rationale
    Given a submission has an aggregate score of 5
    And the score interpretation band is "Decline"
    When the committee votes to approve the submission
    And the committee documents the rationale as "Strategic value outweighs current maturity gaps"
    Then the submission decision is "Approve"
    And the override rationale is "Strategic value outweighs current maturity gaps"
    And the original aggregate score of 5 is preserved

  @gdoc-section-G @interpretation @advisory
  Scenario: High-scoring submission can be declined with rationale
    Given a submission has an aggregate score of 24
    And the score interpretation band is "Strong candidate for approval or escalation"
    When the committee votes to decline the submission
    And the committee documents the rationale as "Duplicate of existing Foundation project"
    Then the submission decision is "Decline"
    And the override rationale is "Duplicate of existing Foundation project"
    And the original aggregate score of 24 is preserved
