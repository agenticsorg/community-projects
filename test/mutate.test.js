// Tests for the mutation harness itself.
//
// A tool that measures whether our assertions can fail needs to be trustworthy
// before its output means anything. An unverified verifier manufactures false
// confidence with authority, which is worse than no verifier.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { maskNonCode, planMutations, fmtScore } from '../scripts/mutate.mjs';

// ---------------------------------------------------------------------------
// Masking. A mutation landing in a comment or a string is always a survivor and
// always meaningless. If masking breaks, the report fills with noise and the
// real findings become unreadable.
// ---------------------------------------------------------------------------

test('line comments are masked', () => {
  const masked = maskNonCode('const a = 1; // set a >= 2 && b\nconst b = 2;');
  assert.ok(!masked.includes('>='), 'comparison inside a line comment must be masked');
  assert.ok(!masked.includes('&&'), 'operator inside a line comment must be masked');
  assert.ok(masked.includes('const a = 1;'), 'code before the comment survives');
  assert.ok(masked.includes('const b = 2;'), 'code after the newline survives');
});

test('block comments are masked across lines', () => {
  const masked = maskNonCode('/* a >= b && c\n   more >= here */\nconst x = 1;');
  assert.ok(!masked.includes('>='), 'block comment content must be masked');
  assert.ok(masked.includes('const x = 1;'));
});

test('string and template literals are masked', () => {
  for (const q of ['"', "'", '`']) {
    const masked = maskNonCode(`const s = ${q}a >= b && c${q}; const n = 1;`);
    assert.ok(!masked.includes('>='), `content inside ${q} quotes must be masked`);
    assert.ok(masked.includes('const n = 1;'), 'code after the string survives');
  }
});

test('an escaped quote does not end the string early', () => {
  const masked = maskNonCode('const s = "he said \\" a >= b"; const n = 1;');
  assert.ok(!masked.includes('>='), 'the escaped quote must not terminate the mask early');
});

test('masking preserves length and line structure so offsets stay valid', () => {
  const src = 'const a = 1; // note\nconst b = "x";\nconst c = 2;';
  const masked = maskNonCode(src);
  assert.equal(masked.length, src.length, 'mask must not change length; offsets index into the original');
  assert.equal(masked.split('\n').length, src.split('\n').length, 'line count must be preserved');
});

// ---------------------------------------------------------------------------
// Planning. Each plan must produce source that actually differs, at the right
// line, with a faithful record of what was changed.
// ---------------------------------------------------------------------------

test('a comparison in real code is planned', () => {
  const plans = planMutations('function f(n) { return n >= 3; }\n', 'x.js');
  const gte = plans.filter(p => p.operator === 'gte-to-gt');
  assert.equal(gte.length, 1);
  assert.match(gte[0].source, /n > 3/);
  assert.equal(gte[0].line, 1);
});

test('a comparison in a comment is NOT planned', () => {
  const plans = planMutations('// return n >= 3\nconst x = 1;\n', 'x.js');
  assert.equal(plans.filter(p => p.operator === 'gte-to-gt').length, 0);
});

test('every plan changes the source', () => {
  const src = 'function f(a, b) {\n  if (a >= 3 && b === 1) return true;\n  return false;\n}\n';
  const plans = planMutations(src, 'x.js');
  assert.ok(plans.length > 0, 'this source should yield mutants');
  for (const p of plans) {
    assert.notEqual(p.source, src, `plan ${p.operator} at line ${p.line} produced identical source`);
  }
});

test('line numbers point at the mutated line', () => {
  const src = 'const a = 1;\nconst b = 2;\nif (a >= b) {}\n';
  const plans = planMutations(src, 'x.js').filter(p => p.operator === 'gte-to-gt');
  assert.equal(plans.length, 1);
  assert.equal(plans[0].line, 3, 'the >= is on line 3');
});

test('the vacuous-clause operator neutralises a guard', () => {
  const src = 'function f(total, n) { if (total > 0 && n > total / 2) return true; return false; }\n';
  const plans = planMutations(src, 'x.js').filter(p => p.operator === 'clause-vacuous');
  assert.ok(plans.length >= 1, 'a comparison clause should be replaceable with true');
  assert.ok(plans.some(p => /if \(true &&/.test(p.source)),
    'one plan should make the leading guard clause always-true');
});

test('the integer operator increments rather than zeroing', () => {
  const plans = planMutations('const cap = 6000;\n', 'x.js').filter(p => p.operator === 'int-bump');
  assert.equal(plans.length, 1);
  assert.match(plans[0].source, /const cap = 6001;/);
});

test('plans are returned in line order so the report reads top to bottom', () => {
  const src = 'if (a >= 1) {}\nif (b >= 2) {}\nif (c >= 3) {}\n';
  const lines = planMutations(src, 'x.js').map(p => p.line);
  assert.deepEqual(lines, [...lines].sort((x, y) => x - y));
});

test('source with nothing mutable yields no plans', () => {
  assert.deepEqual(planMutations('// just a comment\n', 'x.js'), []);
});

// ---------------------------------------------------------------------------
// Import safety. main() rewrites real source files on disk. If it runs on
// import, importing this module from anywhere mutates the repository. That is
// exactly what happened on the first CI run of this job: the mutation pass
// executed during `npm test`, rewrote lib/ and docs/ underneath the other test
// processes, and turned unrelated tests red. It passed locally only by a race.
// ---------------------------------------------------------------------------
test('importing the harness does not mutate anything', async () => {
  const target = 'docs/oia-signals.mjs';
  const before = readFileSync(target, 'utf8');
  await import('../scripts/mutate.mjs?import-safety-probe');
  await new Promise(r => setTimeout(r, 150));
  assert.equal(readFileSync(target, 'utf8'), before,
    'importing scripts/mutate.mjs must not touch source files');
});

// ---------------------------------------------------------------------------
// Score formatting. The printed score is copied into the workflow's floor, so
// it has to be a LOWER bound on the real value. `toFixed` rounds, and that
// failed the gate on its own baseline: 131/257 is 50.97%, printed as "51.0%",
// floor set to 51, and 50.97 < 51.
// ---------------------------------------------------------------------------
test('the printed score truncates rather than rounds, so it is safe as a floor', () => {
  const real = (131 / 257) * 100;            // 50.97276...
  assert.equal(fmtScore(real), '50.97');
  assert.ok(Number(fmtScore(real)) <= real,
    'the printed value must never exceed the real score, or a copied floor fails its own baseline');
});

test('a score that would round UP is still printed down', () => {
  assert.equal(fmtScore(50.999), '50.99', 'must not print 51.00');
  assert.equal(fmtScore(99.999), '99.99', 'must not print 100.00 for an imperfect suite');
  assert.ok(Number(fmtScore(50.999)) <= 50.999);
});

test('exact values are preserved', () => {
  assert.equal(fmtScore(100), '100.00');
  assert.equal(fmtScore(0), '0.00');
  assert.equal(fmtScore(51), '51.00');
});

test('a floor copied from the output always passes the suite it was measured on', () => {
  // The property the gate actually needs, stated as a property.
  for (const [killed, total] of [[131, 257], [1, 3], [2, 3], [99, 100], [7, 9], [0, 5], [5, 5]]) {
    const score = (killed / total) * 100;
    const floor = Number(fmtScore(score));
    assert.ok(!(score < floor),
      `floor ${floor} copied from ${killed}/${total} must not fail score ${score}`);
  }
});
