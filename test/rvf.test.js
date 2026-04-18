'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {
  loadGraph,
  findCoIPaths,
  findCoIByOrg,
  loadEmbeddings,
  findSimilar,
  predictScoreRange,
  appendAttestation,
  readAttestations,
} = require('../lib/rvf.js');

const GRAPH_PATH = path.resolve(__dirname, '..', 'data', 'rvf', 'graph.json');
const EMBEDDINGS_PATH = path.resolve(__dirname, '..', 'data', 'rvf', 'embeddings.json');

describe('RVF Graph', () => {

  it('loads the seed graph successfully', () => {
    const graph = loadGraph(GRAPH_PATH);
    assert.ok(graph.nodes.length > 0);
    assert.ok(graph.edges.length > 0);
  });

  it('graph has expected node types', () => {
    const graph = loadGraph(GRAPH_PATH);
    const types = new Set(graph.nodes.map(n => n.type));
    assert.ok(types.has('person'));
    assert.ok(types.has('organization'));
    assert.ok(types.has('submission'));
  });

  it('graph integrity: all edge sources and targets exist in nodes (excluding dynamic refs)', () => {
    const graph = loadGraph(GRAPH_PATH);
    const nodeIds = new Set(graph.nodes.map(n => n.id));
    for (const edge of graph.edges) {
      // Dynamic edges added at runtime (e.g., recused_from issue-N) may reference
      // entities not in the seed graph. Skip these for integrity checks.
      if (edge.relationship === 'recused_from') continue;
      if (edge.source.startsWith('issue-') || edge.target.startsWith('issue-')) continue;
      assert.ok(nodeIds.has(edge.source), `Edge source "${edge.source}" not found in nodes.`);
      assert.ok(nodeIds.has(edge.target), `Edge target "${edge.target}" not found in nodes.`);
    }
  });

  it('throws on invalid graph file', () => {
    assert.throws(() => loadGraph('/nonexistent/path.json'));
  });

  // =========================================================================
  // CoI BFS
  // =========================================================================

  it('CoI BFS: finds path from submitter-acme to committee-member-3 via acme-ai-labs', () => {
    const graph = loadGraph(GRAPH_PATH);
    const paths = findCoIPaths(graph, 'submitter-acme', 4);
    assert.ok(paths.length > 0, 'Expected at least one CoI path.');

    // The expected path: submitter-acme -> acme-ai-labs -> committee-member-3
    const expectedPath = ['submitter-acme', 'acme-ai-labs', 'committee-member-3'];
    const found = paths.some(p =>
      p.length === expectedPath.length &&
      p.every((node, i) => node === expectedPath[i])
    );
    assert.ok(found, `Expected path ${expectedPath.join(' -> ')} not found. Got: ${JSON.stringify(paths)}`);
  });

  it('CoI BFS: no path found for indie submitter to committee (no shared org)', () => {
    const graph = loadGraph(GRAPH_PATH);
    const paths = findCoIPaths(graph, 'submitter-indie', 4);
    // submitter-indie has no org edges, so no CoI path to committee
    assert.equal(paths.length, 0, 'Expected no CoI paths for submitter-indie.');
  });

  it('CoI BFS: returns empty for unknown submitter', () => {
    const graph = loadGraph(GRAPH_PATH);
    const paths = findCoIPaths(graph, 'nonexistent-node', 4);
    assert.equal(paths.length, 0);
  });

  it('CoI BFS: respects maxDepth', () => {
    const graph = loadGraph(GRAPH_PATH);
    // submitter-acme -> acme-ai-labs -> committee-member-3 is depth 2
    // With maxDepth 1, we should NOT find it
    const paths = findCoIPaths(graph, 'submitter-acme', 1);
    assert.equal(paths.length, 0, 'Expected no paths within depth 1.');
  });

  // =========================================================================
  // CoI by Org
  // =========================================================================

  it('CoI by org: finds committee-member-3 for "Acme AI Labs"', () => {
    const graph = loadGraph(GRAPH_PATH);
    const results = findCoIByOrg(graph, 'Acme AI Labs');
    assert.ok(results.length > 0, 'Expected at least one committee member affiliated with Acme AI Labs.');
    assert.ok(results.some(r => r.memberId === 'committee-member-3'));
  });

  it('CoI by org: returns empty for unknown org', () => {
    const graph = loadGraph(GRAPH_PATH);
    const results = findCoIByOrg(graph, 'Nonexistent Corp');
    assert.equal(results.length, 0);
  });

  it('CoI by org: finds committee-member-5 for Open Agent Collective', () => {
    const graph = loadGraph(GRAPH_PATH);
    const results = findCoIByOrg(graph, 'Open Agent Collective');
    assert.ok(results.some(r => r.memberId === 'committee-member-5'));
  });
});

