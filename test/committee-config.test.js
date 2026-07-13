import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../data/committee-config.json', import.meta.url)));

test('committee-config: members drive quorum, contributors do not', () => {
  // Quorum is Math.floor(members.length / 2) + 1 in the vote workflows.
  // Contributors MUST NOT be in members[], or they would change the quorum denominator.
  assert.equal(cfg.members.length, 6, 'voting roster size (quorum denominator) unchanged');
  const quorum = Math.floor(cfg.members.length / 2) + 1;
  assert.equal(quorum, 4, 'simple-majority quorum is 4');
});

test('committee-config: Craftsman is a non-voting contributor', () => {
  const contribLogins = (cfg.contributors || []).map((c) => c.login);
  assert.ok(contribLogins.includes('CraftsMan-Labs'), 'Craftsman listed as contributor');
  const memberLogins = cfg.members.map((m) => m.login);
  // Non-voting invariant: no login appears in both arrays.
  for (const l of contribLogins) {
    assert.ok(!memberLogins.includes(l), `${l} must not also be a voting member`);
  }
  for (const c of cfg.contributors || []) {
    assert.equal(c.role, 'contributor', `${c.login} role is contributor`);
  }
});
