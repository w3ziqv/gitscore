import { describe, it, expect } from 'vitest';
import {
  SCORE_MAXIMA,
  calculateTotalStars,
  calculateOriginalStars,
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

let repoId = 1;
function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: repoId++,
    name: `repo-${repoId}`,
    full_name: `testuser/repo-${repoId}`,
    html_url: `https://github.com/testuser/repo-${repoId}`,
    description: 'A test repo',
    language: 'TypeScript',
    stargazers_count: 0,
    forks_count: 1,
    updated_at: new Date().toISOString(),
    fork: false,
    topics: [],
    ...overrides,
  };
}

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

describe('calculateTotalStars', () => {
  it('sums stargazers_count across repos', () => {
    const repos = [makeRepo({ stargazers_count: 10 }), makeRepo({ stargazers_count: 20 })];
    expect(calculateTotalStars(repos)).toBe(30);
  });

  it('returns 0 for empty array', () => {
    expect(calculateTotalStars([])).toBe(0);
  });
});

describe('calculateOriginalStars', () => {
  it('excludes stars earned on forks', () => {
    const repos = [
      makeRepo({ stargazers_count: 100, fork: false }),
      makeRepo({ stargazers_count: 9999, fork: true }),
      makeRepo({ stargazers_count: 50, fork: false }),
    ];
    expect(calculateOriginalStars(repos)).toBe(150);
    expect(calculateTotalStars(repos)).toBe(10149);
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
});

describe('calculateScore — Impact (stars)', () => {
  it('caps at 300 with 750+ original stars', () => {
    const repos = [makeRepo({ stargazers_count: 750 })];
    expect(calculateScore(makeUser(), repos, []).stars).toBe(300);
    const more = [makeRepo({ stargazers_count: 100000 })];
    expect(calculateScore(makeUser(), more, []).stars).toBe(300);
  });

  it('ignores stars on forks entirely', () => {
    const forks = Array.from({ length: 50 }, (_, i) =>
      makeRepo({ id: i + 1, stargazers_count: 5000, fork: true }),
    );
    expect(calculateScore(makeUser(), forks, []).stars).toBe(0);
  });

  it('is logarithmic: 10x stars must not mean 10x points', () => {
    const ten = calculateScore(makeUser(), [makeRepo({ stargazers_count: 10 })], []);
    const hundred = calculateScore(makeUser(), [makeRepo({ stargazers_count: 100 })], []);
    expect(ten.stars).toBeGreaterThan(0);
    expect(hundred.stars).toBeGreaterThan(ten.stars);
    expect(hundred.stars).toBeLessThan(ten.stars * 3);
  });

  it('reaches exactly the documented anchors (10 -> 109, 100 -> 209)', () => {
    const pts = (stars: number) =>
      calculateScore(makeUser(), [makeRepo({ stargazers_count: stars })], []).stars;
    expect(pts(10)).toBe(109);
    expect(pts(100)).toBe(209);
  });
});

describe('calculateScore — Consistency (activity)', () => {
  it('follows recency tiers exactly (25/18/12/7/4/2/0) plus a single-month cadence of 6', () => {
    const tiers: Array<[number, number]> = [
      [3, 31], [10, 24], [20, 18], [60, 13], [120, 10], [200, 8], [400, 0],
    ];
    for (const [ageDays, expected] of tiers) {
      const score = calculateScore(makeUser(), [makeRepo({ updated_at: daysAgo(ageDays) })], []);
      expect(score.activity).toBe(expected);
    }
  });

  it('caps recency at 175; a same-month cluster then adds only the minimum cadence of 6', () => {
    const repos = Array.from({ length: 40 }, () => makeRepo({ updated_at: daysAgo(1) }));
    expect(calculateScore(makeUser(), repos, []).activity).toBe(181);
  });

  it('rewards sustained months over dead accounts, never exceeding 250', () => {
    // 12 repos, one per distinct past month (mid-month dates => distinct months).
    const monthStart = (backMonths: number) => {
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - backMonths, 15)).toISOString();
    };
    const regular = Array.from({ length: 12 }, (_, k) => makeRepo({ updated_at: monthStart(k) }));
    const dead = regular.map(r => ({ ...r, updated_at: daysAgo(400) }));

    const regularActivity = calculateScore(makeUser(), regular, []).activity;
    expect(regularActivity).toBeGreaterThan(0);
    expect(calculateScore(makeUser(), dead, []).activity).toBe(0);
    expect(regularActivity).toBeLessThanOrEqual(SCORE_MAXIMA.activity);
  });

  it('never counts fork activity', () => {
    const repos = [makeRepo({ updated_at: daysAgo(1), fork: true })];
    expect(calculateScore(makeUser(), repos, []).activity).toBe(0);
  });
});