describe('RVF Embeddings', () => {

  it('loads embeddings successfully', () => {
    const data = loadEmbeddings(EMBEDDINGS_PATH);
    assert.ok(data.entries.length > 0);
    assert.equal(data.dimensions, 384);
  });

  it('findSimilar: category match returns matching entries', () => {
    const data = loadEmbeddings(EMBEDDINGS_PATH);
    const results = findSimilar(data, 'donation', 3);
    assert.ok(results.length > 0);
    // All results should be in the donation category
    const donationIds = data.entries
      .filter(e => e.metadata.category === 'donation')
      .map(e => e.id);
    assert.ok(donationIds.includes(results[0].id));
  });

  it('findSimilar: no results for unknown category', () => {
    const data = loadEmbeddings(EMBEDDINGS_PATH);
    const results = findSimilar(data, 'nonexistent-category', 3);
    assert.equal(results.length, 0);
  });

  it('findSimilar: respects limit', () => {
    const data = loadEmbeddings(EMBEDDINGS_PATH);
    const results = findSimilar(data, 'donation', 1);
    assert.equal(results.length, 1);
  });

  it('predictScoreRange: returns range for donation category', () => {
    const data = loadEmbeddings(EMBEDDINGS_PATH);
    // With enriched seed data, donation has 4 entries (scores: 21, 18, 23, 15)
    const prediction = predictScoreRange(data, 'donation');
    assert.ok(prediction.count >= 2, 'should have sufficient data');
    assert.ok(typeof prediction.min === 'number');
    assert.ok(typeof prediction.max === 'number');
    assert.ok(prediction.min <= prediction.max);
  });

  it('predictScoreRange: insufficient data for unknown category', () => {
    const data = loadEmbeddings(EMBEDDINGS_PATH);
    const prediction = predictScoreRange(data, 'nonexistent-category');
    assert.ok(prediction.message.includes('Insufficient data'));
    assert.equal(prediction.count, 0);
  });

  it('predictScoreRange: returns range when sufficient data exists', () => {
    // Create a synthetic embeddings object with multiple entries in same category
    const synthetic = {
      entries: [
        { id: 'a', metadata: { category: 'test-cat', score: 15 } },
        { id: 'b', metadata: { category: 'test-cat', score: 20 } },
        { id: 'c', metadata: { category: 'test-cat', score: 18 } },
      ],
    };
    const prediction = predictScoreRange(synthetic, 'test-cat');
    assert.equal(prediction.min, 15);
    assert.equal(prediction.max, 20);
    assert.equal(prediction.median, 18);
    assert.equal(prediction.count, 3);
    assert.ok(prediction.message.includes('3 prior submissions'));
  });
});

describe('RVF Attestation', () => {
  let tempDir;
  let tempFile;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rvf-test-'));
    tempFile = path.join(tempDir, 'attestation.jsonl');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true });
    } catch (_e) {
      // Cleanup best-effort
    }
  });

  it('append and read single attestation', () => {
    const entry = { type: 'transition', submission_id: '101', from_state: 'submitted', to_state: 'triaged', timestamp: '2026-04-17T12:00:00Z' };
    appendAttestation(tempFile, entry);
    const entries = readAttestations(tempFile);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].submission_id, '101');
  });

  it('append multiple attestations and read all', () => {
    appendAttestation(tempFile, { type: 'transition', id: 1 });
    appendAttestation(tempFile, { type: 'decision', id: 2 });
    appendAttestation(tempFile, { type: 'attestation', id: 3 });
    const entries = readAttestations(tempFile);
    assert.equal(entries.length, 3);
    assert.equal(entries[0].id, 1);
    assert.equal(entries[2].id, 3);
  });

  it('readAttestations returns empty array for nonexistent file', () => {
    const entries = readAttestations(path.join(tempDir, 'nonexistent.jsonl'));
    assert.deepEqual(entries, []);
  });
});
