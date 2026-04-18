@governance @retraction @gdoc-phase-6
Feature: Ongoing Review and Retraction of Approved Submissions
  After a submission is approved, it enters an ongoing review lifecycle.
  Any committee member may propose retraction on specific grounds.
  The project is re-scored using the original rubric, and a retraction vote
  determines the outcome. This is a separate lifecycle from initial review.

  Background:
    Given a committee of 5 members: "alice", "bob", "carol", "dan", "eve"
    And a previously approved submission "SUB-200" by submitter "frank"
    And the submission "SUB-200" is in "approved" state

  # ---------------------------------------------------------------------------
  # Retraction Proposals (5 grounds from GDoc items 90-94)
  # ---------------------------------------------------------------------------

  @retraction-proposal @ground-1
  Scenario: Valid retraction proposal for code of conduct violation
    # GDoc item 90: Violation of Foundation's code of conduct or values
    When "alice" submits "/retract Violation of Foundation's code of conduct or values" on "SUB-200"
    Then the agent accepts the retraction proposal
    And the agent records the grounds as "code-of-conduct-violation"
    And the submission "SUB-200" transitions to "retraction-review" state
    And the agent notifies the committee that a retraction review is underway

  @retraction-proposal @ground-2
  Scenario: Valid retraction proposal for license misrepresentation
    # GDoc item 91: Misrepresentation of project or its licensing
    When "bob" submits "/retract Misrepresentation of project licensing: claimed Apache-2.0 but contains GPL components" on "SUB-200"
    Then the agent accepts the retraction proposal
    And the agent records the grounds as "license-misrepresentation"
    And the submission "SUB-200" transitions to "retraction-review" state

  @retraction-proposal @ground-3
  Scenario: Valid retraction proposal for abandoned project with community impact
    # GDoc item 92: Inactive/abandoned maintenance impacting community trust
    When "carol" submits "/retract Project abandoned for 18 months, unpatched CVEs affecting downstream users" on "SUB-200"
    Then the agent accepts the retraction proposal
    And the agent records the grounds as "abandoned-maintenance"
    And the submission "SUB-200" transitions to "retraction-review" state

  @retraction-proposal @ground-4
  Scenario: Valid retraction proposal for legal or reputational risk
    # GDoc item 93: Legal, ethical, or reputational risk to Foundation
    When "dan" submits "/retract Active lawsuit against maintainer raises reputational risk" on "SUB-200"
    Then the agent accepts the retraction proposal
    And the agent records the grounds as "legal-reputational-risk"
    And the submission "SUB-200" transitions to "retraction-review" state

  @retraction-proposal @ground-5
  Scenario: Valid retraction proposal for loss of membership standing
    # GDoc item 94: Loss of membership standing by submitting member
    When "eve" submits "/retract Submitter's Foundation membership revoked" on "SUB-200"
    Then the agent accepts the retraction proposal
    And the agent records the grounds as "membership-standing-lost"
    And the submission "SUB-200" transitions to "retraction-review" state

  @retraction-proposal @authorization
  Scenario: Retraction proposal from non-committee-member rejected
    Given "mallory" is not a committee member
    When "mallory" submits "/retract Code of conduct violation" on "SUB-200"
    Then the agent rejects the retraction proposal
    And the agent replies that only committee members may propose retractions

  # ---------------------------------------------------------------------------
  # Re-scoring (GDoc items 102-106)
  # ---------------------------------------------------------------------------

  @retraction-rescoring
  Scenario: Re-scoring uses original rubric with emphasis on risk and values
    # GDoc items 102-106: emphasis on Risk & Governance, Mission & Values, Ongoing Quality
    Given the submission "SUB-200" is in "retraction-review" state
    And the original approval score was 22 out of 25
    When the committee re-scores "SUB-200" using the original 5-criterion rubric
    Then each criterion is scored on the 1-5 scale
    And the "Risk & Governance" criterion carries emphasis in the retraction context
    And the "Mission & Values" criterion carries emphasis in the retraction context
    And the "Ongoing Quality" criterion carries emphasis in the retraction context
    And the re-score total is calculated out of 25

  @retraction-rescoring
  Scenario: Score degradation from 22 to 9 justifies retraction
    Given the submission "SUB-200" is in "retraction-review" state
    And the original approval score was 22 out of 25
    When the committee re-scores "SUB-200" with the following criteria:
      | criterion          | score |
      | Mission & Values   | 2     |
      | Technical Quality  | 2     |
      | Documentation      | 2     |
      | Community Impact   | 2     |
      | Risk & Governance  | 1     |
    Then the re-score total is 9 out of 25
    And the agent reports significant score degradation from 22 to 9
    And the agent notes this degradation supports retraction per GDoc guidance

  # ---------------------------------------------------------------------------
  # Retraction Vote (50% + 1 majority)
  # ---------------------------------------------------------------------------

  @retraction-vote
  Scenario: Retraction vote passes and project is retracted
    Given the submission "SUB-200" is in "retraction-review" state
    And re-scoring is complete with a total of 9 out of 25
    When "alice" submits "/vote retract" on "SUB-200"
    And "bob" submits "/vote retract" on "SUB-200"
    And "carol" submits "/vote retract" on "SUB-200"
    Then the agent tallies 3 retract vs 0 retain
    And the agent declares retraction carries by simple majority
    And the submission "SUB-200" transitions to "retracted" state
    And the project is removed from the Foundation website
    And Foundation support is withdrawn
    And collaboration is terminated
    And the submitter "frank" is notified of the retraction and grounds

  @retraction-vote
  Scenario: Retraction vote fails and project continues
    Given the submission "SUB-200" is in "retraction-review" state
    And re-scoring is complete
    When "alice" submits "/vote retract" on "SUB-200"
    And "bob" submits "/vote retain" on "SUB-200"
    And "carol" submits "/vote retain" on "SUB-200"
    And "dan" submits "/vote retain" on "SUB-200"
    Then the agent tallies 1 retract vs 3 retain
    And the agent declares retraction does not carry
    And the submission "SUB-200" transitions back to "approved" state
    And the project continues with Foundation support

  @retraction-vote @escalation
  Scenario: High-risk retraction escalated to senior leadership
    # GDoc item 124: escalate if reputational risk high
    Given the submission "SUB-200" is in "retraction-review" state
    And the retraction grounds include "legal-reputational-risk"
    And re-scoring flags high risk on the "Risk & Governance" criterion
    When "alice" submits "/vote retract" on "SUB-200"
    And "bob" submits "/vote retract" on "SUB-200"
    And "carol" submits "/vote retract" on "SUB-200"
    Then the agent tallies 3 retract vs 0 retain
    And the agent identifies this as a high-risk retraction
    And the retraction is escalated to senior leadership for final decision
    And the submission "SUB-200" transitions to "retraction-escalated" state

  # ---------------------------------------------------------------------------
  # Edge Cases: Abandonment (GDoc item 121)
  # ---------------------------------------------------------------------------

  @retraction-edge @abandonment
  Scenario: Inactivity alone does not trigger retraction
    Given the project in "SUB-200" has had no commits for 12 months
    But no community impact has been reported
    Then inactivity alone is not sufficient grounds for retraction
    And no retraction review is initiated automatically

  @retraction-edge @abandonment
  Scenario: Inactivity with community impact triggers retraction review
    Given the project in "SUB-200" has had no commits for 12 months
    And downstream users report unpatched security vulnerabilities
    When "alice" submits "/retract Abandoned project with unpatched CVEs impacting community" on "SUB-200"
    Then the agent accepts the retraction proposal
    And the submission "SUB-200" transitions to "retraction-review" state

  @retraction-edge @abandonment @gdoc-item-121
  Scenario: Committee requests maintainer status update before retraction action
    # GDoc item 121: committee may request maintainer status update first
    Given the submission "SUB-200" is in "retraction-review" state
    And the retraction grounds are "abandoned-maintenance"
    When the committee requests a maintainer status update
    Then the agent sends a status inquiry to the submitter "frank"
    And the agent sets a response deadline of 30 days
    And the retraction vote is paused until the response deadline passes or a response is received

  # ---------------------------------------------------------------------------
  # Edge Cases: Conduct Violations (GDoc item 124)
  # ---------------------------------------------------------------------------

  @retraction-edge @conduct @gdoc-item-124
  Scenario: Conduct violation overrides high technical score
    # GDoc item 124: conduct overrides technical merit
    Given the submission "SUB-200" is in "retraction-review" state
    And the retraction grounds include "code-of-conduct-violation"
    And re-scoring shows a technical quality score of 5 out of 5
    And re-scoring shows a total of 18 out of 25
    When "alice" submits "/vote retract" on "SUB-200"
    And "bob" submits "/vote retract" on "SUB-200"
    And "carol" submits "/vote retract" on "SUB-200"
    Then the agent tallies 3 retract vs 0 retain
    And the agent declares retraction carries
    And the agent notes that conduct violations override technical merit
    And the submission "SUB-200" transitions to "retracted" state

  @retraction-edge @conduct @escalation
  Scenario: Conduct violation with reputational risk escalated to senior leadership
    Given the submission "SUB-200" is in "retraction-review" state
    And the retraction grounds include "code-of-conduct-violation"
    And the committee identifies high reputational risk to the Foundation
    When the retraction vote passes by simple majority
    Then the agent escalates the retraction to senior leadership
    And the submission "SUB-200" transitions to "retraction-escalated" state
