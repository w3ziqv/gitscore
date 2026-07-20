// ScoreDisplay.tsx — Hard Mistral square score block + pixel breakdown + sparkline (F5)

import { useEffect, useRef, useState } from 'react';
import type { ScoreBreakdown } from '../types.js';

interface Props {
  score: ScoreBreakdown;
  rank: { rank: string; color: string };
  generatedAtMs?: number;
  historyPoints?: number[];
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

export default function ScoreDisplay({ score, rank, generatedAtMs, historyPoints }: Props) {
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
  const fillPct = Math.min(100, (score.total / maxScore) * 100);

  const breakdownItems = [
    { label: 'Repos', value: score.repos, max: 200, color: '#ff5229' },
    { label: 'Stars', value: score.stars, max: 300, color: '#ff8204' },
    { label: 'Follow', value: score.followers, max: 200, color: '#0082e6' },
    { label: 'Activity', value: score.activity, max: 150, color: '#44ba82' },
    { label: 'Diversity', value: score.diversity, max: 150, color: '#151524' },
  ];

  return (
    <div className="score-display">
      <div
        className="score-square"
        style={{ ['--bc' as string]: rank.color } as React.CSSProperties}
      >
        <div
          className="score-square-fill-bar"
          style={{ height: `${fillPct}%`, backgroundColor: rank.color }}
        />
        <div className="score-text">
          <span
            className={`score-number ${done ? 'score-number-pop' : ''}`}
            style={{ color: rank.color }}
          >
            {displayed}
          </span>
          <span className="score-rank" style={{ color: rank.color }}>
            RANK {rank.rank}
          </span>
          {generatedAtMs !== undefined && (
            <span className="score-generated">GEN · {formatTime(generatedAtMs)}</span>
          )}
        </div>
      </div>

      <div className="score-breakdown">
        <h3>Score Breakdown /1000</h3>
        {breakdownItems.map(item => (
          <div key={item.label} className="breakdown-row">
            <span className="breakdown-label">{item.label}</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, (item.value / item.max) * 100))}%`,
                  ['--bc' as string]: item.color,
                  backgroundColor: item.color,
                } as React.CSSProperties}
              />
            </div>
            <span className="breakdown-value">{item.value}</span>
          </div>
        ))}
        {historyPoints && historyPoints.length >= 2 && (
          <Sparkline points={historyPoints} />
        )}
      </div>
    </div>
  );
}

// Sparkline — Hard Mistral pixel line. Renders SVG inline.
function Sparkline({ points }: { points: number[] }) {
  const W = 200;
  const H = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const cell = points.length - 1 || 1;

  const path = points
    .map((p, i) => {
      const x = (i / cell) * W;
      const y = H - ((p - min) / range) * H;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      className="score-sparkline"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="score history"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--orange)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {points.map((p, i) => {
        const x = (i / cell) * W;
        const y = H - ((p - min) / range) * H;
        return <rect key={i} x={x - 1} y={y - 1} width={3} height={3} fill="var(--text)" />;
      })}
      <text x={W - 2} y={H - 4} textAnchor="end" fontSize={8} fontFamily="monospace" fill="var(--text-muted)">
        last {points.length}d · {max - points[0] >= 0 ? '+' : ''}{max - points[0]}
      </text>
    </svg>
  );
}