// action/index.js — GitScore PR Comment action (proof).
//
// Reads /api/profile and /api/roast for the PR author, posts a short Hard
// Mistral-flavored Markdown comment on the PR. This is the source file — to
// run inside a real GitHub Action it must be bundled with its deps via
// `npm install && npx @vercel/ncc build index.js -o dist` (not done here —
// the repo skeleton keeps the action unmaintainable-but-real).
//
// Inputs (see action.yml):
//   - github-token (required)
//   - api-origin   (default: https://gitscore-mu.vercel.app)
//   - post-on-first-pr-only ("true" by default)
//
// Env:
//   GITHUB_REPOSITORY, GITHUB_EVENT_PATH, GITHUB_TOKEN

const { getInput, exportVariable, setFailed } = require('@actions/core');
const { context, getOctokit } = require('@actions/github');
const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

const FALLBACK_COMMENT = (login) =>
  `### GitScore

> Profile "${login}" could not be analyzed yet. Visit https://gitscore-mu.vercel.app/?u=${login} to seed it.`;

function rankColor(rank) {
  const map = { 'S+': '!', S: '!', A: '', B: '', C: '※', D: '※', F: '※' };
  return map[rank] || '';
}

function buildComment(profile, roast) {
  const login = profile.user && profile.user.login ? profile.user.login : 'unknown';
  const name = profile.user && profile.user.name ? profile.user.name : login;
  const score = profile.score ? profile.score.total : 0;
  const rank = profile.score && profile.score.rank ? profile.score.rank : 'F';
  const repos = profile.user && profile.user.public_repos ? profile.user.public_repos : 0;
  const stars = profile.totalStars || 0;
  const langs = profile.languages ? profile.languages.length : 0;
  const roastFirst = roast && roast.lines && roast.lines[0];
  const roastOverall = roast && roast.overall;

  return `### # GitScore — \`@${login}\`

| Rank | Score | Repos | Stars | Languages |
| --- | --- | --- | --- | --- |
| **${rank}** ${rankColor(rank)} | **${score}/1000** | ${repos} | ${stars}★ | ${langs} |

> ${roastFirst ? roastFirst : ''}
> ${roastOverall ? `_${roastOverall}_` : ''}

Embeddable badge:
\`\`\`md
![GitScore](https://gitscore-mu.vercel.app/api/badge/${login})
\`\`\`
`;
}

async function isFirstPR(octokit, owner, login) {
  const resp = await octokit.rest.search.issuesAndPullRequests({
    q: `is:pr is:merged author:${login} repo:${owner}`,
    per_page: 1,
  });
  return resp.data.total_count <= 1;
}

async function main() {
  const token = process.env.GITHUB_TOKEN || getInput('github-token');
  const apiOrigin = (getInput('api-origin') || 'https://gitscore-mu.vercel.app').replace(/\/$/, '');
  const firstOnly = /^(true|1)$/i.test(getInput('post-on-first-pr-only') || 'true');

  if (!token) { setFailed('github-token is required'); return; }

  const ctx = context;
  if (!ctx.payload.pull_request) {
    console.log('No PR in event payload; skipping');
    return;
  }
  const owner = ctx.payload.repository?.owner?.login;
  const repo = ctx.payload.repository?.name;
  const pull_number = ctx.payload.pull_request.number;
  const login = ctx.payload.pull_request.user.login;

  if (!owner || !repo || !pull_number || !login) {
    setFailed('Missing owner/repo/pull_number/login in event payload');
    return;
  }

  const octokit = getOctokit(token);

  if (firstOnly) {
    try {
      const firstPR = await isFirstPR(octokit, `${owner}/${repo}`, login);
      if (!firstPR) {
        console.log(`@${login} already has merged PRs; skipping`);
        return;
      }
    } catch (e) {
      // Search may 401 without scope; default to posting anyway.
      console.warn(`isFirstPR check failed: ${e.message}`);
    }
  }

  let profile;
  try {
    const r = await fetch(`${apiOrigin}/api/profile/${encodeURIComponent(login)}`);
    if (!r.ok) throw new Error(`profile HTTP ${r.status}`);
    profile = await r.json();
  } catch (e) {
    await octokit.rest.issues.createComment({
      owner, repo, issue_number: pull_number,
      body: FALLBACK_COMMENT(login),
    });
    console.warn(`profile fetch failed: ${e.message}`);
    return;
  }

  let roast;
  try {
    const r = await fetch(`${apiOrigin}/api/roast/${encodeURIComponent(login)}?lang=en`);
    if (r.ok) roast = await r.json();
  } catch {
    /* roast optional */
  }

  const body = buildComment(profile, roast || { lines: [], overall: '' });
  await octokit.rest.issues.createComment({ owner, repo, issue_number: pull_number, body });
  console.log(`Posted GitScore comment on #${pull_number}`);
}

if (require.main === module) {
  main().catch(e => setFailed(e.stack || String(e)));
}

module.exports = { buildComment, isFirstPR, rankColor, main };