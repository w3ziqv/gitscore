// ShareCard.tsx — Canvas-based shareable image + embeddable SVG badge link (F1).

import { useRef, useCallback, useState } from 'react';
import type { ProfileAnalysis } from '../types.js';
import { getScoreRank } from '../lib/score.js';

interface Props {
  analysis: ProfileAnalysis;
}

interface ThemeColors {
  bg: string;
  text: string;
  textMuted: string;
  textSecondary: string;
  barTrack: string;
  badgeBg: string;
  footer: string;
}

function getThemeColors(): ThemeColors {
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'dark') {
    return {
      bg: '#0c0c14',
      text: '#f5f5f0',
      textMuted: '#8a8a98',
      textSecondary: '#c0c0cc',
      barTrack: '#262635',
      badgeBg: '#16161f',
      footer: '#5a5a6a',
    };
  }
  if (theme === 'synthwave') {
    return {
      bg: '#1b0a3a',
      text: '#fee5ff',
      textMuted: '#8a64a8',
      textSecondary: '#cf8de8',
      barTrack: '#3a1a78',
      badgeBg: '#2a0e57',
      footer: '#5a4080',
    };
  }
  if (theme === 'terminal-green') {
    return {
      bg: '#02110a',
      text: '#c9ffe4',
      textMuted: '#4f9670',
      textSecondary: '#95e4b8',
      barTrack: '#08321a',
      badgeBg: '#04210f',
      footer: '#1f7a3a',
    };
  }
  if (theme === 'paper') {
    return {
      bg: '#ede5d2',
      text: '#1f1a10',
      textMuted: '#6a5a3f',
      textSecondary: '#3a2f1f',
      barTrack: '#e0d6ba',
      badgeBg: '#f3eddc',
      footer: '#3a2f1f',
    };
  }
  return {
    bg: '#fbfbf8',
    text: '#151524',
    textMuted: '#6d6d78',
    textSecondary: '#343446',
    barTrack: '#ebe9e0',
    badgeBg: '#f5f4ef',
    footer: '#c9c9c4',
  };
}

export default function ShareCard({ analysis }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);

  const drawCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const c = getThemeColors();

    const W = 1200;
    const H = 630;
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, W, H);

    // Hard Mistral: 8px block stripe instead of 8px soft column.
    ctx.fillStyle = '#ff5229';
    ctx.fillRect(0, 0, 8, H);

    ctx.fillStyle = c.text;
    ctx.font = '700 32px "Space Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('# GitScore', 60, 80);

    ctx.fillStyle = c.textMuted;
    ctx.font = '400 18px Inter, sans-serif';
    ctx.fillText('GitHub Profile Analysis', 60, 108);

    ctx.fillStyle = c.text;
    ctx.font = '500 48px Inter, sans-serif';
    ctx.fillText(analysis.user.name || analysis.user.login, 60, 180);

    ctx.fillStyle = c.textMuted;
    ctx.font = '400 24px "Space Mono", monospace';
    ctx.fillText(`@${analysis.user.login}`, 60, 215);

    const rank = getScoreRank(analysis.score.total);
    ctx.fillStyle = rank.color;
    ctx.font = '700 120px "Space Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(analysis.score.total), W - 60, 200);

    ctx.fillStyle = c.textMuted;
    ctx.font = '500 24px Inter, sans-serif';
    ctx.fillText(`Rank ${rank.rank}`, W - 60, 235);

    ctx.fillStyle = c.text;
    ctx.font = '500 18px Inter, sans-serif';
    ctx.textAlign = 'left';
    const breakdownLabels = ['Repos', 'Stars', 'Followers', 'Activity', 'Diversity'];
    const breakdownValues = [analysis.score.repos, analysis.score.stars, analysis.score.followers, analysis.score.activity, analysis.score.diversity];
    const breakdownMax = [200, 300, 200, 150, 150];
    const barX = 60;
    const barW = 400;
    const barH = 8;
    const barGap = 38;
    const startY = 290;

    breakdownLabels.forEach((label, i) => {
      const y = startY + i * barGap;
      ctx.fillStyle = c.textSecondary;
      ctx.font = '500 15px Inter, sans-serif';
      ctx.fillText(label, barX, y - 8);

      ctx.fillStyle = c.barTrack;
      ctx.fillRect(barX, y, barW, barH);

      ctx.fillStyle = '#ff5229';
      ctx.fillRect(barX, y, (barW * breakdownValues[i]) / breakdownMax[i], barH);

      ctx.fillStyle = c.textMuted;
      ctx.font = '700 14px "Space Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(breakdownValues[i]), barX + barW + 40, y + 7);
      ctx.textAlign = 'left';
    });

    const earnedBadges = analysis.badges.filter(b => b.earned);
    ctx.textAlign = 'left';
    const badgeStartY = 520;
    const badgeSize = 48;
    const badgeGap = 12;
    let badgeX = 60;

    earnedBadges.slice(0, 8).forEach((badge) => {
      ctx.fillStyle = c.badgeBg;
      ctx.fillRect(badgeX, badgeStartY, badgeSize, badgeSize);

      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(badge.emoji, badgeX + badgeSize / 2, badgeStartY + 34);
      ctx.textAlign = 'left';

      badgeX += badgeSize + badgeGap;
    });

    ctx.fillStyle = c.textMuted;
    ctx.font = '400 16px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${earnedBadges.length} badges earned`, 60, badgeStartY + 80);

    ctx.fillStyle = c.footer;
    ctx.font = '400 14px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('gitscore-mu.vercel.app', W - 60, H - 30);
    ctx.textAlign = 'left';
  }, [analysis]);

  const handleDownload = useCallback(() => {
    drawCard();
    const canvas = canvasRef.current;
    const link = linkRef.current;
    if (!canvas || !link) return;

    link.href = canvas.toDataURL('image/png');
    link.download = `gitscore-${analysis.user.login}.png`;
    link.click();
  }, [drawCard, analysis]);

  const handleEmbedCopy = useCallback(async () => {
    const url = `${window.location.origin}/api/badge/${encodeURIComponent(analysis.user.login)}`;
    const md = `![GitScore](${url})`;
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be blocked — silently no-op; user can copy the file from a fallback.
      setCopied(false);
    }
  }, [analysis.user.login]);

  return (
    <div className="share-card-section">
      <button className="share-btn" onClick={handleDownload}>
        Download Share Card
      </button>
      <button
        className={`embed-btn ${copied ? 'copied' : ''}`}
        onClick={handleEmbedCopy}
        title={`![GitScore](${window.location.origin}/api/badge/${analysis.user.login})`}
      >
        {copied ? 'Copied!' : 'Embed badge'}
      </button>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <a ref={linkRef} style={{ display: 'none' }} />
    </div>
  );
}