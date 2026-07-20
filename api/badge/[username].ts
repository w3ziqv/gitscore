// api/badge/[username].ts — embeddable SVG score badge.
//
//   GET /api/badge/:username?theme=dark
//
// Returns `image/svg+xml` with `Cache-Control: public, max-age=3600` so README
// badges stay fresh-ish without hammering GitHub. Falls back to a gray rank
// "F" placeholder on error (so embeds never break).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchProfile, sendError } from '../_lib/github.js';
import { getScoreRank } from '../../src/lib/score.js';
import { generateBadgeSvg } from '../../src/lib/badge.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).setHeader('Content-Type', 'image/svg+xml').send(badgeError('Method not allowed'));
    return;
  }

  const username = typeof req.query?.username === 'string' ? req.query.username : '';
  if (!username) {
    res.status(400).setHeader('Content-Type', 'image/svg+xml').send(badgeError('Username required'));
    return;
  }

  const themeQ = typeof req.query?.theme === 'string' ? req.query.theme : 'light';
  const theme: 'light' | 'dark' = themeQ === 'dark' ? 'dark' : 'light';

  try {
    const analysis = await fetchProfile(username);
    const rank = getScoreRank(analysis.score.total);
    const svg = generateBadgeSvg({
      login: analysis.user.login,
      score: analysis.score.total,
      rank: rank.rank,
      theme,
    });
    res.status(200)
      .setHeader('Content-Type', 'image/svg+xml')
      .setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
      .setHeader('Vary', 'Accept-Encoding')
      .send(svg);
  } catch (error) {
    console.error('badge error:', error);
    // Return a 200 with placeholder so embedded README badges don't red-x.
    res.status(200)
      .setHeader('Content-Type', 'image/svg+xml')
      .setHeader('Cache-Control', 'public, max-age=60')
      .send(badgeError(username));
    sendError;
  }
}

function badgeError(login: string): string {
  // Hard-edge placeholder rank "F" + score "?".
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="44" viewBox="0 0 220 44" shape-rendering="crispEdges">
  <rect x="0" y="0" width="220" height="44" fill="#fbfbf8" stroke="#151524" stroke-width="2"/>
  <rect x="2" y="2" width="6" height="40" fill="#484f58"/>
  <text x="14" y="14" font-family="monospace" font-size="9" font-weight="700" fill="#6d6d78" letter-spacing="1"># GITScore</text>
  <text x="14" y="34" font-family="monospace" font-size="13" font-weight="700" fill="#151524">${escapeXml(login || 'unknown')}</text>
  <text x="160" y="14" font-family="monospace" font-size="9" font-weight="700" fill="#6d6d78" letter-spacing="1">RANK</text>
  <text x="160" y="34" font-family="monospace" font-size="14" font-weight="700" fill="#484f58">?</text>
  <text x="190" y="14" font-family="monospace" font-size="9" font-weight="700" fill="#6d6d78" letter-spacing="1">SCORE</text>
  <text x="190" y="34" font-family="monospace" font-size="14" font-weight="700" fill="#151524">N/A</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}