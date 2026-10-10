// Golden-fixture tests for the OIA classifier's signal layer.
//
// Fixtures under test/fixtures/oia/ are frozen captures of real GitHub repos
// (file tree + README + topics + language, captured 2026-09-22). They run with
// NO network, so a regex typo or a corpus-construction change is caught in CI
// instead of shipping to the live matrix.
//
// Covers issue #48 (boilerplate false positives) and #49 (zero test coverage).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  LSIG, SSIG, BOILERPLATE, SCAN_CAP, denoisePaths, buildCorpus, classifySignals, cnt,
} from '../docs/oia-signals.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = n => JSON.parse(readFileSync(join(HERE, 'fixtures', 'oia', n + '.json'), 'utf8'));
const score = n => classifySignals(buildCorpus(fixture(n)));
const spanLabels = r => r.spans.map(s => s.label).sort();

// ---------------------------------------------------------------------------
// Issue #48 — the reproduction case.
//
// sindresorhus/slugify is a 15-file string utility. Before the fix it landed on
// L7 Orchestration (because .github/workflows/ matched /workflow/) and picked up
// a security span (because .github/SECURITY.md matched /security/). Neither
// signal says anything about the project.
// ---------------------------------------------------------------------------
test('#48: a trivial string utility gets no layers and no spans', () => {
  const r = score('slugify');
  assert.deepEqual(r.layers, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'slugify should sit on no OIA layer; got ' + JSON.stringify(r.layers));
  assert.deepEqual(r.spans, [], 'slugify should carry no spans');
});

