'use strict';

/**
 * Slash command parser for governance agent.
 *
 * Parses /score, /vote, /coi, and /override commands from issue comments.
 * Validation rules match the existing workflow logic and the RFC-001 extensions.
 */

const VALID_FLAGS = ['donation', 'legal', 'reputational', 'security', 'coi'];
const VALID_RECOMMENDATIONS = ['escalate', 'approve', 'conditions', 'defer', 'decline', 'retract'];
const VALID_VOTE_TYPES = [
  'escalate', 'no-escalate',
  'approve', 'approve-with-conditions', 'decline', 'defer',
  'retract', 'no-retract',
];

const SCORE_CRITERIA = ['mission', 'quality', 'clarity', 'impact', 'risk'];

/**
 * Parse a /score command from a comment body.
 *
 * Format: /score mission:N quality:N clarity:N impact:N risk:N [--flags F1,F2] [--recommend R] [--notes "text"]
 * Each criterion score must be 0-5 (integer).
 *
 * Returns { valid, mission, quality, clarity, impact, risk, total, flags, recommend, notes, error }
 */
function parseScore(comment) {
  const trimmed = comment.trim();

  if (!trimmed.startsWith('/score ')) {
    return { valid: false, error: 'Comment does not start with "/score ".' };
  }

  const scores = {};

  for (const criterion of SCORE_CRITERIA) {
    // Match criterion:N where N can be a number (including negative for validation)
    const re = new RegExp(`${criterion}:\\s*(-?\\d+(?:\\.\\d+)?|[^\\s]+)`);
    const match = trimmed.match(re);

    if (!match) {
      return { valid: false, error: `Missing required criterion: ${criterion}.` };
    }

    const rawValue = match[1];
    const num = Number(rawValue);

    if (!Number.isInteger(num)) {
      return { valid: false, error: `Invalid value for ${criterion}: "${rawValue}" is not an integer.` };
    }

    if (num < 0) {
      return { valid: false, error: `Invalid value for ${criterion}: ${num} is below minimum (0).` };
    }

    if (num > 5) {
      return { valid: false, error: `Invalid value for ${criterion}: ${num} exceeds maximum (5).` };
    }

    scores[criterion] = num;
  }

  const total = SCORE_CRITERIA.reduce((sum, c) => sum + scores[c], 0);

  // Parse optional --flags
  let flags = [];
  const flagsMatch = trimmed.match(/--flags\s+(\S+)/);
  if (flagsMatch) {
    flags = flagsMatch[1].split(',').map(f => f.trim()).filter(f => f.length > 0);
  }

  // Parse optional --recommend
  let recommend = null;
  const recMatch = trimmed.match(/--recommend\s+(\S+)/);
  if (recMatch) {
    recommend = recMatch[1].trim();
  }

  // Parse optional --notes
  let notes = null;
  const notesMatch = trimmed.match(/--notes\s+"([^"]+)"/);
  if (notesMatch) {
    notes = notesMatch[1];
  }

  return {
    valid: true,
    mission: scores.mission,
    quality: scores.quality,
    clarity: scores.clarity,
    impact: scores.impact,
    risk: scores.risk,
    total,
    flags,
    recommend,
    notes,
  };
}

/**
 * Parse a /vote command from a comment body.
 *
 * Format: /vote <type>
 * type must be one of the VALID_VOTE_TYPES.
 *
 * Returns { valid, type, error }
 */
function parseVote(comment) {
  const trimmed = comment.trim();

  if (!trimmed.startsWith('/vote')) {
    return { valid: false, type: null, error: 'Comment does not start with "/vote".' };
  }

  // Extract the vote type (everything after "/vote", trimmed)
  const typeStr = trimmed.slice(5).trim();

  if (!typeStr) {
    return { valid: false, type: null, error: 'No vote type specified.' };
  }

  if (!VALID_VOTE_TYPES.includes(typeStr)) {
    return {
      valid: false,
      type: null,
      error: `Invalid vote type: "${typeStr}". Valid types: ${VALID_VOTE_TYPES.join(', ')}.`,
    };
  }

  return { valid: true, type: typeStr };
}

/**
 * Parse a /coi command from a comment body.
 *
 * Format: /coi [reason]
 * Reason is optional free text after the command.
 *
 * Returns { valid, reason }
 */
function parseCoi(comment) {
  const trimmed = comment.trim();

  if (!trimmed.startsWith('/coi')) {
    return { valid: false, reason: null };
  }

  // Extract reason (everything after "/coi", trimmed)
  const rest = trimmed.slice(4).trim();
  const reason = rest.length > 0 ? rest : null;

  return { valid: true, reason };
}

/**
 * Parse an /override command from a comment body.
 *
 * Format: /override <rationale>
 * Rationale is required and must be at least 20 characters.
 *
 * Returns { valid, rationale, error }
 */
function parseOverride(comment) {
  const trimmed = comment.trim();

  if (!trimmed.startsWith('/override')) {
    return { valid: false, rationale: null, error: 'Comment does not start with "/override".' };
  }

  const rest = trimmed.slice(9).trim();

  if (!rest || rest.length === 0) {
    return { valid: false, rationale: null, error: 'Rationale is required for /override.' };
  }

  if (rest.length < 20) {
    return {
      valid: false,
      rationale: rest,
      error: `Rationale too short (${rest.length} chars). Minimum 20 characters required.`,
    };
  }

  return { valid: true, rationale: rest };
}

module.exports = {
  parseScore,
  parseVote,
  parseCoi,
  parseOverride,
  VALID_FLAGS,
  VALID_RECOMMENDATIONS,
  VALID_VOTE_TYPES,
  SCORE_CRITERIA,
};
