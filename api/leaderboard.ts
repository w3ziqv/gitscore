import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLeaderboard } from '../src/lib/leaderboard.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const limitParam = typeof req.query?.limit === 'string' ? req.query.limit : undefined;
  const limit = Math.min(Math.max(parseInt(limitParam ?? '10', 10) || 10, 1), 100);

  try {
    const result = await getLeaderboard(limit);
    res.status(200).json(result);
  } catch (err) {
    console.error('leaderboard error:', err);
    res.status(200).json({ entries: [], total: 0 });
  }
}