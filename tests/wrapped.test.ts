import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WrappedReport } from '../src/types.js';

vi.mock('../src/wrappedCard.js', () => ({
  generateWrappedCardSvg: (report: WrappedReport): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" data-login="${report.login}"></svg>`,
}));

import { buildWrappedReport, clearWrappedMemoryCache } from '../src/lib/wrapped.js';
import worker from '../src/worker.js';

const USER = {
  login: 'octocat',
  name: 'The Octocat',
  avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
  bio: null,
  company: null,
  location: null,
  blog: null,
  followers: 100,
  following: 10,
  public_repos: 3,
  created_at: '2011-01-25T18:44:36Z',
  updated_at: '2025-01-01T00:00:00Z',
};

function repo(partial: {
  id: number;
  name: string;
  full_name: string;
  stargazers_count: number;
  fork?: boolean;
  language?: string | null;
  updated_at?: string;
  created_at?: string;
}) {
  const now = new Date().toISOString();
  return {
    id: partial.id,
    name: partial.name,
    full_name: partial.full_name,
    html_url: `https://github.com/${partial.full_name}`,
    description: null,
    language: partial.language ?? 'TypeScript',
    stargazers_count: partial.stargazers_count,
    forks_count: 0,
    updated_at: partial.updated_at ?? now,
    fork: partial.fork ?? false,
    topics: [] as string[],
    created_at: partial.created_at,
  };
}

const REPOS = [
  repo({
    id: 1,
    name: 'hello',
    full_name: 'octocat/hello',
    stargazers_count: 50,
    language: 'TypeScript',
    created_at: new Date().toISOString(),
  }),
  repo({
    id: 2,
    name: 'world',
    full_name: 'octocat/world',
    stargazers_count: 20,
    language: 'Go',
    created_at: '2015-01-01T00:00:00Z',
  }),
  repo({
    id: 3,
    name: 'forked',
    full_name: 'octocat/forked',
    stargazers_count: 999,
    fork: true,
    language: 'Rust',
    created_at: new Date().toISOString(),
  }),
  repo({
    id: 4,
    name: 'old',
    full_name: 'octocat/old',
    stargazers_count: 5,
    language: 'TypeScript',
    updated_at: '2010-01-01T00:00:00Z',
    created_at: '2010-01-01T00:00:00Z',
  }),
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function searchCount(n: unknown): Response {
  return jsonResponse({ total_count: n });
}

function installFetch(opts: {
  search?: (url: string) => Response | null;
  userOk?: boolean;
}): void {
  const search = opts.search;
  const userOk = opts.userOk !== false;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/users/octocat/repos')) {
        return jsonResponse(REPOS);
      }
      if (url.includes('/users/octocat') && !url.includes('/repos') && !url.includes('/events')) {
        if (!userOk) return jsonResponse({ message: 'Not Found' }, 404);
        return jsonResponse(USER);
      }
      if (url.includes('/search/')) {
        if (search) {
          const custom = search(url);
          if (custom) return custom;
        }
        if (url.includes('/search/commits')) return searchCount(120);
        if (url.includes('type:pr+is:merged')) return searchCount(15);
        if (url.includes('reviewed-by:')) return searchCount(40);
        if (url.includes('type:issue')) return searchCount(8);
        if (url.includes('type:pr')) return searchCount(30);
        return searchCount(0);
      }
      return jsonResponse({ message: 'unexpected' }, 500);
    }),
  );
}

beforeEach(() => {
  clearWrappedMemoryCache();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearWrappedMemoryCache();
});

