'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  PHASE_REQUIREMENTS,
  checkPhaseGuard,
  excludeSubmitter,
  isSubmitterExcluded,
  checkRegistryDuplicate,
  checkAlreadyRetracted,
} = require('../lib/workflow-guards.js');

// ===========================================================================
// P0-1: State Machine Phase Guards
// ===========================================================================

describe('checkPhaseGuard', () => {

  // -------------------------------------------------------------------------
  // Scoring
  // -------------------------------------------------------------------------

  it('allows scoring when issue has status:triaged', () => {
    const result = checkPhaseGuard(['status:triaged', 'category:donation'], 'scoring');
    assert.equal(result.allowed, true);
  });

  it('allows scoring when issue has status:scoring', () => {
    const result = checkPhaseGuard(['status:scoring'], 'scoring');
    assert.equal(result.allowed, true);
  });

  it('rejects scoring when issue has no phase label', () => {
    const result = checkPhaseGuard(['category:donation'], 'scoring');
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes('not in the correct phase'));
  });

  it('rejects scoring when issue is in validation-vote phase', () => {
    const result = checkPhaseGuard(['status:validation-vote'], 'scoring');
    assert.equal(result.allowed, false);
  });

  // -------------------------------------------------------------------------
  // Escalation vote
  // -------------------------------------------------------------------------

  it('allows escalation-vote when issue has status:scoring', () => {
    const result = checkPhaseGuard(['status:scoring'], 'escalation-vote');
    assert.equal(result.allowed, true);
  });

  it('allows escalation-vote when issue has status:escalation-vote', () => {
    const result = checkPhaseGuard(['status:escalation-vote'], 'escalation-vote');
    assert.equal(result.allowed, true);
  });

  it('rejects escalation-vote when issue has status:approved', () => {
    const result = checkPhaseGuard(['status:approved'], 'escalation-vote');
    assert.equal(result.allowed, false);
  });

  // -------------------------------------------------------------------------
  // Validation vote
  // -------------------------------------------------------------------------

  it('allows validation-vote when issue has status:validation-vote', () => {
    const result = checkPhaseGuard(['status:validation-vote'], 'validation-vote');
    assert.equal(result.allowed, true);
  });

  it('rejects validation-vote when issue has status:scoring', () => {
    const result = checkPhaseGuard(['status:scoring'], 'validation-vote');
    assert.equal(result.allowed, false);
  });

  it('rejects validation-vote when issue has status:approved (already decided)', () => {
    const result = checkPhaseGuard(['status:approved'], 'validation-vote');
    assert.equal(result.allowed, false);
  });

  // -------------------------------------------------------------------------
  // Approval registration
  // -------------------------------------------------------------------------

  it('allows approve-project when issue has status:approved', () => {
    const result = checkPhaseGuard(['status:approved'], 'approve-project');
    assert.equal(result.allowed, true);
  });

  it('allows approve-project when issue has status:approved-with-conditions', () => {
    const result = checkPhaseGuard(['status:approved-with-conditions'], 'approve-project');
    assert.equal(result.allowed, true);
  });

  it('rejects approve-project when issue has status:pending-review (bypassed voting)', () => {
    const result = checkPhaseGuard(['status:pending-review'], 'approve-project');
    assert.equal(result.allowed, false);
  });

  it('rejects approve-project when issue has status:validation-vote (vote not completed)', () => {
    const result = checkPhaseGuard(['status:validation-vote'], 'approve-project');
    assert.equal(result.allowed, false);
  });

  // -------------------------------------------------------------------------
  // Retraction proposal
  // -------------------------------------------------------------------------

  it('allows retraction-propose when issue has status:approved', () => {
    const result = checkPhaseGuard(['status:approved'], 'retraction-propose');
    assert.equal(result.allowed, true);
  });

  it('allows retraction-propose when issue has status:monitoring', () => {
    const result = checkPhaseGuard(['status:monitoring'], 'retraction-propose');
    assert.equal(result.allowed, true);
  });

  it('rejects retraction-propose when issue has status:pending-review', () => {
    const result = checkPhaseGuard(['status:pending-review'], 'retraction-propose');
    assert.equal(result.allowed, false);
  });

  // -------------------------------------------------------------------------
  // Retraction vote
  // -------------------------------------------------------------------------

  it('allows retraction-vote when issue has status:retraction-proposed', () => {
    const result = checkPhaseGuard(['status:retraction-proposed'], 'retraction-vote');
    assert.equal(result.allowed, true);
  });

  it('rejects retraction-vote when issue has status:approved (no retraction proposed)', () => {
    const result = checkPhaseGuard(['status:approved'], 'retraction-vote');
    assert.equal(result.allowed, false);
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('rejects unknown workflow action', () => {
    const result = checkPhaseGuard(['status:approved'], 'unknown-action');
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes('Unknown workflow action'));
  });

  it('handles empty label array', () => {
    const result = checkPhaseGuard([], 'scoring');
    assert.equal(result.allowed, false);
  });

  it('includes required labels in response', () => {
    const result = checkPhaseGuard([], 'scoring');
    assert.deepEqual(result.requiredLabels, ['status:triaged', 'status:scoring']);
  });

  it('PHASE_REQUIREMENTS covers all workflow actions', () => {
    const expectedActions = [
      'scoring', 'escalation-vote', 'validation-vote',
      'approve-project', 'retraction-propose', 'retraction-vote',
    ];
    for (const action of expectedActions) {
      assert.ok(
        PHASE_REQUIREMENTS[action],
        `Missing PHASE_REQUIREMENTS entry for "${action}"`
      );
      assert.ok(
        Array.isArray(PHASE_REQUIREMENTS[action]) && PHASE_REQUIREMENTS[action].length > 0,
        `PHASE_REQUIREMENTS["${action}"] must be a non-empty array`
      );
    }
  });
});

