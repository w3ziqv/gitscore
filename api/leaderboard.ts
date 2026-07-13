// api/leaderboard.ts — GET /api/leaderboard
// Note: in-memory cache is per-instance on Vercel serverless.
// For a persistent leaderboard, use Vercel KV or Postgres.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json([]);
}
