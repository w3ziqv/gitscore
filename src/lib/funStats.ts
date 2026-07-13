// funStats.ts — Compute interesting trivia from profile data (pure functions)

import type { GitHubUser, GitHubRepo, ScoreBreakdown } from '../types.js';
import { calculateTotalStars } from './score.js';

export interface FunStat {
  label: string;
  value: string;
  emoji: string;
}

export function calculateFunStats(user: GitHubUser, repos: GitHubRepo[], score: ScoreBreakdown): FunStat[] {
  const stats: FunStat[] = [];
  const totalStars = calculateTotalStars(repos);
  const nonForkedRepos = repos.filter(r => !r.fork);
  const accountAgeDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const accountAgeYears = (accountAgeDays / 365.25).toFixed(1);

  stats.push({
    label: 'Account age',
    value: `${accountAgeYears} years`,
    emoji: '🎂',
  });

  const reposPerYear = accountAgeDays > 0 ? (user.public_repos / (accountAgeDays / 365.25)).toFixed(1) : '0';
  stats.push({
    label: 'Repos per year',
    value: reposPerYear,
    emoji: '📦',
  });

  const starsPerRepo = nonForkedRepos.length > 0 ? (totalStars / nonForkedRepos.length).toFixed(1) : '0';
  stats.push({
    label: 'Avg stars per repo',
    value: starsPerRepo,
    emoji: '⭐',
  });

  const followerToFollowingRatio = user.following > 0 ? (user.followers / user.following).toFixed(1) : '∞';
  stats.push({
    label: 'Follower ratio',
    value: `${followerToFollowingRatio}x`,
    emoji: '👥',
  });

  const languages = new Set(repos.filter(r => !r.fork && r.language).map(r => r.language));
  stats.push({
    label: 'Languages spoken',
    value: String(languages.size),
    emoji: '🌐',
  });

  const mostStarredRepo = nonForkedRepos.sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
  if (mostStarredRepo && mostStarredRepo.stargazers_count > 0) {
    stats.push({
      label: 'Most popular repo',
      value: mostStarredRepo.name,
      emoji: '🏆',
    });
  }

  const oldestRepo = repos.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())[0];
  if (oldestRepo) {
    const daysSinceUpdate = Math.floor((Date.now() - new Date(oldestRepo.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    stats.push({
      label: 'Dustiest repo',
      value: oldestRepo.name,
      emoji: '🕸️',
    });
    stats.push({
      label: 'Days since last push',
      value: String(daysSinceUpdate),
      emoji: '⏰',
    });
  }

  if (totalStars > 0 && user.followers > 0) {
    const starPowerRatio = (totalStars / user.followers).toFixed(1);
    stats.push({
      label: 'Star-to-fan ratio',
      value: `${starPowerRatio}x`,
      emoji: '✨',
    });
  }

  stats.push({
    label: 'GitHub net worth',
    value: `${score.total} pts`,
    emoji: '💎',
  });

  return stats;
}
