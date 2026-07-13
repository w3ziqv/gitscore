import { describe, it, expect } from 'vitest';
import { generateRoast } from '../src/lib/roast.js';
import type { GitHubUser, GitHubRepo, ScoreBreakdown } from '../src/types.js';

function makeUser(overrides: Partial<GitHubUser> = {}): GitHubUser {
  return {
    login: 'testuser',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.png',
    bio: 'A developer',
    company: 'ACME',
    location: 'Earth',
    blog: 'https://example.com',
    followers: 10,
    following: 5,
    public_repos: 5,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: 1,
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    html_url: 'https://github.com/testuser/test-repo',
    description: 'A test repo',
    language: 'TypeScript',
    stargazers_count: 5,
    forks_count: 1,
    updated_at: '2024-01-01T00:00:00Z',
    fork: false,
    topics: [],
    ...overrides,
  };
}

function makeScore(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    repos: 25,
    stars: 15,
    followers: 40,
    activity: 30,
    diversity: 20,
    total: 130,
    ...overrides,
  };
}

describe('generateRoast', () => {
  it('roasts zero repos', () => {
    const user = makeUser({ public_repos: 0 });
    const result = generateRoast(user, [], makeScore({ total: 0 }));
    expect(result.lines.some(l => l.includes('gave up'))).toBe(true);
  });

  it('roasts all-fork repos', () => {
    const repos = [makeRepo({ fork: true })];
    const user = makeUser({ public_repos: 1 });
    const result = generateRoast(user, repos, makeScore());
    expect(result.lines.some(l => l.includes('librarian'))).toBe(true);
  });

  it('roasts zero stars with repos', () => {
    const repos = [makeRepo({ stargazers_count: 0 })];
    const user = makeUser({ public_repos: 1 });
    const result = generateRoast(user, repos, makeScore({ stars: 0 }));
    expect(result.lines.some(l => l.includes("can't star"))).toBe(true);
  });

  it('roasts zero followers', () => {
    const user = makeUser({ followers: 0 });
    const result = generateRoast(user, [makeRepo()], makeScore({ followers: 0 }));
    expect(result.lines.some(l => l.includes('void'))).toBe(true);
  });

  it('roasts no bio', () => {
    const user = makeUser({ bio: null });
    const result = generateRoast(user, [makeRepo()], makeScore());
    expect(result.lines.some(l => l.includes('undefined'))).toBe(true);
  });

  it('gives overall verdict for low scores', () => {
    const result = generateRoast(makeUser(), [makeRepo()], makeScore({ total: 50 }));
    expect(result.overall).toContain('beginner');
  });

  it('gives overall verdict for high scores', () => {
    const result = generateRoast(makeUser(), [makeRepo()], makeScore({ total: 850 }));
    expect(result.overall).toContain('legend');
  });

  it('always returns at least one line', () => {
    const user = makeUser({ public_repos: 5, followers: 10, bio: 'dev' });
    const repos = [makeRepo({ stargazers_count: 5, updated_at: new Date().toISOString() })];
    const score = makeScore({ total: 300 });
    const result = generateRoast(user, repos, score);
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it('has a suspiciously balanced fallback', () => {
    const user = makeUser({
      public_repos: 10,
      followers: 15,
      bio: 'dev',
      company: 'ACME',
      blog: 'https://example.com',
      created_at: '2020-01-01T00:00:00Z',
    });
    const repos = [makeRepo({ stargazers_count: 5, fork: false })];
    const score = makeScore({ total: 250 });
    const result = generateRoast(user, repos, score);
    expect(result.lines.some(l => l.includes('fine'))).toBe(true);
  });
});
