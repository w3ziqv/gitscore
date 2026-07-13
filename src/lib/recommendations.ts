import type { GitHubUser, GitHubRepo, ScoreBreakdown, Recommendation } from '../types.js';
import { calculateTotalStars } from './score.js';

interface ScoreMaxima {
  repos: number;
  stars: number;
  followers: number;
  activity: number;
  diversity: number;
}

const MAX_POINTS: ScoreMaxima = { repos: 200, stars: 300, followers: 200, activity: 150, diversity: 150 };

export function generateRecommendations(
  user: GitHubUser,
  repos: GitHubRepo[],
  score: ScoreBreakdown,
  limit: number = 3,
): Recommendation[] {
  const totalStars = calculateTotalStars(repos);
  const headroom: Array<{ key: keyof ScoreMaxima; current: number; max: number; build: Recommendation }> = [
    {
      key: 'stars',
      current: score.stars,
      max: MAX_POINTS.stars,
      build: {
        emoji: '⭐',
        title: totalStars === 0 ? 'Earn your first star' : `Reach ${nextStarMilestone(totalStars)} stars`,
        detail: totalStars === 0
          ? 'Push a polished project and share it. One person starring your repo unlocks Rising Star (+30 pts).'
          : `Stars are worth 3 pts each. ${MAX_POINTS.stars - score.stars} pts still on the table.`,
        impactPoints: MAX_POINTS.stars - score.stars,
      },
    },
    {
      key: 'followers',
      current: score.followers,
      max: MAX_POINTS.followers,
      build: {
        emoji: '🦋',
        title: user.followers === 0 ? 'Get your first follower' : `Reach ${nextFollowerMilestone(user.followers)} followers`,
        detail: user.followers === 0
          ? 'Follow developers in your niche, comment on their issues, share your work. First follower = Social Butterfly (+50 pts).'
          : `Each follower is worth 4 pts. ${MAX_POINTS.followers - score.followers} pts available.`,
        impactPoints: MAX_POINTS.followers - score.followers,
      },
    },
    {
      key: 'repos',
      current: score.repos,
      max: MAX_POINTS.repos,
      build: {
        emoji: '📦',
        title: `Publish ${Math.ceil((MAX_POINTS.repos - score.repos) / 5)} more repos`,
        detail: `Each repo is worth 5 pts up to ${MAX_POINTS.repos} pts. 20 repos unlocks Open Sourcerer.`,
        impactPoints: MAX_POINTS.repos - score.repos,
      },
    },
    {
      key: 'activity',
      current: score.activity,
      max: MAX_POINTS.activity,
      build: {
        emoji: '🔥',
        title: score.activity === 0 ? 'Push a commit this week' : 'Stay consistent',
        detail: score.activity === 0
          ? 'Push in the next 7 days to unlock the Consistent badge (+150 pts max).'
          : `Each repo updated in the last 90 days adds 15 pts. ${MAX_POINTS.activity - score.activity} pts more possible.`,
        impactPoints: MAX_POINTS.activity - score.activity,
      },
    },
    {
      key: 'diversity',
      current: score.diversity,
      max: MAX_POINTS.diversity,
      build: {
        emoji: '🌐',
        title: `Try ${Math.ceil((MAX_POINTS.diversity - score.diversity) / 20)} more language(s)`,
        detail: `Each language adds 20 pts. 5 languages unlock the Polyglot badge (+150 pts max).`,
        impactPoints: MAX_POINTS.diversity - score.diversity,
      },
    },
  ];

  return headroom
    .filter(h => h.build.impactPoints > 0)
    .sort((a, b) => b.build.impactPoints - a.build.impactPoints)
    .slice(0, limit)
    .map(h => h.build);
}

function nextStarMilestone(current: number): number {
  if (current < 10) return 10;
  if (current < 50) return 50;
  if (current < 100) return 100;
  if (current < 500) return 500;
  return Math.ceil((current + 1) / 500) * 500;
}

function nextFollowerMilestone(current: number): number {
  if (current < 10) return 10;
  if (current < 50) return 50;
  if (current < 100) return 100;
  if (current < 500) return 500;
  if (current < 1000) return 1000;
  return Math.ceil((current + 1) / 1000) * 1000;
}