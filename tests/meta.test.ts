import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/worker.js';
import type { GitHubRepo, GitHubUser } from '../src/types.js';

const SHELL = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>GitScore — GitHub Profile Analyzer</title>
<meta property="og:title" content="GitScore — GitHub profile analyzer">
<meta property="og:description" content="Generic description.">
<meta property="og:url" content="https://gitscore.example/">
<meta name="twitter:title" content="GitScore — GitHub profile analyzer">
<meta name="twitter:description" content="Generic description.">
</head><body><div id="root"></div></body></html>`;

const USER: GitHubUser = {
  login: 'octocat',
  name: 'The <Octocat>',
  avatar_url: 'https://example.com/a.png',
  bio: null,
  company: null,
  location: null,
  blog: null,
  followers: 100,
  following: 10,
  public_repos: 2,
  created_at: '2011-01-25T18:44:36Z',
  updated_at: '2025-01-01T00:00:00Z',
};

let repoId = 1;
function repo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: repoId++,
    name: `repo-${repoId}`,
    full_name: `octocat/repo-${repoId}`,
    html_url: `https://github.com/octocat/repo-${repoId}`,
    description: 'x',
    language: 'TypeScript',
    stargazers_count: 10,
    forks_count: 0,
    updated_at: new Date().toISOString(),
    fork: false,
    topics: [],
    ...overrides,
  };
}

function githubFetchStub(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/repos?')) {
      return new Response(JSON.stringify([repo(), repo({ language: 'Go' })]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/users/octocat') || url.includes('/users/xss-user')) {
      const login = url.includes('xss-user') ? { ...USER, login: 'xss-user', name: '<script>x</script>' } : USER;
      return new Response(JSON.stringify(login), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
  }) as unknown as typeof fetch;
}

const CTX = { waitUntil: () => undefined, passThroughOnException: () => undefined } as never;

async function fetchPage(search: string): Promise<Response> {
  const env = {
    ASSETS: {
      fetch: async () => new Response(SHELL, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    },
  };
  return worker.fetch(new Request(`http://localhost/${search}`), env as never, CTX);
}

beforeEach(() => {
  vi.stubGlobal('fetch', githubFetchStub());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('social preview injection', () => {
  it('injects score, rank and pillar breakdown into ?u= pages', async () => {
    const res = await fetchPage('?u=octocat');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const html = await res.text();
    expect(html).toMatch(/<title>The &lt;Octocat&gt; \(@octocat\) — \d+\/1000 · Rank [A-Z+]+<\/title>/);
    expect(html).not.toContain('GitScore — GitHub Profile Analyzer</title>');
    expect(html).toContain('Impact ');
    expect(html).toContain('Consistency ');
    expect(html).toContain('/?u=octocat');
  });

  it('escapes HTML in the display name', async () => {
    const res = await fetchPage('?u=xss-user');
    const html = await res.text();
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).not.toContain('<title><script>');
  });

  it('marks wrapped links with a wrapped title', async () => {
    const res = await fetchPage('?wrapped=octocat');
    const html = await res.text();
    expect(html).toContain('&#39;s year in code — GitScore Wrapped');
  });

  it('falls back to the plain shell for invalid usernames', async () => {
    const res = await fetchPage('?u=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    const html = await res.text();
    expect(html).toContain('<title>GitScore — GitHub Profile Analyzer</title>');
    expect(html).not.toContain('__social');
  });

  it('falls back to the plain shell when the profile cannot be fetched', async () => {
    const res = await fetchPage('?u=ghost-user-404');
    const html = await res.text();
    expect(html).toContain('<title>GitScore — GitHub Profile Analyzer</title>');
  });

  it('does not inject on non-root paths', async () => {
    const res = await fetchPage('some/path?u=octocat');
    const html = await res.text();
    expect(html).toBe(SHELL);
  });
});