describe('calculateScore — Portfolio (repos)', () => {
  it('fills the 160-pt base at 40 original repos and never exceeds it', () => {
    const forty = Array.from({ length: 40 }, () => makeRepo({ description: null }));
    const eighty = [...forty, ...Array.from({ length: 40 }, () => makeRepo({ description: null }))];
    const base = (repos: GitHubRepo[]) => calculateScore(makeUser(), repos, []).repos;
    expect(base(forty)).toBe(160);
    expect(base(eighty)).toBe(160);
  });

  it('adds up to a 20-pt craft bonus for described repos', () => {
    const plain = Array.from({ length: 10 }, () => makeRepo({ description: null }));
    const crafted = Array.from({ length: 10 }, () => makeRepo({ description: 'documented' }));
    const base = calculateScore(makeUser(), plain, []).repos;
    const withCraft = calculateScore(makeUser(), crafted, []).repos;
    expect(withCraft - base).toBe(20);
    expect(base).toBe(80);
  });

  it('ignores forks in portfolio count', () => {
    const forks = Array.from({ length: 60 }, () => makeRepo({ fork: true }));
    expect(calculateScore(makeUser(), forks, []).repos).toBe(0);
  });
});

describe('calculateScore — Community (followers)', () => {
  it('caps at 170 with 1000+ followers', () => {
    expect(calculateScore(makeUser({ followers: 1000 }), [], []).followers).toBe(170);
    expect(calculateScore(makeUser({ followers: 100000 }), [], []).followers).toBe(170);
  });

  it('dampens follow-for-follow rings by 40%', () => {
    // following=500 > 200 and > 5x50: ring pattern.
    const ring = makeUser({ followers: 50, following: 500 });
    const organic = makeUser({ followers: 50, following: 30 });
    const ringPts = calculateScore(ring, [], []).followers;
    const organicPts = calculateScore(organic, [], []).followers;
    expect(Math.round(organicPts * 0.6)).toBe(ringPts);
    expect(ringPts).toBeLessThan(organicPts);
  });

  it('does not trigger the guard for small accounts still building audience', () => {
    const newbie = makeUser({ followers: 3, following: 40 });
    expect(calculateScore(newbie, [], []).followers)
      .toBe(calculateScore(makeUser({ followers: 3, following: 1 }), [], []).followers);
  });
});

describe('calculateScore — Range (diversity)', () => {
  it('scores effective languages: 1 -> 17, 2 balanced -> 33, 6 balanced -> 100', () => {
    const langs = (names: string[]) => extractLanguages(names.map(n => makeRepo({ language: n })));
    expect(calculateScore(makeUser(), [], langs(['TypeScript'])).diversity).toBe(17);
    expect(calculateScore(makeUser(), [], langs(['TypeScript', 'Go'])).diversity).toBe(33);
    expect(
      calculateScore(makeUser(), [], langs(['TypeScript', 'Go', 'Rust', 'C', 'Python', 'Zig'])).diversity,
    ).toBe(100);
  });

  it('discounts token languages: one dominant + many single-repo langs < balanced six', () => {
    const skewed = [
      ...Array.from({ length: 30 }, () => makeRepo({ language: 'TypeScript' })),
      ...['Rust', 'Zig', 'Haskell', 'Ada'].map(l => makeRepo({ language: l })),
    ];
    const balanced = ['TypeScript', 'Go', 'Rust', 'C', 'Python', 'Zig'].map(l => makeRepo({ language: l }));
    const skewedDiversity = calculateScore(makeUser(), skewed, extractLanguages(skewed)).diversity;
    const balancedDiversity = calculateScore(makeUser(), balanced, extractLanguages(balanced)).diversity;
    expect(skewedDiversity).toBeLessThan(balancedDiversity);
  });
});

