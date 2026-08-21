// score.ts — Pure score calculation functions (no side-effects, fully testable).
//
// Scoring model v2 ("Meta contract"): five pillars, 0–1000 total.
//
//   Impact      (score.stars)     300  original stars, log-saturated
//   Consistency (score.activity)  250  recency tiers + monthly cadence
//   Portfolio   (score.repos)     180  non-fork repos, sqrt-saturated + craft bonus
//   Community   (score.followers) 170  followers, log-saturated + follow-ring guard
//   Range       (score.diversity) 100  effective language count (exp of Shannon H)
//
// Design rules:
//   1. Forks never count — they are not the user's work.
//   2. Every raw signal saturates (log or sqrt): whales can't dominate.
//   3. Sustained behavior beats burstable counts: cadence spans 12 months,
//      so it cannot be farmed in a weekend.
//   4. Follow-for-follow rings are dampened, not banned: ratio guard ×0.6.
//   5. Diversity uses perplexity (effective number of languages), so a dozen
//      token repos in exotic languages score less than 6 genuinely used ones.

import type { GitHubUser, GitHubRepo, LanguageStat, ScoreBreakdown, Badge, ScoreRank } from '../types.js';

export const SCORE_MAXIMA = {
  stars: 300,
  activity: 250,
  repos: 180,
  followers: 170,
  diversity: 100,
} as const;

const IMPACT_ANCHOR_STARS = 750;
const COMMUNITY_ANCHOR_FOLLOWERS = 1000;
const PORTFOLIO_BASE_CAP = 160;
const PORTFOLIO_CRAFT_MAX = 20;
const PORTFOLIO_SATURATION_REPOS = 40;
const RECENCY_CAP = 175;
const CADENCE_CAP = 75;
const RANGE_FULL_EFFECTIVE_LANGUAGES = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

const RECENCY_TIERS: Array<{ maxAgeDays: number; points: number }> = [
  { maxAgeDays: 7, points: 25 },
  { maxAgeDays: 14, points: 18 },
  { maxAgeDays: 30, points: 12 },
  { maxAgeDays: 90, points: 7 },
  { maxAgeDays: 180, points: 4 },
  { maxAgeDays: 365, points: 2 },
];

export function calculateTotalStars(repos: GitHubRepo[]): number {
  return repos.reduce((sum, r) => sum + r.stargazers_count, 0);
}

export function calculateOriginalStars(repos: GitHubRepo[]): number {
  return repos.reduce((sum, r) => (r.fork ? sum : sum + r.stargazers_count), 0);
}

export function calculateTotalForks(repos: GitHubRepo[]): number {
  return repos.reduce((sum, r) => sum + r.forks_count, 0);
}

export function extractLanguages(repos: GitHubRepo[]): LanguageStat[] {
  const langMap = new Map<string, number>();

  for (const repo of repos) {
    if (repo.language && !repo.fork) {
      langMap.set(repo.language, (langMap.get(repo.language) || 0) + 1);
    }
  }

  const total = Array.from(langMap.values()).reduce((a, b) => a + b, 0) || 1;
  const result: LanguageStat[] = [];

  for (const [language, count] of langMap) {
    result.push({
      language,
      bytes: count,
      percentage: Math.round((count / total) * 1000) / 10,
    });
  }

  return result.sort((a, b) => b.bytes - a.bytes);
}

function impactScore(repos: GitHubRepo[]): number {
  const originalStars = calculateOriginalStars(repos);
  if (originalStars <= 0) return 0;
  const raw = SCORE_MAXIMA.stars * Math.log1p(originalStars) / Math.log1p(IMPACT_ANCHOR_STARS);
  return Math.min(SCORE_MAXIMA.stars, Math.round(raw));
}

function recencyScore(repos: GitHubRepo[], nowMs: number): number {
  let sum = 0;
  for (const repo of repos) {
    if (repo.fork) continue;
    const ageDays = (nowMs - new Date(repo.updated_at).getTime()) / DAY_MS;
    for (const tier of RECENCY_TIERS) {
      if (ageDays <= tier.maxAgeDays) {
        sum += tier.points;
        break;
      }
    }
  }
  return Math.min(RECENCY_CAP, sum);
}

function cadenceScore(repos: GitHubRepo[], nowMs: number): number {
  const activeMonths = new Set<string>();
  for (const repo of repos) {
    if (repo.fork) continue;
    const updatedMs = new Date(repo.updated_at).getTime();
    const ageDays = (nowMs - updatedMs) / DAY_MS;
    if (ageDays > 365) continue;
    const d = new Date(updatedMs);
    activeMonths.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
  }
  return Math.min(CADENCE_CAP, Math.round(activeMonths.size * (CADENCE_CAP / 12)));
}

function consistencyScore(repos: GitHubRepo[], nowMs: number): number {
  return recencyScore(repos, nowMs) + cadenceScore(repos, nowMs);
}

