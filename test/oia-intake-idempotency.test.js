// Tests for at-most-once notification on the OIA intake path.
//
// Context. Every workflow here can fire more than once for the same issue:
// `opened` and `labeled` both trigger intake, a persist retry re-runs the step,
// and re-applying a label to re-run the pipeline is a supported remediation.
//
// On 2026-09-28 all five open submissions were label-cycled to backfill the
// notifications they never received while the label race was live. #44 finally
// got its case brief after 49 days, which was the point. But #51 and #53 each
// received a SECOND "Added to the OIA Application Matrix" comment, because this
// script was the one comment path that did not get the guard its siblings got
// in #58. An outside contributor was notified twice for one submission.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alreadyPosted, PENDING_MARKER, PROMOTED_MARKER } from '../scripts/oia-intake-step.mjs';

const comment = body => ({ body });

test('a previously posted pending notice is detected', () => {
  const comments = [
    comment('This is a matrix-listing submission made with the repository issue form fields.'),
    comment('### Added to the OIA Application Matrix (pending review)\n\n`RobLe3/IICP` has been auto-classified...'),
    comment('Reviewer evidence update: the IICP repository now contains a mapping...'),
  ];
  assert.equal(alreadyPosted(comments, PENDING_MARKER), true,
    'the duplicate that reached #51 and #53 must be detected');
});

test('an issue that has never been notified is not blocked', () => {
  const comments = [
    comment('Reviewer clarification: the Rust directory is an operator preview.'),
    comment('Thank you for your submission, Rob Lee!'),
  ];
  assert.equal(alreadyPosted(comments, PENDING_MARKER), false,
    'a first notification must still go out');
});

test('an empty or absent comment list is not treated as a match', () => {
  assert.equal(alreadyPosted([], PENDING_MARKER), false);
  assert.equal(alreadyPosted(undefined, PENDING_MARKER), false);
  assert.equal(alreadyPosted(null, PENDING_MARKER), false);
});

test('the promotion notice has its own marker and the two do not collide', () => {
  const promoted = [comment('✅ **RobLe3/IICP** promoted to the curated OIA Application Matrix: https://...')];
  assert.equal(alreadyPosted(promoted, PROMOTED_MARKER), true);
  assert.equal(alreadyPosted(promoted, PENDING_MARKER), false,
    'a promotion notice must not suppress a pending notice, or vice versa');

  const pending = [comment('### Added to the OIA Application Matrix (pending review)')];
  assert.equal(alreadyPosted(pending, PENDING_MARKER), true);
  assert.equal(alreadyPosted(pending, PROMOTED_MARKER), false);
});

test('malformed comment objects do not throw', () => {
  // The API has returned entries without a body before; a crash here would take
  // down the whole intake step rather than skipping one check.
  const junk = [null, undefined, {}, { body: null }, { body: 42 }, comment('ok')];
  assert.equal(alreadyPosted(junk, PENDING_MARKER), false);
  assert.equal(alreadyPosted([...junk, comment(PENDING_MARKER + ' (pending review)')], PENDING_MARKER), true);
});

test('the markers match the real comment bodies this repo has posted', () => {
  // Verbatim openings of the two bot comments as they appear on the live issues.
  // If a heading is reworded without updating its marker, duplicates come back
  // silently. This test is what makes that a build failure instead.
  const liveePending = '### Added to the OIA Application Matrix (pending review)\n\n`bar181/aisp-open-core` has been auto-classified into the **pending review** band.';
  const livePromoted = '✅ **acme/thing** promoted to the curated OIA Application Matrix: https://agenticsorg.github.io/community-projects/oia-matrix.html#oia-acme-thing';
  assert.ok(liveePending.includes(PENDING_MARKER), 'PENDING_MARKER must appear in the real pending comment');
  assert.ok(livePromoted.includes(PROMOTED_MARKER), 'PROMOTED_MARKER must appear in the real promotion comment');
});

test('importing the intake script does not run intake', async () => {
  // This module posts comments and mutates the matrix. If its dispatch ran on
  // import, importing it from a test would act on a live issue.
  const mod = await import('../scripts/oia-intake-step.mjs?idempotency-probe');
  assert.deepEqual(Object.keys(mod).sort(), ['PENDING_MARKER', 'PROMOTED_MARKER', 'alreadyPosted'],
    'the module should expose only the testable surface when imported');
});
