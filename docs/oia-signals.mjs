// OIA signal maps and corpus construction — the SINGLE source of truth.
//
// Both consumers import this module. There is no twin to keep in sync:
//   - server:  scripts/classify-oia.mjs   (intake auto-classification)
//   - client:  docs/oia-matrix.html       (the page's "Rescan" button)
// It lives under docs/ so GitHub Pages serves it to the browser, and Node
// imports it by relative path. Closes the hand-duplicated `// KEEP IN SYNC`
// maps that previously let the two results split silently.
//
// Honest by construction: this is a STRUCTURAL signal pass over file paths and
// prose, not a comprehension read of the code. Everything it produces carries
// evidence tier `auto`, never `code ✓`.

// ---------------------------------------------------------------------------
// Layer signals — index is the OIA layer number (L0..L9).
// ---------------------------------------------------------------------------
export const LSIG = [
 [/\bgpu\b/,/cuda/,/\btpu\b/,/neuromorphic/,/photonic/,/semiconductor/,/cooling/,/\benergy\b/],
 [/\.wasm/,/\.wat\b/,/\bwasi\b/,/onnx/,/\bmlir\b/,/triton/,/\brocm\b/],
 [/serverless/,/\bedge\b/,/kubernetes/,/\bk8s\b/,/terraform/,/dockerfile/,/wrangler/,/cloudflare/,/\blambda\b/,/self-host/,/sovereign/],
 [/\bvector/,/embedding/,/\bhnsw\b/,/\bivf\b/,/sqlite/,/postgres/,/neo4j/,/\.sql\b/,/lineage/,/chroma/,/pinecone/,/qdrant/,/\bann\b/],
 [/\btrain/,/fine-?tune/,/\blora\b/,/\brlhf\b/,/\bdpo\b/,/rlaif/,/\bevals?\b/,/checkpoint/,/dataset/],
 [/inference/,/\bserve/,/rout(er|ing)/,/retriev/,/rerank/,/\bvllm\b/],
 [/\brag\b/,/retrieval-augment/,/\bknowledge/,/langchain/,/llamaindex/,/haystack/,/knowledge-?graph/,/\bcontext\b/,/skills?\//],
 [/\bmcp\b/,/\.mcp/,/\bagents?\b/,/workflow/,/orchestrat/,/langgraph/,/crewai/,/autogen/,/\bswarm\b/,/tool-?call/],
 [/\bmemory\b/,/witness/,/provenance/,/continuity/,/attestation/,/\.lean\b/,/lakefile/,/audit-?trail/],
 [/index\.html/,/\.tsx\b/,/\.jsx\b/,/\bvite\b/,/\breact\b/,/\bnext\b/,/frontend/,/\bui\//,/\bpublic\//],
];

// ---------------------------------------------------------------------------
// Span signals — the six OIA cross-cutting concerns.
// ---------------------------------------------------------------------------
export const SSIG = {
 security:     [/security/,/\bcvss\b/,/threat/,/vuln/,/owasp/,/firewall/,/sandbox/],
 sovereignty:  [/local-first/,/self-host/,/\bedge\b/,/serverless/,/sovereign/,/offline/],
 auditability: [/\baudit/,/adrs?\//,/\badr-/,/constitution/,/governance/,/\btrace/],
 provenance:   [/provenance/,/witness/,/\bsign(ed|ing)\b/,/attest/,/\bcit(e|ations?)\b/,/lineage/],
 identity:     [/\bidentity\b/,/oauth/,/\bauth\b/,/\blogin\b/,/\bsso\b/],
 energy:       [/\benergy\b/,/carbon/,/entrainment/,/\bpower\b/],
};

export const BADGE = {security:"sec",sovereignty:"sov",auditability:"aud",provenance:"prov",identity:"idn",energy:"ene"};

export const LAYER_NAMES = ["Physical Compute","Silicon Abstraction","Sovereign Infrastructure","Agent Data Substrate","Model Training & Adaptation","Inference & Retrieval","Context & Knowledge","Orchestration & Workflow","Continuity Fabric","Human & Browser Interface"];

// ---------------------------------------------------------------------------
// Boilerplate exclusion.
//
// Repository scaffolding that exists on most repos regardless of what the
// project does. Leaving it in the corpus made two signals near-universal:
// `.github/workflows/` matched /workflow/ and put almost every repo on
// L7 Orchestration; `.github/SECURITY.md` matched /security/ and gave almost
// every repo a security span. Neither is evidence about the project.
// ---------------------------------------------------------------------------
export const BOILERPLATE = [
 /^\.github\//,
 /^\.git(attributes|ignore|modules)$/,
 /^node_modules\//,
 /^(vendor|third_?party|dist|build|out|coverage)\//,
 /^\.(vscode|idea|devcontainer|husky)\//,
 /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|cargo\.lock|poetry\.lock|go\.sum|gemfile\.lock|composer\.lock)$/,
 /^licen[cs]e(\.[a-z]+)?$/,
 /^(security|code_of_conduct|contributing|changelog|codeowners|authors|notice|funding)(\.[a-z]+)?$/,
];

/** Drop scaffolding paths. Input and output are lowercased path strings. */
export function denoisePaths(paths){
 return (paths||[]).filter(p => !BOILERPLATE.some(rx => rx.test(p)));
}

/**
 * Build the two corpora a classification reads.
 *   tree — de-noised file paths (structure the project actually chose)
 *   doc  — README + topics + language (what the project says about itself)
 * They are scored separately so a layer cannot become a "centre of gravity"
 * on file paths alone.
 *
 * Note: the repo `description` is deliberately NOT in the corpus. It is carried
 * on the matrix row for display only. Adding it would be a scope change that
 * promotes rows rather than de-noising them; propose it separately if wanted.
 */
/** Upper bound on file paths read into the tree corpus. */
export const SCAN_CAP = 6000;

export function buildCorpus({paths=[], readme='', topics=[], language=''} = {}){
 const lower    = paths.map(p => String(p).toLowerCase());
 const denoised = denoisePaths(lower);
 const kept     = denoised.slice(0, SCAN_CAP);
 const tree     = kept.join(' ');
 const doc   = [
   String(readme||'').toLowerCase().slice(0, 40000),
   (topics||[]).join(' ').toLowerCase(),
   String(language||'').toLowerCase(),
 ].join(' ');
 // `dropped` and `truncated` are deliberately separate (#64). They used to be
 // summed into one counter computed against the pre-cap length, which the
 // narrative then reported wholly as scaffolding. On a repo larger than
 // SCAN_CAP that published a scaffolding count off by two orders of magnitude
 // and hid the fact that most of the tree was never read at all.
 // kept + dropped + truncated partitions the input.
 return {
   tree, doc, all: tree + ' ' + doc,
   kept:      kept.length,
   dropped:   lower.length - denoised.length,
   truncated: denoised.length - kept.length,
 };
}

/** How many regexes in a group match the corpus (presence per regex, not total hits). */
export const cnt = (rx, c) => rx.reduce((n, r) => n + (r.test(c) ? 1 : 0), 0);

/**
 * Score a repo into the OIA layer vector + spans.
 *
 * Layer value:
 *   2 = centre of gravity — 3+ distinct signals overall AND at least one of
 *       them present in the project's own prose (README/topics/description).
 *       The doc-side requirement is what stops a pile of file paths from
 *       asserting a centre of gravity nobody claimed.
 *   1 = presence — at least one signal anywhere.
 *   0 = none.
 */
export function classifySignals(input){
 const c = input && input.all !== undefined ? input : buildCorpus(input);
 const layers = LSIG.map(group => {
  const all = cnt(group, c.all);
  const doc = cnt(group, c.doc);
  return (all >= 3 && doc >= 1) ? 2 : (all >= 1 ? 1 : 0);
 });
 const spans = Object.keys(SSIG)
   .filter(k => cnt(SSIG[k], c.all) >= 1)
   .map(k => ({label: k, badge: BADGE[k]}));
 return {layers, spans, corpus: c};
}
