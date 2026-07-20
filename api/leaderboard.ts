import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLeaderboard, getImprovedLeaderboard } from '../src/lib/leaderboard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const limitParam = typeof req.query?.limit === 'string' ? req.query.limit : undefined;
  const limit = Math.min(Math.max(parseInt(limitParam ?? '10', 10) || 10, 1), 100);

  const tab = typeof req.query?.tab === 'string' ? req.query.tab : 'global';
  const windowParam = typeof req.query?.window === 'string' ? req.query.window : '7';
  const windowDays = Math.min(Math.max(parseInt(windowParam ?? '7', 10) || 7, 1), 90);

  try {
    if (tab === 'improved') {
      const result = await getImprovedLeaderboard(limit, windowDays);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).json(result);
      return;
    }
    const result = await getLeaderboard(limit);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json(result);
  } catch (err) {
    console.error('leaderboard error:', err);
    res.status(200).json({ entries: [], total: 0 });
  }
}