// score.ts — Pure score calculation functions (no side-effects, fully testable)

import type { GitHubUser, GitHubRepo, LanguageStat, ScoreBreakdown, Badge, ScoreRank } from '../types.js';

export function calculateTotalStars(repos: GitHubRepo[]): number {
  return repos.reduce((sum, r) => sum + r.stargazers_count, 0);
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

export function calculateScore(user: GitHubUser, repos: GitHubRepo[], languages: LanguageStat[]): ScoreBreakdown {
  const totalStars = calculateTotalStars(repos);

  // Repo count saturates with sqrt: 40 repos = cap, empty repos don't scale linearly.
  const reposScore = Math.min(Math.round(31.62 * Math.sqrt(user.public_repos)), 200);

  // Stars saturate logarithmically: 10 -> 115, 100 -> 222, ~500 = cap.
  // 100k stars vs 10k must not be a 10x score difference.
  const starsScore = Math.min(Math.round(48 * Math.log(1 + totalStars)), 300);

  // Followers saturate logarithmically: 10 -> 69, 100 -> 134, ~1000 = cap.
  const followersScore = Math.min(Math.round(29 * Math.log(1 + user.followers)), 200);

  // Freshness tiers: a repo touched this week counts 4x one last touched 3 months ago.
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  let activityScore = 0;
  for (const repo of repos) {
    const ageDays = (now - new Date(repo.updated_at).getTime()) / DAY;
    if (ageDays <= 7) activityScore += 20;
    else if (ageDays <= 30) activityScore += 10;
    else if (ageDays <= 90) activityScore += 5;
  }
  activityScore = Math.min(activityScore, 150);

  const diversityScore = Math.min(languages.length * 20, 150);

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