function portfolioScore(repos: GitHubRepo[]): number {
  const original = repos.filter(r => !r.fork);
  const n = original.length;
  if (n === 0) return 0;
  const base = Math.min(
    PORTFOLIO_BASE_CAP,
    Math.round(PORTFOLIO_BASE_CAP * Math.sqrt(n) / Math.sqrt(PORTFOLIO_SATURATION_REPOS)),
  );
  const described = original.filter(r => r.description !== null && r.description !== '').length;
  const craft = Math.round(PORTFOLIO_CRAFT_MAX * described / n);
  return base + craft;
}

function communityScore(user: GitHubUser): number {
  let raw = SCORE_MAXIMA.followers * Math.log1p(user.followers) / Math.log1p(COMMUNITY_ANCHOR_FOLLOWERS);
  // Follow-ring pattern: mass-following far beyond own audience. Dampen, don't erase.
  if (user.followers > 0 && user.following > 200 && user.following > 5 * user.followers) {
    raw *= 0.6;
  }
  return Math.min(SCORE_MAXIMA.followers, Math.round(raw));
}

function rangeScore(languages: LanguageStat[]): number {
  if (languages.length === 0) return 0;
  const totalWeight = languages.reduce((sum, l) => sum + l.bytes, 0) || 1;
  let entropy = 0;
  for (const l of languages) {
    const p = l.bytes / totalWeight;
    if (p > 0) entropy -= p * Math.log(p);
  }
  const effectiveLanguages = Math.exp(entropy);
  return Math.round(
    SCORE_MAXIMA.diversity * Math.min(1, effectiveLanguages / RANGE_FULL_EFFECTIVE_LANGUAGES),
  );
}

export function calculateScore(user: GitHubUser, repos: GitHubRepo[], languages: LanguageStat[]): ScoreBreakdown {
  const nowMs = Date.now();

  const reposScore = portfolioScore(repos);
  const starsScore = impactScore(repos);
  const followersScore = communityScore(user);
  const activityScore = consistencyScore(repos, nowMs);
  const diversityScore = rangeScore(languages);

  const total = reposScore + starsScore + followersScore + activityScore + diversityScore;

  return {
    repos: reposScore,
    stars: starsScore,
    followers: followersScore,
    activity: activityScore,
    diversity: diversityScore,
    total,
  };
}

export function getScoreRank(total: number): { rank: ScoreRank; color: string } {
  if (total >= 800) return { rank: 'S+', color: '#f85149' };
  if (total >= 650) return { rank: 'S', color: '#f0883e' };
  if (total >= 500) return { rank: 'A', color: '#ffa657' };
  if (total >= 350) return { rank: 'B', color: '#d29922' };
  if (total >= 200) return { rank: 'C', color: '#a5d6ff' };
  if (total >= 100) return { rank: 'D', color: '#7d8590' };
  return { rank: 'F', color: '#484f58' };
}

export function calculateBadges(user: GitHubUser, repos: GitHubRepo[], score: ScoreBreakdown): Badge[] {
  const totalStars = calculateTotalStars(repos);
  const languages = extractLanguages(repos);
  const accountAgeDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const hasRecentActivity = repos.some(r => {
    const updated = new Date(r.updated_at);
    return updated > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  });

  const badges: Badge[] = [
    {
      id: 'newcomer',
      name: 'Newcomer',
      glyph: '○',
      description: 'Account created within the last year',
      earned: accountAgeDays < 365,
    },
    {
      id: 'veteran',
      name: 'Veteran',
      glyph: '◇',
      description: 'Account older than 3 years',
      earned: accountAgeDays > 365 * 3,
    },
    {
      id: 'polyglot',
      name: 'Polyglot',
      glyph: '◈',
      description: '5 or more distinct languages',
      earned: languages.length >= 5,
    },
    {
      id: 'rising-star',
      name: 'Rising Star',
      glyph: '☆',
      description: '10 or more total stars',
      earned: totalStars >= 10,
    },
    {
      id: 'social-butterfly',
      name: 'Social Butterfly',
      glyph: '◐',
      description: '50 or more followers',
      earned: user.followers >= 50,
    },
    {
      id: 'consistent',
      name: 'Consistent',
      glyph: '▸',
      description: 'Pushed code in the last 7 days',
      earned: hasRecentActivity,
    },
    {
      id: 'open-sourcerer',
      name: 'Open Sourcerer',
      glyph: '◉',
      description: '20 or more public repos',
      earned: user.public_repos >= 20,
    },
    {
      id: 'zero-to-hero',
      name: 'Zero to Hero',
      glyph: '◆',
      description: 'Score above 500',
      earned: score.total >= 500,
    },
    {
      id: 'needs-push',
      name: 'Need a Push',
      glyph: '×',
      description: 'Score below 100',
      earned: score.total < 100,
    },
  ];

  return badges;
}

export function getTopRepos(repos: GitHubRepo[], limit: number = 5): GitHubRepo[] {
  return [...repos]
    .filter(r => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, limit);
}
