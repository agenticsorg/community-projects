// Mutation testing, with no dependencies.
//
// WHY THIS EXISTS. A passing test suite tells you the tests ran, not that they
// can fail. In #60 the OIA classifier shipped a promotion rule whose guard did
// nothing, together with a test that was supposed to guard it. The test only
// ever exercised the case where both inputs agreed, so it passed, and the
// defect reached the live matrix. Nothing in CI could have noticed, because
// every check was green and green was all they measured.
//
// This deliberately breaks the source one edit at a time and checks that the
// suite notices. A mutant the tests still pass is called a SURVIVOR, and it
// marks a line of behaviour nothing asserts on. Survivors are the output that
// matters; the score is just a summary of them.
//
// Zero dependencies on purpose. This repository has no runtime dependencies and
// no lockfile, which is a deliberate posture for a committee whose charter
// treats supply-chain risk as first-order. Pulling a mutation framework and its
// transitive tree in here to test our governance code would undercut the thing
// it is meant to protect.
//
// Usage:
//   node scripts/mutate.mjs                 # all targets
//   node scripts/mutate.mjs --target docs/oia-signals.mjs
//   node scripts/mutate.mjs --report mutation-report.md
//   node scripts/mutate.mjs --threshold 80  # exit 1 below this score

import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Targets. Source that encodes a governance or classification DECISION, where a
// silent behaviour change has consequences beyond a broken build. Build scripts
// and report formatters are deliberately out of scope: mutating a template
// string produces noise, not signal.
// ---------------------------------------------------------------------------
const TARGETS = [
  'docs/oia-signals.mjs',
  'lib/state-machine.js',
  'lib/workflow-guards.js',
  'lib/commands.js',
  'lib/rvf.js',
  'lib/repo-registry.js',
];

// ---------------------------------------------------------------------------
// Operators. Curated rather than exhaustive. Each one corresponds to a mistake
// that has actually been made in this repo or is one edit away from one:
// off-by-one thresholds, a dropped clause in a compound guard, an inverted
// comparison, a quantifier swapped for its weaker sibling.
// ---------------------------------------------------------------------------
const OPERATORS = [
  { id: 'gte-to-gt',      find: />=/g,            replace: '>',        label: '>= becomes >' },
  { id: 'lte-to-lt',      find: /<=/g,            replace: '<',        label: '<= becomes <' },
  { id: 'and-to-or',      find: /&&/g,            replace: '||',       label: '&& becomes ||' },
  { id: 'or-to-and',      find: /\|\|/g,          replace: '&&',       label: '|| becomes &&' },
  { id: 'eq-to-neq',      find: /===/g,           replace: '!==',      label: '=== becomes !==' },
  { id: 'neq-to-eq',      find: /!==/g,           replace: '===',      label: '!== becomes ===' },
  { id: 'every-to-some',  find: /\.every\(/g,     replace: '.some(',   label: '.every( becomes .some(' },
  { id: 'some-to-every',  find: /\.some\(/g,      replace: '.every(',  label: '.some( becomes .every(' },
  { id: 'true-to-false',  find: /\btrue\b/g,      replace: 'false',    label: 'true becomes false' },
  { id: 'false-to-true',  find: /\bfalse\b/g,     replace: 'true',     label: 'false becomes true' },
  { id: 'int-bump',       find: /(?<![.\w])([0-9]+)(?![.\w])/g, replace: m => String(Number(m) + 1), label: 'integer literal + 1' },
  // Makes one clause of a compound guard vacuous. If the suite still passes,
  // that clause is decoration: it is in the condition but nothing depends on it.
  { id: 'clause-vacuous', find: /\b[A-Za-z_$][\w$.]*\s*(?:>=|<=|>|<|===|!==)\s*[0-9]+/g, replace: 'true', label: 'comparison clause becomes always-true' },
];

// ---------------------------------------------------------------------------
// Mask comments and string/template/regex literals so a mutation never lands in
// prose. A mutated comment is always a survivor and always meaningless, and a
// few hundred of those would bury the real findings.
// ---------------------------------------------------------------------------
/**
 * Format a score so the printed number is safe to paste into the floor.
 *
 * `toFixed` ROUNDS, and that is a trap for this specific use. The first CI run
 * of this job failed its own baseline: 131/257 is 50.97%, which printed as
 * "51.0%", the floor was set from that printed value, and `score < threshold`
 * was then true against the very suite the floor was measured on. The
 * instrument rounded and its own output was read back as ground truth.
 *
 * Truncating toward zero makes the printed value a lower bound on the real one,
 * so a floor copied from this output can never exceed the score that produced
 * it. Two decimals, because one does not separate 50.97 from 51.
 */
export function fmtScore(score){
  return (Math.floor(score * 100) / 100).toFixed(2);
}

export function maskNonCode(src) {
  const out = src.split('');
  let i = 0;
  const blank = (from, to) => { for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '; };
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') { const end = src.indexOf('\n', i); const stop = end === -1 ? src.length : end; blank(i, stop); i = stop; continue; }
    if (two === '/*') { const end = src.indexOf('*/', i + 2); const stop = end === -1 ? src.length : end + 2; blank(i, stop); i = stop; continue; }
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) break;
        j++;
      }
      blank(i, j + 1); i = j + 1; continue;
    }
    i++;
  }
  return out.join('');
}

