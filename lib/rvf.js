'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Graph operations
// ---------------------------------------------------------------------------

/**
 * Load and parse the RVF knowledge graph from a JSON file.
 * Returns the parsed graph object with nodes and edges arrays.
 */
function loadGraph(graphPath) {
  const raw = fs.readFileSync(graphPath, 'utf8');
  const graph = JSON.parse(raw);
  if (!graph.nodes || !Array.isArray(graph.nodes)) {
    throw new Error('Graph must contain a "nodes" array.');
  }
  if (!graph.edges || !Array.isArray(graph.edges)) {
    throw new Error('Graph must contain an "edges" array.');
  }
  return graph;
}

/**
 * Build an adjacency list from the graph edges (undirected).
 * Returns a Map of nodeId to Set of connected nodeIds.
 */
function buildAdjacency(graph) {
  const adj = new Map();
  for (const node of graph.nodes) {
    adj.set(node.id, new Set());
  }
  for (const edge of graph.edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, new Set());
    if (!adj.has(edge.target)) adj.set(edge.target, new Set());
    adj.get(edge.source).add(edge.target);
    adj.get(edge.target).add(edge.source);
  }
  return adj;
}

/**
 * Find Conflict of Interest paths from a submitter to any committee member
 * using BFS, up to maxDepth edges.
 *
 * Returns an array of paths, where each path is an array of node IDs from
 * the submitter to the committee member.
 */
function findCoIPaths(graph, submitterId, maxDepth = 4) {
  const adj = buildAdjacency(graph);
  const committeeMemberIds = new Set(
    graph.nodes
      .filter(n => n.type === 'person' && n.properties && n.properties.role === 'committee_member')
      .map(n => n.id)
  );

  if (!adj.has(submitterId)) return [];

  const paths = [];
  // BFS with path tracking
  const queue = [{ nodeId: submitterId, path: [submitterId] }];
  const visited = new Set([submitterId]);

  while (queue.length > 0) {
    const { nodeId, path: currentPath } = queue.shift();

    if (currentPath.length > maxDepth + 1) continue;

    const neighbors = adj.get(nodeId);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;

      const newPath = [...currentPath, neighbor];

      if (committeeMemberIds.has(neighbor)) {
        paths.push(newPath);
        // Don't mark committee members as visited so we can find multiple paths
        continue;
      }

      if (newPath.length <= maxDepth) {
        visited.add(neighbor);
        queue.push({ nodeId: neighbor, path: newPath });
      }
    }
  }

  return paths;
}

/**
 * Find committee members affiliated with a given organization.
 * Looks for edges where a committee member has a relationship to the org node.
 */
function findCoIByOrg(graph, orgName) {
  // Find the org node by display_name or id
  const orgNode = graph.nodes.find(n =>
    n.type === 'organization' &&
    (n.id === orgName ||
     (n.properties && n.properties.display_name === orgName))
  );

  if (!orgNode) return [];

  const committeeMemberIds = new Set(
    graph.nodes
      .filter(n => n.type === 'person' && n.properties && n.properties.role === 'committee_member')
      .map(n => n.id)
  );

  const results = [];

  for (const edge of graph.edges) {
    // Check if a committee member is connected to this org
    if (edge.target === orgNode.id && committeeMemberIds.has(edge.source)) {
      const member = graph.nodes.find(n => n.id === edge.source);
      results.push({
        memberId: edge.source,
        displayName: member ? member.properties.display_name : edge.source,
        relationship: edge.relationship,
        properties: edge.properties,
      });
    }
    if (edge.source === orgNode.id && committeeMemberIds.has(edge.target)) {
      const member = graph.nodes.find(n => n.id === edge.target);
      results.push({
        memberId: edge.target,
        displayName: member ? member.properties.display_name : edge.target,
        relationship: edge.relationship,
        properties: edge.properties,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Embeddings operations
// ---------------------------------------------------------------------------

/**
 * Load the embeddings file.
 * Returns the parsed embeddings object.
 */
function loadEmbeddings(embeddingsPath) {
  const raw = fs.readFileSync(embeddingsPath, 'utf8');
  const data = JSON.parse(raw);
  if (!data.entries || !Array.isArray(data.entries)) {
    throw new Error('Embeddings file must contain an "entries" array.');
  }
  return data;
}

/**
 * Find submissions similar to a given category.
 * Returns entries whose metadata.category matches (string or array includes),
 * sorted by score descending.
 */
function findSimilar(embeddings, category, limit = 3) {
  const matches = embeddings.entries.filter(entry => {
    const cat = entry.metadata && entry.metadata.category;
    if (Array.isArray(cat)) return cat.includes(category);
    return cat === category;
  });

  // Sort by score descending (higher score = more relevant)
  matches.sort((a, b) => {
    const scoreA = (a.metadata && a.metadata.score) || 0;
    const scoreB = (b.metadata && b.metadata.score) || 0;
    return scoreB - scoreA;
  });

  return matches.slice(0, limit);
}

/**
 * Predict score range based on prior submissions in the same category.
 * Returns { min, max, median, count, message } or { message } if insufficient data.
 */
function predictScoreRange(embeddings, category) {
  const matches = embeddings.entries.filter(entry => {
    const cat = entry.metadata && entry.metadata.category;
    if (Array.isArray(cat)) return cat.includes(category);
    return cat === category;
  });

  const scores = matches
    .map(m => m.metadata && m.metadata.score)
    .filter(s => s != null && typeof s === 'number');

  if (scores.length < 2) {
    return {
      count: scores.length,
      message: `Insufficient data for prediction. Only ${scores.length} prior submission(s) in category "${category}".`,
    };
  }

  scores.sort((a, b) => a - b);
  const min = scores[0];
  const max = scores[scores.length - 1];
  const mid = Math.floor(scores.length / 2);
  const median = scores.length % 2 === 0
    ? (scores[mid - 1] + scores[mid]) / 2
    : scores[mid];

  return {
    min,
    max,
    median,
    count: scores.length,
    message: `Based on ${scores.length} prior submissions in "${category}": score range ${min}-${max} (median ${median}).`,
  };
}

// ---------------------------------------------------------------------------
// Attestation operations
// ---------------------------------------------------------------------------

/**
 * Append an attestation entry to the JSONL file.
 * Each entry is a single JSON object on its own line.
 */
function appendAttestation(attestationPath, entry) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(attestationPath, line, 'utf8');
}

/**
 * Read all attestation entries from the JSONL file.
 * Returns an array of parsed objects, skipping blank lines.
 */
function readAttestations(attestationPath) {
  if (!fs.existsSync(attestationPath)) return [];

  const raw = fs.readFileSync(attestationPath, 'utf8');
  return raw
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line));
}

module.exports = {
  loadGraph,
  buildAdjacency,
  findCoIPaths,
  findCoIByOrg,
  loadEmbeddings,
  findSimilar,
  predictScoreRange,
  appendAttestation,
  readAttestations,
};
