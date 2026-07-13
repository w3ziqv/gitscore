import { describe, it, expect } from 'vitest';
import {
  calculateTotalStars,
  calculateTotalForks,
  extractLanguages,
  calculateScore,
  getScoreRank,
  calculateBadges,
  getTopRepos,
} from '../src/lib/score.js';
import type { GitHubUser, GitHubRepo } from '../src/types.js';

function makeUser(overrides: Partial<GitHubUser> = {}): GitHubUser {
  return {
    login: 'testuser',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.png',
    bio: 'A developer',
    company: null,
    location: null,
    blog: null,
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

describe('calculateTotalStars', () => {
  it('sums stargazers_count across repos', () => {
    const repos = [makeRepo({ stargazers_count: 10 }), makeRepo({ stargazers_count: 20 })];
    expect(calculateTotalStars(repos)).toBe(30);
  });

  it('returns 0 for empty array', () => {
    expect(calculateTotalStars([])).toBe(0);
  });
});

describe('calculateTotalForks', () => {
  it('sums forks_count across repos', () => {
    const repos = [makeRepo({ forks_count: 3 }), makeRepo({ forks_count: 7 })];
    expect(calculateTotalForks(repos)).toBe(10);
  });
});

describe('extractLanguages', () => {
  it('extracts and sorts languages by frequency', () => {
    const repos = [
      makeRepo({ language: 'TypeScript' }),
      makeRepo({ language: 'TypeScript' }),
      makeRepo({ language: 'Python' }),
      makeRepo({ language: 'Rust' }),
    ];
    const langs = extractLanguages(repos);
    expect(langs[0].language).toBe('TypeScript');
    expect(langs[0].bytes).toBe(2);
    expect(langs).toHaveLength(3);
  });

  it('ignores forked repos', () => {
    const repos = [
      makeRepo({ language: 'TypeScript', fork: false }),
      makeRepo({ language: 'Python', fork: true }),
    ];
    const langs = extractLanguages(repos);
    expect(langs).toHaveLength(1);
    expect(langs[0].language).toBe('TypeScript');
  });

  it('calculates percentages correctly', () => {
    const repos = [
      makeRepo({ language: 'TypeScript' }),
      makeRepo({ language: 'Python' }),
    ];
    const langs = extractLanguages(repos);
    expect(langs[0].percentage).toBe(50);
    expect(langs[1].percentage).toBe(50);
  });
});

describe('calculateScore', () => {
  it('calculates score within 0-1000 range', () => {
    const user = makeUser();
    const repos = [makeRepo()];
    const langs = extractLanguages(repos);
    const score = calculateScore(user, repos, langs);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(1000);
  });

  it('caps repos score at 200', () => {
    const user = makeUser({ public_repos: 100 });
    const score = calculateScore(user, [], []);
    expect(score.repos).toBe(200);
  });

  it('caps stars score at 300', () => {
    const repos = [makeRepo({ stargazers_count: 500 })];
    const score = calculateScore(makeUser(), repos, []);
    expect(score.stars).toBe(300);
  });

  it('caps followers score at 200', () => {
    const user = makeUser({ followers: 1000 });
    const score = calculateScore(user, [], []);
    expect(score.followers).toBe(200);
  });

  it('gives 0 for a brand new empty account', () => {
    const user = makeUser({
      public_repos: 0,
      followers: 0,
      created_at: new Date().toISOString(),
    });
    const score = calculateScore(user, [], []);
    expect(score.total).toBe(0);
  });
});

describe('getScoreRank', () => {
  it('returns S+ for scores >= 800', () => {
    expect(getScoreRank(800).rank).toBe('S+');
    expect(getScoreRank(950).rank).toBe('S+');
  });

  it('returns S for scores >= 650', () => {
    expect(getScoreRank(650).rank).toBe('S');
    expect(getScoreRank(799).rank).toBe('S');
  });

  it('returns A for scores >= 500', () => {
    expect(getScoreRank(500).rank).toBe('A');
  });

  it('returns F for scores < 100', () => {
    expect(getScoreRank(50).rank).toBe('F');
    expect(getScoreRank(0).rank).toBe('F');
  });
});

describe('calculateBadges', () => {
  it('earns Polyglot badge with 5+ languages', () => {
    const repos = [
      makeRepo({ language: 'TypeScript' }),
      makeRepo({ language: 'Python' }),
      makeRepo({ language: 'Rust' }),
      makeRepo({ language: 'Go' }),
      makeRepo({ language: 'Swift' }),
    ];
    const badges = calculateBadges(makeUser(), repos, calculateScore(makeUser(), repos, extractLanguages(repos)));
    const polyglot = badges.find(b => b.id === 'polyglot');
    expect(polyglot?.earned).toBe(true);
  });

  it('earns Rising Star badge with 10+ total stars', () => {
    const repos = [makeRepo({ stargazers_count: 15 })];
    const badges = calculateBadges(makeUser(), repos, calculateScore(makeUser(), repos, []));
    const risingStar = badges.find(b => b.id === 'rising-star');
    expect(risingStar?.earned).toBe(true);
  });

  it('earns Social Butterfly with 50+ followers', () => {
    const user = makeUser({ followers: 75 });
    const badges = calculateBadges(user, [], calculateScore(user, [], []));
    const social = badges.find(b => b.id === 'social-butterfly');
    expect(social?.earned).toBe(true);
  });

  it('earns Need a Push for score < 100', () => {
    const user = makeUser({ public_repos: 0, followers: 0 });
    const badges = calculateBadges(user, [], calculateScore(user, [], []));
    const needsPush = badges.find(b => b.id === 'needs-push');
    expect(needsPush?.earned).toBe(true);
  });

  it('earns Zero to Hero for score >= 500', () => {
    const user = makeUser({ public_repos: 40, followers: 50 });
    const repos = [makeRepo({ stargazers_count: 100, updated_at: new Date().toISOString() })];
    const score = calculateScore(user, repos, extractLanguages(repos));
    const badges = calculateBadges(user, repos, score);
    const zeroToHero = badges.find(b => b.id === 'zero-to-hero');
    expect(zeroToHero?.earned).toBe(true);
  });
});

describe('getTopRepos', () => {
  it('returns top N repos by stars, excluding forks', () => {
    const repos = [
      makeRepo({ name: 'a', stargazers_count: 30, fork: false }),
      makeRepo({ name: 'b', stargazers_count: 10, fork: false }),
      makeRepo({ name: 'c', stargazers_count: 50, fork: true }),
      makeRepo({ name: 'd', stargazers_count: 100, fork: false }),
    ];
    const top = getTopRepos(repos, 2);
    expect(top).toHaveLength(2);
    expect(top[0].name).toBe('d');
    expect(top[1].name).toBe('a');
  });

  it('returns empty array for empty input', () => {
    expect(getTopRepos([], 5)).toHaveLength(0);
  });
});