// ===========================================================================
// P0-2: Submitter Exclusion
// ===========================================================================

describe('excludeSubmitter', () => {

  it('filters out the submitter from comments', () => {
    const comments = [
      { login: 'alice', body: '/vote retract', isBot: false },
      { login: 'submitter-bob', body: '/vote retract', isBot: false },
      { login: 'charlie', body: '/vote no-retract', isBot: false },
    ];
    const filtered = excludeSubmitter(comments, 'submitter-bob');
    assert.equal(filtered.length, 2);
    assert.ok(!filtered.some(c => c.login === 'submitter-bob'));
  });

  it('returns all comments when submitter is not in the list', () => {
    const comments = [
      { login: 'alice', body: '/vote retract', isBot: false },
      { login: 'charlie', body: '/vote no-retract', isBot: false },
    ];
    const filtered = excludeSubmitter(comments, 'submitter-bob');
    assert.equal(filtered.length, 2);
  });

  it('returns all comments when submitter is null', () => {
    const comments = [
      { login: 'alice', body: '/vote retract', isBot: false },
    ];
    const filtered = excludeSubmitter(comments, null);
    assert.equal(filtered.length, 1);
  });

  it('returns all comments when submitter is undefined', () => {
    const comments = [
      { login: 'alice', body: '/vote retract', isBot: false },
    ];
    const filtered = excludeSubmitter(comments, undefined);
    assert.equal(filtered.length, 1);
  });

  it('handles empty comments array', () => {
    const filtered = excludeSubmitter([], 'submitter-bob');
    assert.equal(filtered.length, 0);
  });

  it('filters multiple comments from the same submitter', () => {
    const comments = [
      { login: 'submitter-bob', body: '/vote retract', isBot: false },
      { login: 'alice', body: '/vote no-retract', isBot: false },
      { login: 'submitter-bob', body: '/vote no-retract', isBot: false },
    ];
    const filtered = excludeSubmitter(comments, 'submitter-bob');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].login, 'alice');
  });
});