/** Every candidate mutation in a file, as {line, col, operator, before, after}. */
export function planMutations(src, targetPath) {
  const masked = maskNonCode(src);
  const plans = [];
  for (const op of OPERATORS) {
    op.find.lastIndex = 0;
    let m;
    while ((m = op.find.exec(masked)) !== null) {
      if (m[0].length === 0) { op.find.lastIndex++; continue; }
      const idx = m.index;
      const replacement = typeof op.replace === 'function' ? op.replace(m[0]) : op.replace;
      if (replacement === m[0]) continue;
      const line = src.slice(0, idx).split('\n').length;
      plans.push({
        file: targetPath, index: idx, length: m[0].length,
        operator: op.id, label: op.label,
        from: m[0], to: replacement,
        source: src.slice(0, idx) + replacement + src.slice(idx + m[0].length),
        context: src.split('\n')[line - 1].trim().slice(0, 110),
        line,
      });
    }
  }
  return plans.sort((a, b) => a.line - b.line);
}

function runSuite() {
  try {
    execFileSync('node', ['--test', ...expandTests()], { stdio: 'pipe', timeout: 120000 });
    return 'pass';
  } catch (e) {
    if (e.killed || e.signal) return 'timeout';
    return 'fail';
  }
}

function expandTests() {
  return readdirSync('test').filter(f => f.endsWith('.test.js')).map(f => 'test/' + f);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function arg(name, fallback = null) {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? fallback : process.argv[i + 1];
}

async function main() {
  const only = arg('target');
  const reportPath = arg('report');
  const threshold = arg('threshold') === null ? null : Number(arg('threshold'));
  const targets = (only ? [only] : TARGETS).filter(f => existsSync(f));

  // A suite that is already red tells us nothing about any mutant.
  process.stdout.write('baseline: ');
  if (runSuite() !== 'pass') {
    console.error('FAIL\nThe suite does not pass on unmutated source. Fix that before mutating.');
    process.exit(2);
  }
  console.log('suite passes on clean source');

  const results = [];
  for (const file of targets) {
    const original = readFileSync(file, 'utf8');
    const backup = file + '.mutation-backup';
    copyFileSync(file, backup);
    const plans = planMutations(original, file);
    console.log(`\n${file}: ${plans.length} mutants`);
    try {
      for (const [n, p] of plans.entries()) {
        writeFileSync(file, p.source);
        const verdict = runSuite();
        // 'fail' means the suite noticed. That is the outcome we want.
        const killed = verdict === 'fail' || verdict === 'timeout';
        results.push({ ...p, killed, verdict, source: undefined });
        process.stdout.write(killed ? '.' : 'S');
        if ((n + 1) % 60 === 0) process.stdout.write(` ${n + 1}/${plans.length}\n`);
      }
    } finally {
      // Restore unconditionally, including on Ctrl-C or a throw. A mutation
      // harness that can leave mutated source behind is a liability.
      copyFileSync(backup, file);
      unlinkSync(backup);
      if (readFileSync(file, 'utf8') !== original) {
        console.error(`\nFATAL: ${file} was not restored cleanly. Check git status before committing.`);
        process.exit(3);
      }
    }
  }

  const killed = results.filter(r => r.killed).length;
  const survivors = results.filter(r => !r.killed);
  const score = results.length ? (killed / results.length) * 100 : 100;

  console.log(`\n\n${killed}/${results.length} mutants killed. Mutation score ${fmtScore(score)}%.`);
  if (survivors.length) {
    console.log(`\n${survivors.length} SURVIVORS (behaviour no test asserts on):`);
    for (const s of survivors) console.log(`  ${s.file}:${s.line}  ${s.label}\n      ${s.context}`);
  }

  if (reportPath) {
    writeFileSync(reportPath, renderReport({ results, killed, survivors, score, targets }));
    console.log(`\nreport written to ${reportPath}`);
  }

  if (threshold !== null && score < threshold) {
    console.error(`\nMutation score ${fmtScore(score)}% is below the floor of ${threshold}%.`);
    console.error('Either add an assertion that kills a survivor above, or move the floor deliberately.');
    process.exit(1);
  }
}

function renderReport({ results, killed, survivors, score, targets }) {
  const byFile = {};
  for (const s of survivors) (byFile[s.file] ||= []).push(s);
  return [
    '# Mutation report', '',
    `**${killed}/${results.length} mutants killed. Score ${fmtScore(score)}%.**`, '',
    'A *survivor* is a deliberate break in the source that the test suite did not',
    'notice. It marks behaviour nothing asserts on. The score is a summary; the',
    'survivor list is the finding.', '',
    `Targets: ${targets.map(t => '`' + t + '`').join(', ')}`, '',
    survivors.length ? '## Survivors' : '## No survivors',
    '',
    ...Object.entries(byFile).flatMap(([file, rows]) => [
      `### \`${file}\` (${rows.length})`, '',
      '| line | mutation | source |', '|---|---|---|',
      ...rows.map(r => `| ${r.line} | ${r.label} | \`${r.context.replace(/\|/g, '\\|')}\` |`),
      '',
    ]),
  ].join('\n');
}

// Run ONLY when invoked directly. This module is imported by its own test file,
// and main() mutates real source files on disk; without this guard, importing it
// rewrites the repository as a side effect. Compare against a file:// URL built
// by pathToFileURL, not by string concatenation, so a checkout path containing a
// space still matches.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(2); });
}
