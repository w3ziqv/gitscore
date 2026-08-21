// ShareCard.tsx — Canvas-based shareable image + embeddable SVG badge link (F1).

import { useRef, useCallback, useState } from 'react';
import type { ProfileAnalysis } from '../types.js';
import { getScoreRank, SCORE_MAXIMA } from '../lib/score.js';
import './ShareCard.css';

interface Props {
  analysis: ProfileAnalysis;
}

interface ThemeColors {
  bg: string;
  text: string;
  textMuted: string;
  textSecondary: string;
  barTrack: string;
  barFill: string;
  badgeBg: string;
  footer: string;
}

// Single x.ai dark palette — mirrors the design-system tokens in index.css.
function getThemeColors(): ThemeColors {
  return {
    bg: '#0e0e0e',
    text: '#f0f0fa',
    textMuted: '#9d9d9d',
    textSecondary: '#f0f0fa',
    barTrack: '#161616',
    barFill: '#6b6b6b',
    badgeBg: '#161616',
    footer: '#6b6b6b',
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

    const rank = getScoreRank(analysis.score.total);

    // Hard Mistral: 8px block stripe instead of 8px soft column.
    ctx.fillStyle = rank.color;
    ctx.fillRect(0, 0, 8, H);

    ctx.fillStyle = c.text;
    ctx.font = '700 32px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('# GitScore', 60, 80);

    ctx.fillStyle = c.textMuted;
    ctx.font = '400 18px Inter, sans-serif';
    ctx.fillText('GitHub Profile Analysis', 60, 108);

    ctx.fillStyle = c.text;
    ctx.font = '500 48px Inter, sans-serif';
    ctx.fillText(analysis.user.name || analysis.user.login, 60, 180);

    ctx.fillStyle = c.textMuted;
    ctx.font = '400 24px "JetBrains Mono", monospace';
    ctx.fillText(`@${analysis.user.login}`, 60, 215);

    ctx.fillStyle = rank.color;
    ctx.font = '700 120px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(analysis.score.total), W - 60, 200);

    ctx.fillStyle = c.textMuted;
    ctx.font = '500 24px Inter, sans-serif';
    ctx.fillText(`Rank ${rank.rank}`, W - 60, 235);

    ctx.fillStyle = c.text;
    ctx.font = '500 18px Inter, sans-serif';
    ctx.textAlign = 'left';
    const breakdownLabels = ['Impact', 'Consistency', 'Portfolio', 'Community', 'Range'];
    const breakdownValues = [analysis.score.stars, analysis.score.activity, analysis.score.repos, analysis.score.followers, analysis.score.diversity];
    const breakdownMax = [SCORE_MAXIMA.stars, SCORE_MAXIMA.activity, SCORE_MAXIMA.repos, SCORE_MAXIMA.followers, SCORE_MAXIMA.diversity];
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

      ctx.fillStyle = c.barFill;
      ctx.fillRect(barX, y, (barW * breakdownValues[i]) / breakdownMax[i], barH);

      ctx.fillStyle = c.textMuted;
      ctx.font = '700 14px "JetBrains Mono", monospace';
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

      ctx.fillStyle = c.text;
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(badge.glyph, badgeX + badgeSize / 2, badgeStartY + 34);
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
    ctx.fillText('gitscore.mateusz-szostak1.workers.dev', W - 60, H - 30);
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
      <div className="share-card-group">
        <span className="share-card-label">SHARE //</span>
        <button className="share-btn" onClick={handleDownload}>
          Download PNG
        </button>
      </div>
      <div className="share-card-group">
        <span className="share-card-label">EMBED</span>
        <button
          className={`embed-btn ${copied ? 'copied' : ''}`}
          onClick={handleEmbedCopy}
          title={`![GitScore](${window.location.origin}/api/badge/${analysis.user.login})`}
        >
          {copied ? 'Copied!' : 'Embed badge'}
        </button>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <a ref={linkRef} style={{ display: 'none' }} />
    </div>
  );
}