// src/lib/wrappedCard.ts — GitScore Wrapped share/social card generator (pure function, testable).
//
// Output is a 1200x630 SVG card for embeds and link previews: dark mission-
// control layout with eyebrow, headline, three stat cells, rank block and
// footer. The SVG is self-contained: no external fonts (system stacks only),
// no network calls, deterministic given the input.

import type { ScoreRank, WrappedReport } from '../types.js';

const RANK_COLORS: Record<ScoreRank, string> = {
  'S+': '#f85149',
  'S': '#f0883e',
  'A': '#ffa657',
  'B': '#d29922',
  'C': '#a5d6ff',
  'D': '#7d8590',
  'F': '#484f58',
};

const MONO_STACK = "'JetBrains Mono','SF Mono',Consolas,monospace";
const SANS_STACK = "'Space Grotesk','Inter','Segoe UI',system-ui,sans-serif";

const W = 1200;
const H = 630;
const PAD = 64;

const FOOTER_DOMAIN = 'gitscore.mateusz-szostak1.workers.dev';

const VERDICT_MAX_CHARS = 90;

export function generateWrappedCardSvg(report: WrappedReport): string {
  const fmt = new Intl.NumberFormat('en-US');

  const safeName = escapeXml(report.name ?? '');
  const safeLogin = escapeXml(report.login);
  const headline = report.name ? `${safeName} @${safeLogin}` : safeLogin;

  const commits = fmt.format(report.commits);
  const prs = fmt.format(report.prsOpened);
  const stars = fmt.format(report.starsNowTotal);
  const score = fmt.format(report.score);

  const rankColor = RANK_COLORS[report.rank] ?? '#9d9d9d';

  const verdict = report.aiVerdict === null ? '' : quotedVerdict(report.aiVerdict);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#000000" stroke="rgb(255 255 255 / 0.1)" stroke-width="1"/>
  <text x="${PAD}" y="96" font-family="${MONO_STACK}" font-size="20" font-weight="700" fill="#8f8f9b" letter-spacing="3.6">GITSCORE WRAPPED // LAST 365 DAYS</text>
  <text x="${PAD}" y="208" font-family="${SANS_STACK}" font-size="72" font-weight="700" fill="#f0f0fa">${headline}</text>
  <rect x="${PAD}" y="288" width="320" height="1" fill="rgb(255 255 255 / 0.1)"/>
  <text x="${PAD}" y="384" font-family="${MONO_STACK}" font-size="56" font-weight="700" fill="#f0f0fa">${commits}</text>
  <text x="${PAD}" y="426" font-family="${MONO_STACK}" font-size="18" font-weight="700" fill="#8f8f9b" letter-spacing="2.5">COMMITS</text>
  <rect x="440" y="288" width="320" height="1" fill="rgb(255 255 255 / 0.1)"/>
  <text x="440" y="384" font-family="${MONO_STACK}" font-size="56" font-weight="700" fill="#f0f0fa">${prs}</text>
  <text x="440" y="426" font-family="${MONO_STACK}" font-size="18" font-weight="700" fill="#8f8f9b" letter-spacing="2.5">PULL REQUESTS</text>
  <rect x="816" y="288" width="320" height="1" fill="rgb(255 255 255 / 0.1)"/>
  <text x="816" y="384" font-family="${MONO_STACK}" font-size="56" font-weight="700" fill="#f0f0fa">${stars}</text>
  <text x="816" y="426" font-family="${MONO_STACK}" font-size="18" font-weight="700" fill="#8f8f9b" letter-spacing="2.5">STARS</text>
  <text x="${PAD}" y="566" font-family="${SANS_STACK}" font-size="120" font-weight="700" fill="${rankColor}">${report.rank}</text>
  <text x="216" y="516" font-family="${MONO_STACK}" font-size="28" font-weight="700" fill="#9d9d9d">SCORE ${score}/1000</text>
  ${verdict === '' ? '' : `<text x="${W - PAD}" y="552" text-anchor="end" font-family="${SANS_STACK}" font-size="20" font-style="italic" fill="#f0f0fa">${verdict}</text>`}
  <text x="${W - PAD}" y="582" text-anchor="end" font-family="${MONO_STACK}" font-size="18" font-weight="700" fill="#8f8f9b">${FOOTER_DOMAIN}</text>
</svg>`;
}

function quotedVerdict(text: string): string {
  const clipped =
    text.length > VERDICT_MAX_CHARS
      ? `${text.slice(0, VERDICT_MAX_CHARS - 1)}…`
      : text;
  return `“${escapeXml(clipped)}”`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}