'use strict';

/**
 * Governance State Machine Engine
 *
 * Encodes the state machine from spec/constitution.yaml into executable logic.
 * States, transitions, and guards are hardcoded from the spec to avoid any
 * YAML parsing dependency.
 */

const STATES = [
  'submitted',
  'triaged',
  'scoring',
  'escalation_vote',
  'escalated',
  'validation_vote',
  'approved',
  'approved_with_conditions',
  'declined',
  'deferred',
  'retraction_proposed',
  'retraction_vote',
  'retracted',
  'monitoring',
];

// Each transition: { from, to, guard }
// Derived directly from constitution.yaml state_machine.transitions
const TRANSITIONS = [
  { from: 'submitted', to: 'triaged', guard: 'valid_submission' },
  { from: 'triaged', to: 'scoring', guard: 'agent_brief_posted' },
  { from: 'scoring', to: 'escalation_vote', guard: 'minimum_scores_received' },
  { from: 'escalation_vote', to: 'escalated', guard: 'escalation_majority' },
  { from: 'escalation_vote', to: 'validation_vote', guard: 'no_escalation_majority' },
  { from: 'validation_vote', to: 'approved', guard: 'approve_majority' },
  { from: 'validation_vote', to: 'approved_with_conditions', guard: 'conditions_majority' },
  { from: 'validation_vote', to: 'declined', guard: 'decline_majority' },
  { from: 'validation_vote', to: 'deferred', guard: 'defer_majority_or_tie' },
  { from: 'approved', to: 'monitoring', guard: 'approval_recorded' },
  { from: 'approved_with_conditions', to: 'monitoring', guard: 'approval_recorded' },
  { from: 'approved', to: 'retraction_proposed', guard: 'committee_member_proposes' },
  { from: 'monitoring', to: 'retraction_proposed', guard: 'committee_member_proposes' },
  { from: 'retraction_proposed', to: 'retraction_vote', guard: 'rescoring_complete' },
  { from: 'retraction_vote', to: 'retracted', guard: 'retraction_majority' },
  { from: 'retraction_vote', to: 'monitoring', guard: 'retraction_failed' },
  { from: 'deferred', to: 'submitted', guard: 'resubmission_received' },
];

/**
 * Evaluate a named guard against the provided context.
 * Returns { passed: boolean, reason: string }.
 */
