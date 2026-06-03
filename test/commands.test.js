'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseScore, parseVote, parseCoi, parseOverride, VALID_VOTE_TYPES } = require('../lib/commands.js');

describe('parseScore', () => {

  it('parses valid score with all 5 criteria', () => {
    const result = parseScore('/score mission:4 quality:3 clarity:5 impact:4 risk:3');
    assert.equal(result.valid, true);
    assert.equal(result.mission, 4);
    assert.equal(result.quality, 3);
    assert.equal(result.clarity, 5);
    assert.equal(result.impact, 4);
    assert.equal(result.risk, 3);
    assert.equal(result.total, 19);
  });

  it('parses score with flags', () => {
    const result = parseScore('/score mission:4 quality:3 clarity:5 impact:4 risk:3 --flags donation,legal');
    assert.equal(result.valid, true);
    assert.deepEqual(result.flags, ['donation', 'legal']);
  });

  it('parses score with recommendation', () => {
    const result = parseScore('/score mission:4 quality:3 clarity:5 impact:4 risk:3 --recommend escalate');
    assert.equal(result.valid, true);
    assert.equal(result.recommend, 'escalate');
  });

  it('parses score with notes', () => {
    const result = parseScore('/score mission:4 quality:3 clarity:5 impact:4 risk:3 --notes "Strong mission fit but IP transfer needs legal review"');
    assert.equal(result.valid, true);
    assert.equal(result.notes, 'Strong mission fit but IP transfer needs legal review');
  });

  it('parses score with all optional fields', () => {
    const result = parseScore('/score mission:5 quality:4 clarity:5 impact:4 risk:3 --flags donation,legal,reputational --recommend escalate --notes "Full review needed"');
    assert.equal(result.valid, true);
    assert.equal(result.total, 21);
    assert.deepEqual(result.flags, ['donation', 'legal', 'reputational']);
    assert.equal(result.recommend, 'escalate');
    assert.equal(result.notes, 'Full review needed');
  });

  it('rejects score with missing criterion', () => {
    const result = parseScore('/score mission:4 quality:3 clarity:5 impact:4');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('risk'));
  });

  it('rejects score with value > 5', () => {
    const result = parseScore('/score mission:6 quality:3 clarity:5 impact:4 risk:3');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('exceeds maximum'));
  });

  it('rejects score with negative value', () => {
    const result = parseScore('/score mission:-1 quality:3 clarity:5 impact:4 risk:3');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('below minimum'));
  });

  it('rejects score with non-numeric value', () => {
    const result = parseScore('/score mission:abc quality:3 clarity:5 impact:4 risk:3');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('not an integer'));
  });

  it('rejects comment not starting with /score', () => {
    const result = parseScore('some random text');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('does not start with'));
  });

  it('parses all zeros', () => {
    const result = parseScore('/score mission:0 quality:0 clarity:0 impact:0 risk:0');
    assert.equal(result.valid, true);
    assert.equal(result.total, 0);
  });

  it('parses all fives', () => {
    const result = parseScore('/score mission:5 quality:5 clarity:5 impact:5 risk:5');
    assert.equal(result.valid, true);
    assert.equal(result.total, 25);
  });

  it('returns empty flags when none provided', () => {
    const result = parseScore('/score mission:4 quality:3 clarity:5 impact:4 risk:3');
    assert.deepEqual(result.flags, []);
    assert.equal(result.recommend, null);
    assert.equal(result.notes, null);
  });
});

describe('parseVote', () => {

  it('parses all valid vote types', () => {
    for (const type of VALID_VOTE_TYPES) {
      const result = parseVote(`/vote ${type}`);
      assert.equal(result.valid, true, `Expected /vote ${type} to be valid`);
      assert.equal(result.type, type);
    }
  });

  it('rejects invalid vote type', () => {
    const result = parseVote('/vote banana');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('Invalid vote type'));
  });

  it('rejects empty vote', () => {
    const result = parseVote('/vote ');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('No vote type'));
  });

  it('rejects comment not starting with /vote', () => {
    const result = parseVote('random text');
    assert.equal(result.valid, false);
  });

  it('rejects vote with extra text appended to type', () => {
    const result = parseVote('/vote escalate-now');
    assert.equal(result.valid, false);
  });
});

describe('parseCoi', () => {

  it('parses /coi with reason', () => {
    const result = parseCoi('/coi I am a maintainer of this project');
    assert.equal(result.valid, true);
    assert.equal(result.reason, 'I am a maintainer of this project');
  });

  it('parses /coi without reason (still valid)', () => {
    const result = parseCoi('/coi');
    assert.equal(result.valid, true);
    assert.equal(result.reason, null);
  });

  it('parses /coi with only whitespace after command (no reason)', () => {
    const result = parseCoi('/coi   ');
    assert.equal(result.valid, true);
    assert.equal(result.reason, null);
  });

  it('rejects comment not starting with /coi', () => {
    const result = parseCoi('I have a conflict');
    assert.equal(result.valid, false);
  });
});

describe('parseOverride', () => {

  it('parses override with sufficient rationale', () => {
    const result = parseOverride('/override The committee has reviewed this edge case and agrees to override the scoring outcome based on discussion in meeting 2026-04-15.');
    assert.equal(result.valid, true);
    assert.ok(result.rationale.length >= 20);
  });

  it('rejects override with too-short rationale', () => {
    const result = parseOverride('/override Too short');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('too short'));
  });

  it('rejects override with no rationale', () => {
    const result = parseOverride('/override');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('required'));
  });

  it('rejects override with only whitespace rationale', () => {
    const result = parseOverride('/override    ');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('required'));
  });

  it('rejects comment not starting with /override', () => {
    const result = parseOverride('please override');
    assert.equal(result.valid, false);
  });

  it('accepts exactly 20 character rationale', () => {
    const result = parseOverride('/override 12345678901234567890');
    assert.equal(result.valid, true);
    assert.equal(result.rationale.length, 20);
  });

  it('rejects 19 character rationale', () => {
    const result = parseOverride('/override 1234567890123456789');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('19 chars'));
  });
});
