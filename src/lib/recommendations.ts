import type { GitHubUser, GitHubRepo, ScoreBreakdown, Recommendation } from '../types.js';
import { SCORE_MAXIMA } from './score.js';

export function generateRecommendations(
  user: GitHubUser,
  repos: GitHubRepo[],
  score: ScoreBreakdown,
  limit: number = 3,
): Recommendation[] {
  const originalRepos = repos.filter(r => !r.fork);
  const totalStars = originalRepos.reduce((sum, r) => sum + r.stargazers_count, 0);
  const described = originalRepos.filter(r => r.description !== null && r.description !== '').length;
  const headroom: Array<{ key: keyof typeof SCORE_MAXIMA; current: number; max: number; build: Recommendation }> = [
    {
      key: 'stars',
      current: score.stars,
      max: SCORE_MAXIMA.stars,
      build: {
        glyph: '★',
        title: totalStars === 0 ? 'Earn your first star' : `Reach ${nextStarMilestone(totalStars)} stars`,
        detail: totalStars === 0
          ? 'Push a polished project and share it. One person starring your repo unlocks Rising Star.'
          : 'Stars on your own repos saturate logarithmically: 10 stars is about 109 pts, ~750 fills the 300-pt cap.',
        impactPoints: SCORE_MAXIMA.stars - score.stars,
      },
    },
    {
      key: 'activity',
      current: score.activity,
      max: SCORE_MAXIMA.activity,
      build: {
        glyph: '▸',
        title: score.activity === 0 ? 'Push a commit this week' : 'Stay consistent',
        detail: score.activity === 0
          ? 'A push this week earns 25 recency pts — and touching repos in more distinct months adds a cadence bonus worth up to 75 pts.'
          : `This week's pushes are worth 25 pts each; updates from earlier months keep the monthly cadence bonus growing. ${SCORE_MAXIMA.activity - score.activity} pts more possible.`,
        impactPoints: SCORE_MAXIMA.activity - score.activity,
      },
    },
    {
      key: 'followers',
      current: score.followers,
      max: SCORE_MAXIMA.followers,
      build: {
        glyph: '◐',
        title: user.followers === 0 ? 'Get your first follower' : `Reach ${nextFollowerMilestone(user.followers)} followers`,
        detail: user.followers === 0
          ? 'Follow developers in your niche, comment on their issues, share your work. First follower = Social Butterfly.'
          : 'Followers saturate logarithmically: 10 is about 59 pts, ~1000 fills the 170-pt cap.',
        impactPoints: SCORE_MAXIMA.followers - score.followers,
      },
    },
    {
      key: 'repos',
      current: score.repos,
      max: SCORE_MAXIMA.repos,
      build: {
        glyph: '▣',
        title: `Publish ${Math.max(0, 40 - originalRepos.length)} more original repos`,
        detail: `Original (non-fork) repos saturate with sqrt: 40 fill the 160-pt base. Repos with descriptions add up to 20 pts of craft bonus.`,
        impactPoints: SCORE_MAXIMA.repos - score.repos,
      },
    },
    {
      key: 'diversity',
      current: score.diversity,
      max: SCORE_MAXIMA.diversity,
      build: {
        glyph: '◈',
        title: 'Widen your language range',
        detail: `Range counts effectively-used languages, not token ones: ${described > 0 ? 'balanced use of ~6 languages fills the 100-pt cap' : 'each genuinely used language raises the effective count toward the 100-pt cap'}.`,
        impactPoints: SCORE_MAXIMA.diversity - score.diversity,
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
  if (current < 250) return 250;
  if (current < 500) return 500;
  return Math.ceil((current + 1) / 250) * 250;
}

function nextFollowerMilestone(current: number): number {
  if (current < 10) return 10;
  if (current < 50) return 50;
  if (current < 100) return 100;
  if (current < 500) return 500;
  if (current < 1000) return 1000;
  return Math.ceil((current + 1) / 1000) * 1000;
}
