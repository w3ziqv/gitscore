// ScoreDisplay.tsx — Animated score circle + breakdown

import { useEffect, useRef, useState } from 'react';
import type { ScoreBreakdown } from '../types.js';

interface Props {
  score: ScoreBreakdown;
  rank: { rank: string; color: string };
  generatedAtMs?: number;
}

const ANIM_MS = 900;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function ScoreDisplay({ score, rank, generatedAtMs }: Props) {
  const [displayed, setDisplayed] = useState(0);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setDisplayed(0);
    setDone(false);
    const start = performance.now();
    const target = score.total;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / ANIM_MS, 1);
      const eased = easeOutCubic(t);
      setDisplayed(Math.round(target * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayed(target);
        setDone(true);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [score.total]);

  const maxScore = 1000;
  const percentage = (score.total / maxScore) * 100;
  const circumference = 2 * Math.PI * 70;
  const dashOffset = circumference - (percentage / 100) * circumference;

  const breakdownItems = [
    { label: 'Repos', value: score.repos, max: 200, color: '#ff5229' },
    { label: 'Stars', value: score.stars, max: 300, color: '#ff8204' },
    { label: 'Followers', value: score.followers, max: 200, color: '#0082e6' },
    { label: 'Activity', value: score.activity, max: 150, color: '#44ba82' },
    { label: 'Diversity', value: score.diversity, max: 150, color: '#151524' },
  ];

  return (
    <div className="score-display">
      <div className="score-circle">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="70" fill="none" stroke="var(--surface-hover)" strokeWidth="8" />
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke={rank.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <div className="score-text">
          <span
            className={`score-number ${done ? 'score-number-pop' : ''}`}
            style={{ color: rank.color }}
          >
            {displayed}
          </span>
          <span className="score-rank" style={{ color: rank.color }}>
            Rank {rank.rank}
          </span>
          {generatedAtMs !== undefined && (
            <span className="score-generated">Generated · {formatTime(generatedAtMs)}</span>
          )}
        </div>
      </div>

      <div className="score-breakdown">
        <h3>Score Breakdown</h3>
        {breakdownItems.map(item => (
          <div key={item.label} className="breakdown-row">
            <span className="breakdown-label">{item.label}</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill"
                style={{
                  width: `${(item.value / item.max) * 100}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <span className="breakdown-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}