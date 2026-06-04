#!/usr/bin/env node
// Builds docs/data/dashboard.json from the committee config, the approved-projects
// registry, and the submission issues. Run by .github/workflows/pages.yml.
//
// Scores are intentionally NOT included: the score-confidentiality model is an open
// committee decision (issue #27). Add scores here only once that decision lands.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const REPO = process.env.GITHUB_REPOSITORY || 'agenticsorg/community-projects';
const TOKEN = process.env.GITHUB_TOKEN;
const API = 'https://api.github.com';

async function gh(path) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

const names = (labels) => labels.map((l) => (typeof l === 'string' ? l : l.name));
const labelValue = (labels, prefix) => {
  const hit = names(labels).find((n) => n.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
};

function shortDescription(body, max = 220) {
  if (!body) return '';
  const text = body
    .replace(/\r/g, '')
    .replace(/^#+ .*$/gm, '')   // drop markdown headings / template section titles
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

async function allIssues() {
  const out = [];
  for (let page = 1; ; page += 1) {
    const batch = await gh(`/repos/${REPO}/issues?state=all&per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

const config = JSON.parse(await readFile('data/committee-config.json', 'utf8'));
const approved = JSON.parse(await readFile('data/approved-projects.json', 'utf8'));

const issues = await allIssues();
const submissions = issues
  .filter((i) => !i.pull_request) // the issues endpoint also returns PRs
  .filter((i) => names(i.labels).some((n) => n.startsWith('status:') || n.startsWith('category:')))
  .map((i) => ({
    number: i.number,
    name: i.title.replace(/^\[Project Submission\]\s*/i, '').trim(),
    description: shortDescription(i.body),
    category: labelValue(i.labels, 'category:'),
    status: labelValue(i.labels, 'status:') || (i.state === 'closed' ? 'closed' : 'open'),
    submitter: i.user?.login ?? null,
    created_at: i.created_at,
    url: i.html_url,
  }))
  .sort((a, b) => b.created_at.localeCompare(a.created_at));

const byStatus = {};
for (const s of submissions) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;

const dashboard = {
  generated_at: new Date().toISOString(),
  repo: REPO,
  note: 'Scores are intentionally omitted pending the committee decision on the score-confidentiality model (issue #27).',
  committee: {
    name: config.committee_name,
    quorum_rule: config.quorum_rule,
    members: config.members,
  },
  submissions,
  approved,
  stats: {
    committee_size: config.members.length,
    submissions_total: submissions.length,
    by_status: byStatus,
    approved_total: approved.length,
  },
};

await mkdir('docs/data', { recursive: true });
await writeFile('docs/data/dashboard.json', `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(
  `dashboard.json: ${config.members.length} members, ${submissions.length} submissions, ${approved.length} approved.`,
);
