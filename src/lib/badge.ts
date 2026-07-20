// src/lib/badge.ts — Embeddable SVG score badge generator (pure function, testable).
//
// Output is a small 220x44 SVG card with orange rank stripe + rank letter +
// score number, suitable for dropping into a GitHub README:
//
//   ![GitScore](https://gitscore-mu.vercel.app/api/badge/w3ziqv)
//
// Layout (Hard Mistral pixel):
//   |--stripe--|----label----|-score-|
//   |# GitScore|   rank  score|     |
//
// The SVG is self-contained: no external fonts (uses monospace stack), no
// network calls, deterministic given the input.

import type { ScoreRank } from '../types.js';

export interface BadgeInput {
  login: string;
  score: number;
  rank: ScoreRank;
  theme?: 'light' | 'dark';
}

const RANK_COLORS: Record<ScoreRank, string> = {
  'S+': '#f85149',
  'S': '#f0883e',
  'A': '#ffa657',
  'B': '#d29922',
  'C': '#a5d6ff',
  'D': '#7d8590',
  'F': '#484f58',
};

export function generateBadgeSvg(input: BadgeInput): string {
  const theme = input.theme ?? 'light';
  const W = 220;
  const H = 44;
  const bg = theme === 'dark' ? '#0c0c14' : '#fbfbf8';
  const fg = theme === 'dark' ? '#f5f5f0' : '#151524';
  const muted = theme === 'dark' ? '#8a8a98' : '#6d6d78';
  const stripe = RANK_COLORS[input.rank] ?? '#ff5229';

  const safeLogin = escapeXml(input.login);
  const scoreStr = String(input.score);
  const rankStr = String(input.rank);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">
  <rect x="0" y="0" width="${W}" height="${H}" fill="${bg}" stroke="${fg}" stroke-width="2"/>
  <rect x="2" y="2" width="6" height="${H - 4}" fill="${stripe}"/>
  <text x="14" y="14" font-family="'Space Mono','SF Mono',Consolas,monospace" font-size="9" font-weight="700" fill="${muted}" letter-spacing="1"># GITScore</text>
  <text x="14" y="34" font-family="'Space Mono','SF Mono',Consolas,monospace" font-size="13" font-weight="700" fill="${fg}">${safeLogin}</text>
  <text x="${W - 60}" y="14" font-family="'Space Mono',monospace" font-size="9" font-weight="700" fill="${muted}" letter-spacing="1">RANK</text>
  <text x="${W - 60}" y="34" font-family="'Space Mono',monospace" font-size="14" font-weight="700" fill="${stripe}">${rankStr}</text>
  <rect x="${W - 36}" y="2" width="2" height="${H - 4}" fill="${fg}"/>
  <text x="${W - 30}" y="14" font-family="'Space Mono',monospace" font-size="9" font-weight="700" fill="${muted}" letter-spacing="1">SCORE</text>
  <text x="${W - 30}" y="34" font-family="'Space Mono',monospace" font-size="14" font-weight="700" fill="${fg}">${scoreStr}</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}