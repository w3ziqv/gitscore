import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchProfile, sendError } from '../_lib/github.js';
import { getScoreRank } from '../../src/lib/score.js';
import { saveToLeaderboard } from '../../src/lib/leaderboard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { username } = req.query;
  if (typeof username !== 'string' || !username) {
    res.status(400).json({ error: 'Username required' });
    return;
  }

  try {
    const analysis = await fetchProfile(username);
    res.status(200).json(analysis);

    const rank = getScoreRank(analysis.score.total);
    const badgesEarned = analysis.badges.filter(b => b.earned).length;
    await saveToLeaderboard({
      login: analysis.user.login,
      name: analysis.user.name,
      avatar_url: analysis.user.avatar_url,
      score: analysis.score.total,
      rank: rank.rank,
      badgesEarned,
      totalStars: analysis.totalStars,
      followers: analysis.user.followers,
    }).catch(err => console.error('leaderboard save failed:', err));
  } catch (error) {
    sendError(res, error);
  }
}
