// api/compare/[user1]/[user2].ts — GET /api/compare/:user1/:user2

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchProfile, sendError } from '../../_lib/github.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { user1, user2 } = req.query;
  if (typeof user1 !== 'string' || typeof user2 !== 'string' || !user1 || !user2) {
    res.status(400).json({ error: 'Two usernames required' });
    return;
  }

  try {
    const [analysis1, analysis2] = await Promise.all([
      fetchProfile(user1),
      fetchProfile(user2),
    ]);
    res.status(200).json({ user1: analysis1, user2: analysis2 });
  } catch (error) {
    sendError(res, error);
  }
}