function evaluateGuard(guardName, context) {
  switch (guardName) {
    case 'valid_submission':
      if (context.hasRequiredFields === true) return { passed: true, reason: 'Submission has all required fields.' };
      return { passed: false, reason: 'Submission is missing required fields (hasRequiredFields must be true).' };

    case 'agent_brief_posted':
      if (context.briefPosted === true) return { passed: true, reason: 'Agent brief has been posted.' };
      return { passed: false, reason: 'Agent brief has not been posted (briefPosted must be true).' };

    case 'minimum_scores_received': {
      const quorum = context.quorum != null ? context.quorum : 3;
      const count = context.scoreCount != null ? context.scoreCount : 0;
      if (count >= quorum) return { passed: true, reason: `${count} scores received (quorum: ${quorum}).` };
      return { passed: false, reason: `Only ${count} scores received, need ${quorum} (quorum).` };
    }

    case 'escalation_majority': {
      const escalate = context.escalateVotes != null ? context.escalateVotes : 0;
      const total = context.totalEscalationVotes != null ? context.totalEscalationVotes : 0;
      if (total > 0 && escalate > total / 2) return { passed: true, reason: `Escalation majority: ${escalate}/${total}.` };
      return { passed: false, reason: `No escalation majority: ${escalate}/${total}.` };
    }

    case 'no_escalation_majority': {
      const noEscalate = context.noEscalateVotes != null ? context.noEscalateVotes : 0;
      const total = context.totalEscalationVotes != null ? context.totalEscalationVotes : 0;
      if (total > 0 && noEscalate > total / 2) return { passed: true, reason: `No-escalation majority: ${noEscalate}/${total}.` };
      return { passed: false, reason: `No clear no-escalation majority: ${noEscalate}/${total}.` };
    }

    case 'approve_majority': {
      const approveVotes = context.approveVotes != null ? context.approveVotes : 0;
      const totalVotes = context.totalVotes != null ? context.totalVotes : 0;
      const conditionsVotes = context.conditionsVotes != null ? context.conditionsVotes : 0;
      const declineVotes = context.declineVotes != null ? context.declineVotes : 0;
      const deferVotes = context.deferVotes != null ? context.deferVotes : 0;
      const isPlurality = approveVotes > conditionsVotes && approveVotes > declineVotes && approveVotes > deferVotes;
      const isMajority = approveVotes > totalVotes / 2;
      if (isPlurality && isMajority) return { passed: true, reason: `Approve majority: ${approveVotes}/${totalVotes}.` };
      return { passed: false, reason: `No approve majority: ${approveVotes}/${totalVotes}.` };
    }

    case 'conditions_majority': {
      const conditionsVotes = context.conditionsVotes != null ? context.conditionsVotes : 0;
      const totalVotes = context.totalVotes != null ? context.totalVotes : 0;
      const approveVotes = context.approveVotes != null ? context.approveVotes : 0;
      const declineVotes = context.declineVotes != null ? context.declineVotes : 0;
      const deferVotes = context.deferVotes != null ? context.deferVotes : 0;
      const isPlurality = conditionsVotes > approveVotes && conditionsVotes > declineVotes && conditionsVotes > deferVotes;
      const isMajority = conditionsVotes > totalVotes / 2;
      if (isPlurality && isMajority) return { passed: true, reason: `Conditions majority: ${conditionsVotes}/${totalVotes}.` };
      return { passed: false, reason: `No conditions majority: ${conditionsVotes}/${totalVotes}.` };
    }

    case 'decline_majority': {
      const declineVotes = context.declineVotes != null ? context.declineVotes : 0;
      const totalVotes = context.totalVotes != null ? context.totalVotes : 0;
      const approveVotes = context.approveVotes != null ? context.approveVotes : 0;
      const conditionsVotes = context.conditionsVotes != null ? context.conditionsVotes : 0;
      const deferVotes = context.deferVotes != null ? context.deferVotes : 0;
      const isPlurality = declineVotes > approveVotes && declineVotes > conditionsVotes && declineVotes > deferVotes;
      const isMajority = declineVotes > totalVotes / 2;
      if (isPlurality && isMajority) return { passed: true, reason: `Decline majority: ${declineVotes}/${totalVotes}.` };
      return { passed: false, reason: `No decline majority: ${declineVotes}/${totalVotes}.` };
    }

    case 'defer_majority_or_tie': {
      const deferVotes = context.deferVotes != null ? context.deferVotes : 0;
      const totalVotes = context.totalVotes != null ? context.totalVotes : 0;
      const approveVotes = context.approveVotes != null ? context.approveVotes : 0;
      const conditionsVotes = context.conditionsVotes != null ? context.conditionsVotes : 0;
      const declineVotes = context.declineVotes != null ? context.declineVotes : 0;

      // Defer wins if it is plurality and majority
      const isDeferPlurality = deferVotes > approveVotes && deferVotes > conditionsVotes && deferVotes > declineVotes;
      const isDeferMajority = deferVotes > totalVotes / 2;
      if (isDeferPlurality && isDeferMajority) return { passed: true, reason: `Defer majority: ${deferVotes}/${totalVotes}.` };

      // Also passes on tie (no single option has both plurality and majority)
      const hasApproveMajority = approveVotes > totalVotes / 2 && approveVotes > conditionsVotes && approveVotes > declineVotes && approveVotes > deferVotes;
      const hasConditionsMajority = conditionsVotes > totalVotes / 2 && conditionsVotes > approveVotes && conditionsVotes > declineVotes && conditionsVotes > deferVotes;
      const hasDeclineMajority = declineVotes > totalVotes / 2 && declineVotes > approveVotes && declineVotes > conditionsVotes && declineVotes > deferVotes;

      if (!hasApproveMajority && !hasConditionsMajority && !hasDeclineMajority && !isDeferPlurality) {
        return { passed: true, reason: 'No clear majority, defaulting to defer (tie behavior).' };
      }
      // Also pass if defer has plurality but not strict majority (still tie-ish)
      if (!hasApproveMajority && !hasConditionsMajority && !hasDeclineMajority) {
        return { passed: true, reason: 'No clear majority, defaulting to defer (tie behavior).' };
      }

      return { passed: false, reason: 'Another option has a clear majority, defer does not apply.' };
    }

    case 'committee_member_proposes':
      if (context.isCommitteeMember === true) return { passed: true, reason: 'Proposer is a committee member.' };
      return { passed: false, reason: 'Proposer is not a committee member (isCommitteeMember must be true).' };

    case 'rescoring_complete':
      if (context.rescored === true) return { passed: true, reason: 'Re-scoring is complete.' };
      return { passed: false, reason: 'Re-scoring is not complete (rescored must be true).' };

    case 'retraction_majority': {
      const retractVotes = context.retractVotes != null ? context.retractVotes : 0;
      const total = context.totalRetractionVotes != null ? context.totalRetractionVotes : 0;
      if (total > 0 && retractVotes > total / 2) return { passed: true, reason: `Retraction majority: ${retractVotes}/${total}.` };
      return { passed: false, reason: `No retraction majority: ${retractVotes}/${total}.` };
    }

    case 'retraction_failed': {
      const noRetractVotes = context.noRetractVotes != null ? context.noRetractVotes : 0;
      const total = context.totalRetractionVotes != null ? context.totalRetractionVotes : 0;
      if (total > 0 && noRetractVotes >= total / 2) return { passed: true, reason: `Retraction failed: ${noRetractVotes}/${total} voted to keep.` };
      return { passed: false, reason: `Retraction not clearly failed: ${noRetractVotes}/${total}.` };
    }

    case 'approval_recorded':
      if (context.approvalRecorded === true) return { passed: true, reason: 'Approval has been recorded.' };
      return { passed: false, reason: 'Approval has not been recorded (approvalRecorded must be true).' };

    case 'resubmission_received':
      if (context.resubmissionReceived === true) return { passed: true, reason: 'Resubmission received.' };
      return { passed: false, reason: 'No resubmission received (resubmissionReceived must be true).' };

    default:
      return { passed: false, reason: `Unknown guard: ${guardName}.` };
  }
}