describe('isSubmitterExcluded', () => {

  it('identifies the submitter as excluded', () => {
    const result = isSubmitterExcluded('alice', 'alice');
    assert.equal(result.excluded, true);
    assert.ok(result.reason.includes('excluded from voting'));
  });

  it('does not exclude a different user', () => {
    const result = isSubmitterExcluded('bob', 'alice');
    assert.equal(result.excluded, false);
  });

  it('does not exclude when submitter is null', () => {
    const result = isSubmitterExcluded('bob', null);
    assert.equal(result.excluded, false);
  });

  it('does not exclude when voter is null', () => {
    const result = isSubmitterExcluded(null, 'alice');
    assert.equal(result.excluded, false);
  });

  it('is case-sensitive (GitHub logins are case-sensitive)', () => {
    const result = isSubmitterExcluded('Alice', 'alice');
    assert.equal(result.excluded, false);
  });
});

// ===========================================================================
// P0-3: Idempotency -- Registry Duplicate Check
// ===========================================================================

describe('checkRegistryDuplicate', () => {

  const sampleRegistry = [
    {
      id: 'proj-001',
      name: 'Test Project',
      repo_url: 'https://github.com/test/project',
      category: 'donation',
      approved_date: '2026-04-15',
      submitter: 'alice',
      description: 'A test project',
      total_score: 21,
      issue_number: 1,
      status: 'active',
    },
    {
      id: 'proj-005',
      name: 'Another Project',
      repo_url: 'https://github.com/test/another',
      category: 'website-listing',
      approved_date: '2026-04-20',
      submitter: 'bob',
      description: 'Another project',
      total_score: 18,
      issue_number: 5,
      status: 'active',
    },
  ];

  it('detects existing entry by issue number', () => {
    const result = checkRegistryDuplicate(sampleRegistry, 1);
    assert.equal(result.exists, true);
    assert.equal(result.existingEntry.id, 'proj-001');
    assert.ok(result.reason.includes('already exists'));
  });

  it('reports no duplicate for new issue number', () => {
    const result = checkRegistryDuplicate(sampleRegistry, 99);
    assert.equal(result.exists, false);
    assert.equal(result.existingEntry, null);
  });

  it('handles empty registry', () => {
    const result = checkRegistryDuplicate([], 1);
    assert.equal(result.exists, false);
  });

  it('handles non-array registry', () => {
    const result = checkRegistryDuplicate('not an array', 1);
    assert.equal(result.exists, false);
    assert.ok(result.reason.includes('not an array'));
  });

  it('handles null registry', () => {
    const result = checkRegistryDuplicate(null, 1);
    assert.equal(result.exists, false);
  });

  it('includes status in reason for existing entries', () => {
    const result = checkRegistryDuplicate(sampleRegistry, 1);
    assert.ok(result.reason.includes('active'));
  });
});

describe('checkAlreadyRetracted', () => {

  const registryWithRetracted = [
    {
      id: 'proj-001',
      issue_number: 1,
      status: 'active',
    },
    {
      id: 'proj-002',
      issue_number: 2,
      status: 'retracted',
      retracted_date: '2026-04-25',
    },
  ];

  it('detects already-retracted entry', () => {
    const result = checkAlreadyRetracted(registryWithRetracted, 2);
    assert.equal(result.alreadyRetracted, true);
    assert.equal(result.entry.id, 'proj-002');
    assert.ok(result.reason.includes('already retracted'));
  });

  it('reports not retracted for active entry', () => {
    const result = checkAlreadyRetracted(registryWithRetracted, 1);
    assert.equal(result.alreadyRetracted, false);
    assert.equal(result.entry.id, 'proj-001');
  });

  it('reports not retracted for missing entry', () => {
    const result = checkAlreadyRetracted(registryWithRetracted, 99);
    assert.equal(result.alreadyRetracted, false);
    assert.equal(result.entry, null);
  });

  it('handles empty registry', () => {
    const result = checkAlreadyRetracted([], 1);
    assert.equal(result.alreadyRetracted, false);
  });

  it('handles non-array registry', () => {
    const result = checkAlreadyRetracted(null, 1);
    assert.equal(result.alreadyRetracted, false);
  });

  it('includes retracted date in reason', () => {
    const result = checkAlreadyRetracted(registryWithRetracted, 2);
    assert.ok(result.reason.includes('2026-04-25'));
  });
});
