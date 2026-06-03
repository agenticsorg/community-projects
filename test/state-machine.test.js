'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { GovernanceStateMachine, STATES, TRANSITIONS } = require('../lib/state-machine.js');

describe('GovernanceStateMachine', () => {

  // =========================================================================
  // Construction and basics
  // =========================================================================

  it('initializes with submitted state by default', () => {
    const sm = new GovernanceStateMachine();
    assert.equal(sm.getState(), 'submitted');
  });

  it('accepts a custom initial state', () => {
    const sm = new GovernanceStateMachine('scoring');
    assert.equal(sm.getState(), 'scoring');
  });

  it('rejects an invalid initial state', () => {
    assert.throws(() => new GovernanceStateMachine('invalid'), /Invalid initial state/);
  });

  it('exposes all 14 states', () => {
    const states = GovernanceStateMachine.getStates();
    assert.equal(states.length, 14);
    assert.ok(states.includes('submitted'));
    assert.ok(states.includes('monitoring'));
    assert.ok(states.includes('retracted'));
  });

  it('exposes all transitions', () => {
    const transitions = GovernanceStateMachine.getTransitions();
    assert.equal(transitions.length, 17);
  });

  // =========================================================================
  // Happy path: submitted -> triaged -> scoring -> escalation_vote ->
  //             validation_vote -> approved -> monitoring
  // =========================================================================

  it('happy path: full approval lifecycle', () => {
    const sm = new GovernanceStateMachine();

    // submitted -> triaged
    let result = sm.transition('triaged', { hasRequiredFields: true });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'triaged');

    // triaged -> scoring
    result = sm.transition('scoring', { briefPosted: true });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'scoring');

    // scoring -> escalation_vote
    result = sm.transition('escalation_vote', { scoreCount: 3, quorum: 3 });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'escalation_vote');

    // escalation_vote -> validation_vote (not escalated)
    result = sm.transition('validation_vote', {
      noEscalateVotes: 4,
      totalEscalationVotes: 5,
    });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'validation_vote');

    // validation_vote -> approved
    result = sm.transition('approved', {
      approveVotes: 4,
      conditionsVotes: 0,
      declineVotes: 1,
      deferVotes: 0,
      totalVotes: 5,
    });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'approved');

    // approved -> monitoring
    result = sm.transition('monitoring', { approvalRecorded: true });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'monitoring');
  });

  // =========================================================================
  // Escalation path
  // =========================================================================

  it('escalation path: escalation_vote -> escalated (terminates)', () => {
    const sm = new GovernanceStateMachine('escalation_vote');

    const result = sm.transition('escalated', {
      escalateVotes: 4,
      totalEscalationVotes: 5,
    });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'escalated');

    // Escalated is a terminal state, no further transitions
    const valid = sm.validTransitions();
    assert.equal(valid.length, 0);
  });

  // =========================================================================
  // All 4 Vote 2 outcomes
  // =========================================================================

  it('validation_vote -> approved', () => {
    const sm = new GovernanceStateMachine('validation_vote');
    const result = sm.transition('approved', {
      approveVotes: 3, conditionsVotes: 1, declineVotes: 0, deferVotes: 0, totalVotes: 4,
    });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'approved');
  });

  it('validation_vote -> approved_with_conditions', () => {
    const sm = new GovernanceStateMachine('validation_vote');
    const result = sm.transition('approved_with_conditions', {
      approveVotes: 1, conditionsVotes: 3, declineVotes: 0, deferVotes: 0, totalVotes: 4,
    });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'approved_with_conditions');
  });

  it('validation_vote -> declined', () => {
    const sm = new GovernanceStateMachine('validation_vote');
    const result = sm.transition('declined', {
      approveVotes: 0, conditionsVotes: 0, declineVotes: 4, deferVotes: 1, totalVotes: 5,
    });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'declined');
  });

  it('validation_vote -> deferred (majority)', () => {
    const sm = new GovernanceStateMachine('validation_vote');
    const result = sm.transition('deferred', {
      approveVotes: 0, conditionsVotes: 0, declineVotes: 1, deferVotes: 4, totalVotes: 5,
    });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'deferred');
  });

  it('validation_vote -> deferred (tie, no clear majority)', () => {
    const sm = new GovernanceStateMachine('validation_vote');
    const result = sm.transition('deferred', {
      approveVotes: 2, conditionsVotes: 0, declineVotes: 2, deferVotes: 0, totalVotes: 4,
    });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'deferred');
  });

  // =========================================================================
  // Retraction path
  // =========================================================================

  it('retraction path: approved -> retraction_proposed -> retraction_vote -> retracted', () => {
    const sm = new GovernanceStateMachine('approved');

    let result = sm.transition('retraction_proposed', { isCommitteeMember: true });
    assert.equal(result.success, true);

    result = sm.transition('retraction_vote', { rescored: true });
    assert.equal(result.success, true);

    result = sm.transition('retracted', {
      retractVotes: 3,
      totalRetractionVotes: 5,
    });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'retracted');
  });

  it('retraction failure: retraction_vote -> monitoring (continues)', () => {
    const sm = new GovernanceStateMachine('retraction_vote');

    const result = sm.transition('monitoring', {
      noRetractVotes: 3,
      totalRetractionVotes: 5,
    });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'monitoring');
  });

  it('retraction from monitoring: monitoring -> retraction_proposed', () => {
    const sm = new GovernanceStateMachine('monitoring');

    const result = sm.transition('retraction_proposed', { isCommitteeMember: true });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'retraction_proposed');
  });

  // =========================================================================
  // Deferred resubmission loop
  // =========================================================================

  it('deferred -> submitted (resubmission loop)', () => {
    const sm = new GovernanceStateMachine('deferred');
    const result = sm.transition('submitted', { resubmissionReceived: true });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'submitted');
  });

  // =========================================================================
  // approved_with_conditions -> monitoring
  // =========================================================================

  it('approved_with_conditions -> monitoring', () => {
    const sm = new GovernanceStateMachine('approved_with_conditions');
    const result = sm.transition('monitoring', { approvalRecorded: true });
    assert.equal(result.success, true);
    assert.equal(sm.getState(), 'monitoring');
  });

  // =========================================================================
  // Invalid transitions
  // =========================================================================

  it('rejects submitted -> approved (skip phases)', () => {
    const sm = new GovernanceStateMachine('submitted');
    const result = sm.transition('approved', {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('No transition defined'));
  });

  it('rejects scoring -> retracted (skip phases)', () => {
    const sm = new GovernanceStateMachine('scoring');
    const result = sm.transition('retracted', {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('No transition defined'));
  });

  it('rejects submitted -> validation_vote (skip phases)', () => {
    const sm = new GovernanceStateMachine('submitted');
    const result = sm.transition('validation_vote', {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('No transition defined'));
  });

  it('rejects submitted -> monitoring (skip phases)', () => {
    const sm = new GovernanceStateMachine('submitted');
    const result = sm.transition('monitoring', {});
    assert.equal(result.success, false);
  });

  it('rejects triaged -> escalation_vote (must score first)', () => {
    const sm = new GovernanceStateMachine('triaged');
    const result = sm.transition('escalation_vote', {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('No transition defined'));
  });

  // =========================================================================
  // Guard failures
  // =========================================================================

  it('guard failure: submitted -> triaged without required fields', () => {
    const sm = new GovernanceStateMachine('submitted');
    const result = sm.transition('triaged', { hasRequiredFields: false });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('required fields'));
  });

  it('guard failure: triaged -> scoring without brief posted', () => {
    const sm = new GovernanceStateMachine('triaged');
    const result = sm.transition('scoring', { briefPosted: false });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('brief'));
  });

  it('guard failure: scoring -> escalation_vote without sufficient scores', () => {
    const sm = new GovernanceStateMachine('scoring');
    const result = sm.transition('escalation_vote', { scoreCount: 1, quorum: 3 });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('scores'));
  });

  it('guard failure: retraction_proposed without committee member', () => {
    const sm = new GovernanceStateMachine('approved');
    const result = sm.transition('retraction_proposed', { isCommitteeMember: false });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('committee member'));
  });

  it('guard failure: retraction_vote without rescoring', () => {
    const sm = new GovernanceStateMachine('retraction_proposed');
    const result = sm.transition('retraction_vote', { rescored: false });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Re-scoring'));
  });

  // =========================================================================
  // canTransition checks
  // =========================================================================

  it('canTransition returns valid=true with correct context', () => {
    const sm = new GovernanceStateMachine('submitted');
    const check = sm.canTransition('triaged', { hasRequiredFields: true });
    assert.equal(check.valid, true);
    assert.equal(check.guard, 'valid_submission');
  });

  it('canTransition does not change state', () => {
    const sm = new GovernanceStateMachine('submitted');
    sm.canTransition('triaged', { hasRequiredFields: true });
    assert.equal(sm.getState(), 'submitted');
  });

  it('canTransition returns valid=false for invalid transition', () => {
    const sm = new GovernanceStateMachine('submitted');
    const check = sm.canTransition('retracted', {});
    assert.equal(check.valid, false);
  });

  // =========================================================================
  // validTransitions
  // =========================================================================

  it('validTransitions lists correct options from escalation_vote', () => {
    const sm = new GovernanceStateMachine('escalation_vote');
    const valid = sm.validTransitions();
    assert.equal(valid.length, 2);
    const targets = valid.map(v => v.to).sort();
    assert.deepEqual(targets, ['escalated', 'validation_vote']);
  });

  it('validTransitions lists correct options from validation_vote', () => {
    const sm = new GovernanceStateMachine('validation_vote');
    const valid = sm.validTransitions();
    assert.equal(valid.length, 4);
    const targets = valid.map(v => v.to).sort();
    assert.deepEqual(targets, ['approved', 'approved_with_conditions', 'declined', 'deferred']);
  });

  it('validTransitions returns empty for terminal states', () => {
    for (const terminal of ['escalated', 'declined', 'retracted']) {
      const sm = new GovernanceStateMachine(terminal);
      const valid = sm.validTransitions();
      assert.equal(valid.length, 0, `Expected no transitions from ${terminal}`);
    }
  });
});