test('#48: .github scaffolding is the thing that used to drive those hits', () => {
  const f = fixture('slugify');
  const raw = f.paths.map(p => p.toLowerCase());
  // The boilerplate really is present in the repo...
  assert.ok(raw.some(p => /^\.github\/workflows\//.test(p)), 'fixture should contain .github/workflows/');
  assert.ok(raw.some(p => /^\.github\/security\.md$/.test(p)), 'fixture should contain .github/security.md');
  // ...and matches the L7 and security signals when left in the corpus.
  assert.ok(cnt(LSIG[7], raw.join(' ')) >= 1, 'raw tree would hit L7');
  assert.ok(cnt(SSIG.security, raw.join(' ')) >= 1, 'raw tree would hit the security span');
  // De-noising is what removes them.
  const kept = denoisePaths(raw);
  assert.equal(cnt(LSIG[7], kept.join(' ')), 0, 'de-noised tree must not hit L7');
  assert.equal(cnt(SSIG.security, kept.join(' ')), 0, 'de-noised tree must not hit the security span');
});

test('boilerplate exclusion drops scaffolding and keeps project files', () => {
  const kept = denoisePaths([
    '.github/workflows/ci.yml', '.github/security.md', 'package-lock.json',
    'license', 'code_of_conduct.md', 'node_modules/left-pad/index.js',
    'src/orchestrator.ts', 'docs/adr/adr-001.md', 'readme.md',
  ]);
  assert.deepEqual(kept, ['src/orchestrator.ts', 'docs/adr/adr-001.md', 'readme.md']);
});

test('every boilerplate pattern is anchored (no accidental substring matches)', () => {
  for (const rx of BOILERPLATE) {
    assert.ok(rx.source.startsWith('^'), `BOILERPLATE pattern ${rx} must be anchored at ^`);
  }
  // A project file that merely mentions a boilerplate word must survive.
  assert.deepEqual(denoisePaths(['src/security/scanner.ts', 'docs/contributing-guide.md']),
    ['src/security/scanner.ts', 'docs/contributing-guide.md']);
});

// ---------------------------------------------------------------------------
// Issue #48 — word boundaries on substring-prone tokens.
// ---------------------------------------------------------------------------
test('#48: common English no longer inflates layer/span hits', () => {
  const prose = 'we acknowledged the redesigned solicitation and excited the observer';
  assert.equal(cnt(LSIG[6], prose), 0, '"acknowledged" must not count as /knowledge/');
  assert.equal(cnt(SSIG.provenance, prose), 0, '"redesigned"/"solicitation" must not count as provenance');
});

test('the real tokens still match after adding boundaries', () => {
  assert.ok(cnt(LSIG[6], 'a knowledge graph over knowledgebase docs') >= 1);
  assert.ok(cnt(LSIG[3], 'a vector store with vectorized embeddings') >= 1);
  assert.ok(cnt(SSIG.provenance, 'every release is signed and we ship signing keys') >= 1);
  assert.ok(cnt(SSIG.provenance, 'each claim carries a citation') >= 1);
});

// ---------------------------------------------------------------------------
// Centre-of-gravity rule: 3+ signals AND at least one from the project's prose.
// ---------------------------------------------------------------------------
test('a centre of gravity needs corroboration from the project prose', () => {
  const paths = ['src/orchestrator.ts', 'src/agents/swarm.ts', 'src/workflow/run.ts'];
  const treeOnly = classifySignals(buildCorpus({ paths, readme: '', topics: [], language: '' }));
  assert.equal(treeOnly.layers[7], 1, 'file paths alone give presence, not a centre of gravity');

  const corroborated = classifySignals(buildCorpus({
    paths, readme: 'An agent orchestration runtime.', topics: [], language: '',
  }));
  assert.equal(corroborated.layers[7], 2, 'prose corroboration promotes it to centre of gravity');
});

test('classifySignals accepts either a raw input or a prebuilt corpus', () => {
  const input = fixture('iicp');
  const a = classifySignals(input);
  const b = classifySignals(buildCorpus(input));
  assert.deepEqual(a.layers, b.layers);
  assert.deepEqual(spanLabels(a), spanLabels(b));
});

// ---------------------------------------------------------------------------
// Golden vectors. These are the CURRENT outputs, frozen deliberately: the point
// is that any change to the signal maps or corpus construction shows up here as
// a failing diff for the committee to accept or reject, not silently on the
// live matrix. They are a change detector, not a claim of correctness.
// ---------------------------------------------------------------------------
const GOLDEN = {
  slugify:              { layers: [0,0,0,0,0,0,0,0,0,0], spans: [] },
  'community-projects': { layers: [0,0,1,1,0,0,0,1,1,1], spans: ['auditability','provenance','sovereignty'] },
  iicp:                 { layers: [0,0,1,1,0,2,1,1,1,0], spans: ['auditability','identity','provenance','security','sovereignty'] },
  'lean-agentic':       { layers: [0,2,0,2,2,2,2,2,2,1], spans: ['auditability','identity','provenance','security','sovereignty'] },
};

for (const [name, want] of Object.entries(GOLDEN)) {
  test(`golden vector: ${name}`, () => {
    const r = score(name);
    assert.deepEqual(r.layers, want.layers, `layer vector drift for ${name}`);
    assert.deepEqual(spanLabels(r), want.spans, `span drift for ${name}`);
  });
}

test('every fixture classifies without throwing and returns a well-formed shape', () => {
  for (const name of Object.keys(GOLDEN)) {
    const r = score(name);
    assert.equal(r.layers.length, 10, `${name}: expected 10 layers`);
    assert.ok(r.layers.every(v => v === 0 || v === 1 || v === 2), `${name}: layer values must be 0|1|2`);
    for (const s of r.spans) {
      assert.ok(Object.hasOwn(SSIG, s.label), `${name}: unknown span ${s.label}`);
      assert.ok(typeof s.badge === 'string' && s.badge.length, `${name}: span ${s.label} missing badge`);
    }
    assert.ok(r.corpus.kept > 0, `${name}: de-noising must not empty the corpus`);
  }
});

// ---------------------------------------------------------------------------
// Issue #50 — the server/client twin is gone by construction. This test fails
// if anyone reintroduces a hand-copied signal map in the page.
// ---------------------------------------------------------------------------
test('#50: the matrix page defines no signal maps of its own', () => {
  const page = readFileSync(join(HERE, '..', 'docs', 'oia-matrix.html'), 'utf8');
  assert.ok(page.includes('oia-signals.mjs'),
    'the page must import the shared signal module');
  assert.doesNotMatch(page, /const\s+LSIG\s*=/,
    'the page must not redeclare LSIG; import it from docs/oia-signals.mjs');
  assert.doesNotMatch(page, /const\s+SSIG\s*=/,
    'the page must not redeclare SSIG; import it from docs/oia-signals.mjs');
});

test('#50: the server classifier defines no signal maps of its own', () => {
  const src = readFileSync(join(HERE, '..', 'scripts', 'classify-oia.mjs'), 'utf8');
  assert.ok(src.includes("from '../docs/oia-signals.mjs'"),
    'classify-oia.mjs must import the shared signal module');
  assert.doesNotMatch(src, /const\s+LSIG\s*=/, 'classify-oia.mjs must not redeclare LSIG');
  assert.doesNotMatch(src, /const\s+SSIG\s*=/, 'classify-oia.mjs must not redeclare SSIG');
});

// ---------------------------------------------------------------------------
// Issue #64 defect 1 — scaffolding and scan-cap truncation are different things
// and must be counted separately.
//
// buildCorpus used to compute `dropped` against the pre-cap length, so the two
// were summed and the narrative attributed all of it to scaffolding. On
// future-agi/future-agi that published "6455 scaffolding paths excluded" when
// 58 were scaffolding and 6397 were simply beyond the scan cap: an overstatement
// of roughly 110x, and it concealed that only 48% of the repo was read.
//
// It stayed latent because every earlier submission was smaller than the cap,
// so `dropped` was 0 and the parenthetical never rendered.
// ---------------------------------------------------------------------------
test('#64: dropped counts scaffolding only, truncated counts the scan-cap overflow', () => {
  const scaffolding = ['.github/workflows/ci.yml', 'package-lock.json', 'license'];
  const overflow = 500;
  const real = Array.from({ length: SCAN_CAP + overflow }, (_, i) => `src/mod${i}.ts`);
  const c = buildCorpus({ paths: [...scaffolding, ...real] });

  assert.equal(c.dropped, scaffolding.length,
    'dropped must count de-noised scaffolding only, never the scan-cap overflow');
  assert.equal(c.truncated, overflow,
    'truncated must count the paths discarded by the scan cap');
  assert.equal(c.kept, SCAN_CAP, 'kept is capped at SCAN_CAP');
});

test('#64: a repo under the scan cap reports no truncation', () => {
  const c = buildCorpus({ paths: ['.github/workflows/ci.yml', 'src/a.ts', 'src/b.ts'] });
  assert.equal(c.dropped, 1, 'the workflow file is scaffolding');
  assert.equal(c.truncated, 0, 'nothing was beyond the cap');
  assert.equal(c.kept, 2);
});

test('#64: kept + dropped + truncated accounts for every input path', () => {
  const paths = ['license', ...Array.from({ length: SCAN_CAP + 7 }, (_, i) => `pkg/f${i}.py`)];
  const c = buildCorpus({ paths });
  assert.equal(c.kept + c.dropped + c.truncated, paths.length,
    'the three counters must partition the input, with nothing unaccounted for');
});
