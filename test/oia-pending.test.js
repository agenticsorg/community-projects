// Round-trip tests for the OIA pending -> curated promotion path.
//
// These run the real scripts as subprocesses against a throwaway checkout-shaped
// temp dir, so they exercise the actual file mutation and badge generation with
// no network and no writes to the repo. Part of issue #49.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A temp dir shaped like the repo, holding only what these scripts touch. */
function sandbox(matrix) {
  const dir = mkdtempSync(join(tmpdir(), 'oia-pending-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'data'), { recursive: true });
  for (const f of ['promote-pending.mjs', 'build-badges.mjs']) {
    copyFileSync(join(REPO, 'scripts', f), join(dir, 'scripts', f));
  }
  writeFileSync(join(dir, 'docs', 'data', 'oia-matrix.json'), JSON.stringify(matrix, null, 2) + '\n');
  return dir;
}
const run = (dir, ...args) => execFileSync('node', args, { cwd: dir, encoding: 'utf8' });
const matrixOf = dir => JSON.parse(readFileSync(join(dir, 'docs', 'data', 'oia-matrix.json'), 'utf8'));

const entry = (name, over = {}) => ({
  name,
  desc: name,
  layers: [0, 0, 1, 1, 0, 0, 0, 2, 1, 0],
  spans: [{ label: 'auditability', badge: 'aud' }],
  notes: {},
  narrative: 'fixture',
  category: 'app',
  evidence: { t: 'auto', n: 'fixture capture' },
  gaps: [],
  status: 'pending',
  submitted: '2026-09-22',
  issue: 999,
  ...over,
});

test('promote moves a row pending -> curated exactly once', () => {
  const dir = sandbox({ curated: [entry('acme/already', { status: 'curated' })], pending: [entry('acme/candidate')] });
  try {
    const out = run(dir, 'scripts/promote-pending.mjs', 'acme/candidate');
    assert.match(out, /PROMOTED=acme\/candidate/);

    const m = matrixOf(dir);
    assert.deepEqual(m.pending.map(e => e.name), [], 'pending must be emptied');
    assert.deepEqual(m.curated.map(e => e.name), ['acme/already', 'acme/candidate']);

    const moved = m.curated.find(e => e.name === 'acme/candidate');
    assert.equal(moved.status, 'curated');
    assert.equal(moved.layers.length, 10, 'the layer vector must survive the move intact');
    assert.deepEqual(moved.layers, entry('x').layers);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('promotion downgrades the evidence tier claim from auto to desc, never to code', () => {
  const dir = sandbox({ curated: [], pending: [entry('acme/candidate')] });
  try {
    run(dir, 'scripts/promote-pending.mjs', 'acme/candidate');
    const e = matrixOf(dir).curated[0];
    assert.equal(e.evidence.t, 'desc',
      'a committee vote is not a source audit; the tier must land on desc');
    assert.notEqual(e.evidence.t, 'code',
      'nothing in the automated path may ever claim code-verified evidence (AF-GOV-002)');
    assert.match(e.evidence.n, /not yet audited against source/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('promoting an unknown repo is a no-op, not a corruption', () => {
  const before = { curated: [entry('acme/already', { status: 'curated' })], pending: [entry('acme/candidate')] };
  const dir = sandbox(before);
  try {
    const out = run(dir, 'scripts/promote-pending.mjs', 'acme/nope');
    assert.match(out, /NOT_PENDING/);
    const m = matrixOf(dir);
    assert.deepEqual(m.pending.map(e => e.name), ['acme/candidate']);
    assert.deepEqual(m.curated.map(e => e.name), ['acme/already']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('promoting twice does not duplicate the curated row', () => {
  const dir = sandbox({ curated: [], pending: [entry('acme/candidate')] });
  try {
    run(dir, 'scripts/promote-pending.mjs', 'acme/candidate');
    const out2 = run(dir, 'scripts/promote-pending.mjs', 'acme/candidate');
    assert.match(out2, /NOT_PENDING/);
    assert.equal(matrixOf(dir).curated.filter(e => e.name === 'acme/candidate').length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('promotion regenerates a badge for every row on both sides of the matrix', () => {
  const dir = sandbox({ curated: [entry('acme/already', { status: 'curated' })], pending: [entry('acme/candidate'), entry('acme/waiting')] });
  try {
    run(dir, 'scripts/promote-pending.mjs', 'acme/candidate');
    for (const n of ['acme/already', 'acme/candidate', 'acme/waiting']) {
      const p = join(dir, 'docs', 'badges', n + '.svg');
      assert.ok(existsSync(p), `badge missing for ${n}`);
      const svg = readFileSync(p, 'utf8');
      assert.match(svg, /^<svg xmlns=/, `badge for ${n} is not an SVG`);
      assert.match(svg, /L7/, `badge for ${n} should name its centre-of-gravity layer`);
    }
    // The promoted row's badge must state the new, lower-confidence tier.
    assert.match(readFileSync(join(dir, 'docs', 'badges', 'acme/candidate.svg'), 'utf8'), /desc/);
    assert.match(readFileSync(join(dir, 'docs', 'badges', 'acme/waiting.svg'), 'utf8'), /auto/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('badge text escapes markup from an untrusted repo name', () => {
  const dir = sandbox({ curated: [], pending: [entry('acme/candidate', { desc: '<script>alert(1)</script>' })] });
  try {
    run(dir, 'scripts/promote-pending.mjs', 'acme/candidate');
    const svg = readFileSync(join(dir, 'docs', 'badges', 'acme/candidate.svg'), 'utf8');
    assert.doesNotMatch(svg, /<script>/, 'badge must not embed raw markup');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