describe('buildWrappedReport', () => {
  it('maps search total_count values on the happy path', async () => {
    // Given: GitHub profile + search fixtures
    installFetch({});

    // When
    const report = await buildWrappedReport('octocat', {});

    // Then
    expect(report.login).toBe('octocat');
    expect(report.name).toBe('The Octocat');
    expect(report.avatarUrl).toBe(USER.avatar_url);
    expect(report.commits).toBe(120);
    expect(report.prsOpened).toBe(30);
    expect(report.prsMerged).toBe(15);
    expect(report.reviewsGiven).toBe(40);
    expect(report.issuesOpened).toBe(8);
    expect(report.partial).toBe(false);
    expect(report.aiVerdict).toBeNull();
    expect(report.reposCreated).toBe(1);
    expect(report.starsNowTotal).toBe(75);
    expect(report.topRepos).toEqual([
      { name: 'octocat/hello', stars: 50 },
      { name: 'octocat/world', stars: 20 },
      { name: 'octocat/old', stars: 5 },
    ]);
    expect(report.topLanguages).toEqual(['Go', 'TypeScript']);
    expect(typeof report.score).toBe('number');
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.rank).toMatch(/^(S\+|S|A|B|C|D|F)$/);
    expect(report.windowStartIso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.generatedAtMs).toBeGreaterThan(0);
  });

  it('sets counter to 0 and partial true when one search fails', async () => {
    // Given: commits search returns 403
    installFetch({
      search: (url) => {
        if (url.includes('/search/commits')) return jsonResponse({ message: 'rate' }, 403);
        return null;
      },
    });

    // When
    const report = await buildWrappedReport('octocat', {});

    // Then
    expect(report.commits).toBe(0);
    expect(report.prsOpened).toBe(30);
    expect(report.partial).toBe(true);
  });

  it('returns null aiVerdict when AI binding is absent', async () => {
    installFetch({});
    const report = await buildWrappedReport('octocat', {});
    expect(report.aiVerdict).toBeNull();
  });

  it('returns null aiVerdict when AI throws; report stays intact', async () => {
    installFetch({});
    const report = await buildWrappedReport('octocat', {
      AI: {
        run: async () => {
          throw new Error('AI down');
        },
      },
    });
    expect(report.aiVerdict).toBeNull();
    expect(report.commits).toBe(120);
    expect(report.partial).toBe(false);
  });

  it('returns null aiVerdict when AI returns garbage', async () => {
    installFetch({});
    const report = await buildWrappedReport('octocat', {
      AI: {
        run: async () => ({ response: undefined }) as { response?: string },
      },
    });
    expect(report.aiVerdict).toBeNull();
    expect(report.commits).toBe(120);
  });

  it('accepts AI string response and trims length', async () => {
    installFetch({});
    const long = 'x'.repeat(400);
    const report = await buildWrappedReport('octocat', {
      AI: {
        run: async () => long,
      },
    });
    expect(report.aiVerdict).toBe('x'.repeat(280));
  });

  it('clamps negative and garbage total_count values', async () => {
    installFetch({
      search: (url) => {
        if (url.includes('/search/commits')) return searchCount(-12.7);
        if (url.includes('type:pr+is:merged')) return searchCount('not-a-number');
        if (url.includes('reviewed-by:')) return searchCount(3.9);
        if (url.includes('type:issue')) return searchCount(null);
        if (url.includes('type:pr')) return searchCount(2.2);
        return null;
      },
    });

    const report = await buildWrappedReport('octocat', {});
    expect(report.commits).toBe(0);
    expect(report.prsOpened).toBe(2);
    expect(report.prsMerged).toBe(0);
    expect(report.reviewsGiven).toBe(3);
    expect(report.issuesOpened).toBe(0);
    expect(report.partial).toBe(true);
  });

  it('rejects invalid username via fetchProfile', async () => {
    installFetch({});
    await expect(buildWrappedReport('bad user!!', {})).rejects.toThrow('INVALID_USERNAME');
  });
});

describe('GET /api/wrapped/:username', () => {
  it('returns 200 JSON with report shape and content-type', async () => {
    installFetch({});
    const res = await worker.fetch(
      new Request('http://localhost/api/wrapped/octocat'),
      {} as never,
      { waitUntil: () => undefined, passThroughOnException: () => undefined } as never,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/);
    expect(res.headers.get('Cache-Control')).toContain('max-age=1800');
    const body = (await res.json()) as { report: WrappedReport };
    expect(body.report.login).toBe('octocat');
    expect(body.report.commits).toBe(120);
  });

  it('returns 400 for invalid username', async () => {
    installFetch({});
    const res = await worker.fetch(
      new Request('http://localhost/api/wrapped/bad%20user'),
      {} as never,
      { waitUntil: () => undefined, passThroughOnException: () => undefined } as never,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });
});

describe('GET /api/wrapped-card/:username', () => {
  it('returns image/svg+xml', async () => {
    installFetch({});
    const res = await worker.fetch(
      new Request('http://localhost/api/wrapped-card/octocat'),
      {} as never,
      { waitUntil: () => undefined, passThroughOnException: () => undefined } as never,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/image\/svg\+xml/);
    expect(res.headers.get('Cache-Control')).toContain('max-age=1800');
    const text = await res.text();
    expect(text).toContain('<svg');
    expect(text).toContain('octocat');
  });
});
