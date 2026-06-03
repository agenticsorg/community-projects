# Agentics Foundation Governance Agent -- Eligibility & Intake
# Source: Governance GDoc, Phase 0 (Eligibility & Access) and Phase 1 (Intake)
# Status: RED (no implementation)

@gdoc-phase-0 @gdoc-phase-1
Feature: Submission eligibility and intake
  As the governance agent
  I need to enforce eligibility gates and validate submissions
  So that only qualified, complete proposals reach the scoring phase

  # ──────────────────────────────────────────────────────────
  # Gate 1: Membership
  # GDoc Phase 0 -- submitter must be a registered Foundation
  # member in good standing. Failure here means immediate
  # decline without any further review.
  # ──────────────────────────────────────────────────────────

  @gdoc-phase-0 @gate-membership
  Scenario: Non-member submission is declined without review
    Given a submitter who is not a registered Foundation member
    When the submitter attempts to submit a project
    Then the submission is declined without review
    And the decline reason is "Submitter is not a registered Foundation member"

  @gdoc-phase-0 @gate-membership
  Scenario: Member not in good standing is declined without review
    Given a submitter who is a registered Foundation member
    And the submitter is not in good standing
    When the submitter attempts to submit a project
    Then the submission is declined without review
    And the decline reason is "Member is not in good standing"

  @gdoc-phase-0 @gate-membership
  Scenario: Member in good standing passes the membership gate
    Given a submitter who is a registered Foundation member
    And the submitter is in good standing
    When the submitter attempts to submit a project
    Then the submission passes the membership gate

  # ──────────────────────────────────────────────────────────
  # Gate 2: Project Requirements
  # GDoc Phase 0 -- public repo, declared license, mission
  # alignment, no illegal/malicious content, no IP infringement.
  # Failure here means immediate decline without review.
  # ──────────────────────────────────────────────────────────

  @gdoc-phase-0 @gate-project-requirements
  Scenario: Private repository is declined without review
    Given a valid Foundation member in good standing
    And the submitted repository is private
    When the submission is evaluated for project requirements
    Then the submission is declined without review
    And the decline reason is "Repository is not public"

  @gdoc-phase-0 @gate-project-requirements
  Scenario: Missing license is declined without review
    Given a valid Foundation member in good standing
    And the submitted repository has no declared license
    When the submission is evaluated for project requirements
    Then the submission is declined without review
    And the decline reason is "No license declared"

  @gdoc-phase-0 @gate-project-requirements
  Scenario: Project misaligned with Foundation mission is declined without review
    Given a valid Foundation member in good standing
    And the submitted project is not aligned with the Foundation mission, values, or Code of Conduct
    When the submission is evaluated for project requirements
    Then the submission is declined without review
    And the decline reason is "Project not aligned with Foundation mission, values, or Code of Conduct"

  @gdoc-phase-0 @gate-project-requirements
  Scenario: Project containing illegal content is declined without review
    Given a valid Foundation member in good standing
    And the submitted project contains illegal or malicious content
    When the submission is evaluated for project requirements
    Then the submission is declined without review
    And the decline reason is "Project contains illegal or malicious content"

  @gdoc-phase-0 @gate-project-requirements
  Scenario: Project with IP infringement is declined without review
    Given a valid Foundation member in good standing
    And the submitted project infringes on third-party intellectual property
    When the submission is evaluated for project requirements
    Then the submission is declined without review
    And the decline reason is "Project infringes on third-party intellectual property"

  @gdoc-phase-0 @gate-project-requirements
  Scenario: Project meeting all requirements passes the project requirements gate
    Given a valid Foundation member in good standing
    And the submitted repository is public
    And the submitted repository has a declared license
    And the submitted project is aligned with the Foundation mission, values, and Code of Conduct
    And the submitted project contains no illegal or malicious content
    And the submitted project does not infringe on third-party intellectual property
    When the submission is evaluated for project requirements
    Then the submission passes the project requirements gate

  # ──────────────────────────────────────────────────────────
  # Gate 3: Submission Completeness
  # GDoc Phase 1 -- all required fields must be present.
  # Required: full name, email, LinkedIn, GitHub profile,
  # repo URL, category, description (max 500 chars).
  # Failure here means immediate decline without review.
  # ──────────────────────────────────────────────────────────

  @gdoc-phase-1 @gate-completeness
  Scenario: Submission missing required fields is declined without review
    Given a valid Foundation member in good standing
    And the submitted project passes all project requirements
    And the submission is missing the "email" field
    When the submission is evaluated for completeness
    Then the submission is declined without review
    And the decline reason includes "Missing required field: email"

  @gdoc-phase-1 @gate-completeness
  Scenario: Submission missing multiple fields is declined with all missing fields listed
    Given a valid Foundation member in good standing
    And the submitted project passes all project requirements
    And the submission is missing the "LinkedIn" field
    And the submission is missing the "GitHub profile" field
    When the submission is evaluated for completeness
    Then the submission is declined without review
    And the decline reason includes "Missing required field: LinkedIn"
    And the decline reason includes "Missing required field: GitHub profile"

  @gdoc-phase-1 @gate-completeness
  Scenario: Submission with description exceeding 500 characters is declined
    Given a valid Foundation member in good standing
    And the submitted project passes all project requirements
    And the submission description is 501 characters long
    When the submission is evaluated for completeness
    Then the submission is declined without review
    And the decline reason includes "Description exceeds 500 character limit"

  @gdoc-phase-1 @gate-completeness
  Scenario: Fully complete submission passes the completeness gate
    Given a valid Foundation member in good standing
    And the submitted project passes all project requirements
    And the submission includes the following required fields:
      | field          | value                              |
      | full name      | Ada Lovelace                       |
      | email          | ada@example.org                    |
      | LinkedIn       | https://linkedin.com/in/ada        |
      | GitHub profile | https://github.com/ada             |
      | repo URL       | https://github.com/ada/my-project  |
      | category       | Project Donation                   |
      | description    | A concise project description.     |
    When the submission is evaluated for completeness
    Then the submission passes the completeness gate

  # ──────────────────────────────────────────────────────────
  # Sequential gate enforcement
  # Gates must run in order: membership, then project
  # requirements, then completeness. Failure at any gate
  # stops evaluation immediately.
  # ──────────────────────────────────────────────────────────

  @gdoc-phase-0 @gdoc-phase-1 @gate-sequence
  Scenario: Gates are evaluated sequentially and stop at first failure
    Given a submitter who is not a registered Foundation member
    And the submitted repository has no declared license
    And the submission is missing the "email" field
    When the submitter attempts to submit a project
    Then the submission is declined without review
    And the decline reason is "Submitter is not a registered Foundation member"
    And the project requirements gate is not evaluated
    And the completeness gate is not evaluated

  @gdoc-phase-0 @gdoc-phase-1 @gate-sequence
  Scenario: Valid member with complete submission proceeds to scoring
    Given a valid Foundation member in good standing
    And the submitted project passes all project requirements
    And the submission includes all required fields
    And the submission description is within the 500 character limit
    When the submission passes all three eligibility gates
    Then the submission proceeds to the scoring phase

  # ──────────────────────────────────────────────────────────
  # Submission Categories
  # GDoc Phase 1 -- five named categories, but the list is
  # explicitly "not limited to" these (Bylaws Article 10.3).
  # ──────────────────────────────────────────────────────────

  @gdoc-phase-1 @categories
  Scenario: Submission with a recognized category is accepted
    Given a valid Foundation member in good standing
    And the submitted project passes all project requirements
    And the submission includes all required fields
    And the submission category is "Project Donation"
    When the submission is evaluated for completeness
    Then the submission passes the completeness gate

  @gdoc-phase-1 @categories
  Scenario: All five standard categories are recognized
    Given the governance agent recognizes submission categories
    Then the following categories are valid:
      | category                 |
      | Project Donation         |
      | Website Listing          |
      | Co-Founder Search        |
      | Problem Support          |
      | Contributor Engagement   |

  # GDoc item 23: "Members may submit for one or more categories simultaneously"
  @gdoc-phase-1 @categories @gdoc-item-23
  Scenario: Multi-category submission is allowed
    Given a valid Foundation member in good standing
    And the submitted project passes all project requirements
    And the submission includes all required fields
    And the submission selects the following categories:
      | category                 |
      | Project Donation         |
      | Contributor Engagement   |
    When the submission is evaluated for completeness
    Then the submission passes the completeness gate
    And the submission is associated with 2 categories

  # Bylaws Article 10.3: categories are "not limited to" the five named ones
  @gdoc-phase-1 @categories @bylaws-10-3
  Scenario: Custom category outside the standard five is permitted
    Given a valid Foundation member in good standing
    And the submitted project passes all project requirements
    And the submission includes all required fields
    And the submission category is "Ecosystem Integration"
    When the submission is evaluated for completeness
    Then the submission passes the completeness gate

  # ──────────────────────────────────────────────────────────
  # Edge Cases
  # ──────────────────────────────────────────────────────────

  # GDoc: competing/overlapping projects may both be approved
  @gdoc-phase-1 @edge-case @competing-projects
  Scenario: Competing projects are evaluated independently without endorsement superiority
    Given two submissions exist for projects that solve the same problem
    And both submissions pass all three eligibility gates
    When both submissions proceed to the scoring phase
    Then each submission is scored independently
    And approval of one does not block or diminish the other

  # GDoc: commercially adjacent projects are permitted if license is clear
  @gdoc-phase-0 @edge-case @commercially-adjacent
  Scenario: Commercially adjacent project with clear OSS license passes project requirements
    Given a valid Foundation member in good standing
    And the submitted project has an open-source core with commercial extensions
    And the submitted repository has a declared license that clearly separates OSS and commercial components
    When the submission is evaluated for project requirements
    Then the submission passes the project requirements gate

  @gdoc-phase-0 @edge-case @commercially-adjacent
  Scenario: Commercially adjacent project with unclear license boundaries is declined
    Given a valid Foundation member in good standing
    And the submitted project has an open-source core with commercial extensions
    And the submitted repository has a declared license that does not clearly separate OSS and commercial components
    When the submission is evaluated for project requirements
    Then the submission is declined without review
    And the decline reason includes "License does not clearly separate open-source and commercial components"
