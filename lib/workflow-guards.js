'use strict';

/**
 * Workflow Guard Functions
 *
 * Shared logic for the three P0 governance fixes:
 * 1. State machine phase guards -- verify issue is in the correct phase
 * 2. Submitter exclusion -- exclude the issue author from voting
 * 3. Idempotency -- prevent duplicate registry entries
 *
 * These functions are designed to be called from GitHub Actions workflows
 * (via actions/github-script) or from unit tests with mocked inputs.
 */

// ---------------------------------------------------------------------------
// P0-1: State Machine Phase Guards
// ---------------------------------------------------------------------------

/**
 * Map from workflow action to the required status label(s).
 * The issue MUST have at least one of these labels for the workflow to proceed.
 * This prevents phase-skipping (e.g., applying status:approved without voting).
 */
const PHASE_REQUIREMENTS = {
  // Scoring: issue must be in triaged or scoring phase
  'scoring': ['status:triaged', 'status:scoring'],

  // Escalation vote: issue must be in scoring or escalation-vote phase
  'escalation-vote': ['status:scoring', 'status:escalation-vote'],

  // Validation vote: issue must be in escalation-vote (not-escalated result) or validation-vote phase
  'validation-vote': ['status:validation-vote'],

  // Approval registration: issue must have been through validation vote
  'approve-project': ['status:approved', 'status:approved-with-conditions'],

  // Retraction proposal: issue must be approved/monitoring (has an approval status)
  'retraction-propose': ['status:approved', 'status:approved-with-conditions', 'status:monitoring'],

  // Retraction vote: issue must have retraction proposed
  'retraction-vote': ['status:retraction-proposed'],
};

/**
 * Check whether an issue has the required phase label for a given workflow action.
 *
 * @param {string[]} issueLabels - Array of label names currently on the issue
 * @param {string} workflowAction - The workflow action key (from PHASE_REQUIREMENTS)
 * @returns {{ allowed: boolean, reason: string, requiredLabels: string[] }}
 */
function checkPhaseGuard(issueLabels, workflowAction) {
  const requiredLabels = PHASE_REQUIREMENTS[workflowAction];

  if (!requiredLabels) {
    return {
      allowed: false,
      reason: `Unknown workflow action: "${workflowAction}".`,
      requiredLabels: [],
    };
  }

  const hasRequired = issueLabels.some(label => requiredLabels.includes(label));

  if (hasRequired) {
    const matchedLabel = issueLabels.find(label => requiredLabels.includes(label));
    return {
      allowed: true,
      reason: `Issue has required phase label: "${matchedLabel}".`,
      requiredLabels,
    };
  }

  return {
    allowed: false,
    reason: `Issue is not in the correct phase. Required one of: [${requiredLabels.join(', ')}]. Current labels: [${issueLabels.join(', ')}].`,
    requiredLabels,
  };
}

// ---------------------------------------------------------------------------
// P0-2: Submitter Exclusion
// ---------------------------------------------------------------------------

/**
 * Filter out the submitter from a vote tally.
 * The submitter of the issue should never be counted in any vote.
 *
 * For retraction votes specifically, the original project submitter
 * (the person who opened the issue) must be excluded from voting.
 *
 * @param {Array<{login: string, body: string, isBot: boolean}>} comments - Normalized comments
 * @param {string} submitterLogin - The GitHub login of the issue author
 * @returns {Array<{login: string, body: string, isBot: boolean}>} Filtered comments
 */
function excludeSubmitter(comments, submitterLogin) {
  if (!submitterLogin) return comments;
  return comments.filter(c => c.login !== submitterLogin);
}

/**
 * Check if a voter is the submitter and should be excluded.
 *
 * @param {string} voterLogin - The GitHub login of the voter
 * @param {string} submitterLogin - The GitHub login of the issue author
 * @returns {{ excluded: boolean, reason: string }}
 */
function isSubmitterExcluded(voterLogin, submitterLogin) {
  if (!submitterLogin || !voterLogin) {
    return { excluded: false, reason: 'Missing login information.' };
  }

  if (voterLogin === submitterLogin) {
    return {
      excluded: true,
      reason: `Voter "${voterLogin}" is the issue submitter and is excluded from voting.`,
    };
  }

  return {
    excluded: false,
    reason: `Voter "${voterLogin}" is not the submitter.`,
  };
}

// ---------------------------------------------------------------------------
// P0-3: Idempotency -- Prevent Duplicate Registry Entries
// ---------------------------------------------------------------------------

/**
 * Check if a project is already in the registry by issue number.
 * Prevents duplicate entries when workflows re-run.
 *
 * @param {Array<object>} registry - The approved-projects registry array
 * @param {number} issueNumber - The issue number to check
 * @returns {{ exists: boolean, existingEntry: object|null, reason: string }}
 */
function checkRegistryDuplicate(registry, issueNumber) {
  if (!Array.isArray(registry)) {
    return {
      exists: false,
      existingEntry: null,
      reason: 'Registry is not an array.',
    };
  }

  const existing = registry.find(p => p.issue_number === issueNumber);

  if (existing) {
    return {
      exists: true,
      existingEntry: existing,
      reason: `Project from issue #${issueNumber} already exists in registry as "${existing.id}" (status: ${existing.status}).`,
    };
  }

  return {
    exists: false,
    existingEntry: null,
    reason: `No existing entry for issue #${issueNumber}.`,
  };
}

/**
 * Check if a retraction has already been applied to a registry entry.
 * Prevents double-retraction on workflow re-run.
 *
 * @param {Array<object>} registry - The approved-projects registry array
 * @param {number} issueNumber - The issue number to check
 * @returns {{ alreadyRetracted: boolean, entry: object|null, reason: string }}
 */
function checkAlreadyRetracted(registry, issueNumber) {
  if (!Array.isArray(registry)) {
    return {
      alreadyRetracted: false,
      entry: null,
      reason: 'Registry is not an array.',
    };
  }

  const existing = registry.find(p => p.issue_number === issueNumber);

  if (!existing) {
    return {
      alreadyRetracted: false,
      entry: null,
      reason: `No registry entry found for issue #${issueNumber}.`,
    };
  }

  if (existing.status === 'retracted') {
    return {
      alreadyRetracted: true,
      entry: existing,
      reason: `Project from issue #${issueNumber} is already retracted (retracted on ${existing.retracted_date}).`,
    };
  }

  return {
    alreadyRetracted: false,
    entry: existing,
    reason: `Project from issue #${issueNumber} exists with status "${existing.status}".`,
  };
}

module.exports = {
  PHASE_REQUIREMENTS,
  checkPhaseGuard,
  excludeSubmitter,
  isSubmitterExcluded,
  checkRegistryDuplicate,
  checkAlreadyRetracted,
};