describe('calculateScore — invariants', () => {
  it('gives 0 to a brand-new empty account', () => {
    const user = makeUser({ public_repos: 0, followers: 0, created_at: new Date().toISOString() });
    expect(calculateScore(user, [], []).total).toBe(0);
  });

  it('always lands within 0-1000 and equals the sum of pillars', () => {
    const repos = [
      makeRepo({ stargazers_count: 800, language: 'Go' }),
      makeRepo({ stargazers_count: 120, language: 'Rust' }),
      makeRepo({ fork: true, stargazers_count: 9000 }),
    ];
    const user = makeUser({ followers: 320, following: 180 });
    const score = calculateScore(user, repos, extractLanguages(repos));
    const sum = score.repos + score.stars + score.followers + score.activity + score.diversity;
    expect(score.total).toBe(sum);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(1000);
  });

  it('is deterministic for identical inputs', () => {
    const repos = [makeRepo({ stargazers_count: 42 }), makeRepo({ language: 'Go' })];
    const a = calculateScore(makeUser(), repos, extractLanguages(repos));
    const b = calculateScore(makeUser(), repos, extractLanguages(repos));
    expect(a).toEqual(b);
  });

  it('is monotonically non-decreasing in every pillar input', () => {
    const less = calculateScore(makeUser({ followers: 40 }), [makeRepo({ stargazers_count: 30 })], []);
    const more = calculateScore(
      makeUser({ followers: 90 }),
      [
        makeRepo({ stargazers_count: 300 }),
        makeRepo({ language: 'Go' }),
        makeRepo({ language: 'Rust' }),
      ],
      [],
    );
    expect(more.total).toBeGreaterThanOrEqual(less.total);
  });
});

describe('getScoreRank', () => {
  it('keeps public rank thresholds unchanged', () => {
    expect(getScoreRank(800).rank).toBe('S+');
    expect(getScoreRank(950).rank).toBe('S+');
    expect(getScoreRank(650).rank).toBe('S');
    expect(getScoreRank(799).rank).toBe('S');
    expect(getScoreRank(500).rank).toBe('A');
    expect(getScoreRank(350).rank).toBe('B');
    expect(getScoreRank(200).rank).toBe('C');
    expect(getScoreRank(100).rank).toBe('D');
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
    expect(badges.find(b => b.id === 'polyglot')?.earned).toBe(true);
  });

  it('earns Rising Star badge with 10+ total stars', () => {
    const repos = [makeRepo({ stargazers_count: 15 })];
    const badges = calculateBadges(makeUser(), repos, calculateScore(makeUser(), repos, []));
    expect(badges.find(b => b.id === 'rising-star')?.earned).toBe(true);
  });

  it('earns Social Butterfly with 50+ followers', () => {
    const user = makeUser({ followers: 75 });
    const badges = calculateBadges(user, [], calculateScore(user, [], []));
    expect(badges.find(b => b.id === 'social-butterfly')?.earned).toBe(true);
  });

  it('earns Need a Push for score < 100', () => {
    const user = makeUser({ public_repos: 0, followers: 0 });
    const badges = calculateBadges(user, [], calculateScore(user, [], []));
    expect(badges.find(b => b.id === 'needs-push')?.earned).toBe(true);
  });

  it('earns Zero to Hero for an S-range profile built on real signals', () => {
    const repos = Array.from({ length: 40 }, (_, i) =>
      makeRepo({
        description: 'real project',
        language: ['TypeScript', 'Go', 'Rust', 'C', 'Python', 'Zig'][i % 6],
        stargazers_count: i === 0 ? 800 : 5,
      }),
    );
    const user = makeUser({ followers: 150, following: 40, public_repos: 40 });
    const score = calculateScore(user, repos, extractLanguages(repos));
    expect(score.total).toBeGreaterThanOrEqual(500);
    const badges = calculateBadges(user, repos, score);
    expect(badges.find(b => b.id === 'zero-to-hero')?.earned).toBe(true);
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