class GovernanceStateMachine {
  constructor(initialState = 'submitted') {
    if (!STATES.includes(initialState)) {
      throw new Error(`Invalid initial state: ${initialState}. Valid states: ${STATES.join(', ')}`);
    }
    this._state = initialState;
  }

  /**
   * Get the current state.
   */
  getState() {
    return this._state;
  }

  /**
   * Get all valid states.
   */
  static getStates() {
    return [...STATES];
  }

  /**
   * Get all transitions defined in the spec.
   */
  static getTransitions() {
    return TRANSITIONS.map(t => ({ ...t }));
  }

  /**
   * Get list of valid next states from the current state.
   */
  validTransitions() {
    return TRANSITIONS
      .filter(t => t.from === this._state)
      .map(t => ({ to: t.to, guard: t.guard }));
  }

  /**
   * Check if a transition is valid without executing it.
   * Returns { valid, guard, guardResult }
   */
  canTransition(targetState, context = {}) {
    const matching = TRANSITIONS.filter(t => t.from === this._state && t.to === targetState);
    if (matching.length === 0) {
      return {
        valid: false,
        guard: null,
        guardResult: null,
        error: `No transition defined from '${this._state}' to '${targetState}'.`,
      };
    }

    // Try each matching transition (there should be at most one per from/to pair)
    for (const t of matching) {
      const guardResult = evaluateGuard(t.guard, context);
      if (guardResult.passed) {
        return { valid: true, guard: t.guard, guardResult };
      }
      // If guard fails, report it
      return { valid: false, guard: t.guard, guardResult, error: guardResult.reason };
    }
  }

  /**
   * Attempt a transition.
   * Returns { success, from, to, guard, error }
   */
  transition(targetState, context = {}) {
    const from = this._state;
    const check = this.canTransition(targetState, context);

    if (!check.valid) {
      return {
        success: false,
        from,
        to: targetState,
        guard: check.guard,
        error: check.error,
      };
    }

    this._state = targetState;
    return {
      success: true,
      from,
      to: targetState,
      guard: check.guard,
      guardResult: check.guardResult,
    };
  }
}

module.exports = { GovernanceStateMachine, evaluateGuard, STATES, TRANSITIONS };
