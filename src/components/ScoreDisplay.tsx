// ScoreDisplay.tsx — x.ai dark score panel: hero count-up + hairline breakdown + sparkline (F5)

import { useEffect, useRef, useState } from 'react';
import type { ScoreBreakdown } from '../types.js';
import './ScoreDisplay.css';

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
  // Driven by `displayed` so the accent bar tracks the count-up, not a separate snap.
  const fillPct = Math.min(100, (displayed / maxScore) * 100);

  const breakdownItems = [
    { label: 'Repos', value: score.repos, max: 200 },
    { label: 'Stars', value: score.stars, max: 300 },
    { label: 'Follow', value: score.followers, max: 200 },
    { label: 'Activity', value: score.activity, max: 150 },
    { label: 'Diversity', value: score.diversity, max: 150 },
  ];

  return (
    <div className="sd-display">
      <div className="sd-hero">
        <div className="sd-hero-bar" style={{ width: `${fillPct}%`, backgroundColor: rank.color }} />
        <div className="sd-hero-body">
          <span className="sd-micro sd-micro-label">SCORE //</span>
          <span className={`sd-number ${done ? 'sd-number-pop' : ''}`}>{displayed}</span>
          <div className="sd-hero-meta">
            <span className="sd-rank" style={{ color: rank.color }}>
              RANK {rank.rank}
            </span>
            {generatedAtMs !== undefined && (
              <span className="sd-gen">GEN {formatTime(generatedAtMs)}</span>
            )}
            <span className="sd-max">MAX {maxScore}</span>
          </div>
        </div>
      </div>

      <div className="sd-breakdown">
        <div className="sd-breakdown-head">
          <span className="sd-head-label">Breakdown</span>
          <span className="sd-head-max">/1000</span>
        </div>
        {breakdownItems.map(item => (
          <div key={item.label} className="sd-row">
            <div className="sd-row-head">
              <span className="sd-label">{item.label}</span>
              <span className="sd-value">{item.value}</span>
            </div>
            <div className="sd-track">
              <div
                className="sd-fill"
                style={{ width: `${Math.max(0, Math.min(100, (item.value / item.max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
        {historyPoints && historyPoints.length >= 2 && (
          <Sparkline points={historyPoints} />
        )}
      </div>
    </div>
  );
}

// Sparkline — 1px hairline on transparent; readout is HTML (SVG text would
// distort under preserveAspectRatio="none" and can't resolve CSS vars).
function Sparkline({ points }: { points: number[] }) {
  const W = 200;
  const H = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const cell = points.length - 1 || 1;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // svg is stretched (preserveAspectRatio="none"): map fractional offset, not raw offsetX.
  const handleHover = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(frac * (points.length - 1)));
  };

  const hoverPct = hoverIndex === null ? null : (hoverIndex / (points.length - 1)) * 100;
  const hoverDelta =
    hoverIndex !== null && hoverIndex > 0 ? points[hoverIndex] - points[hoverIndex - 1] : null;

  const path = points
    .map((p, i) => {
      const x = (i / cell) * W;
      const y = H - ((p - min) / range) * H;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  // Vertical ticks instead of rects: vectorEffect keeps them 1px crisp even
  // when the viewBox is stretched to the container width.
  const ticks = points
    .map((p, i) => {
      const x = (i / cell) * W;
      const y = H - ((p - min) / range) * H;
      return `M${x.toFixed(2)},${(y - 2).toFixed(2)} v4`;
    })
    .join(' ');

  const delta = points[points.length - 1] - points[0];

  return (
    <div className="sd-sparkline-wrap">
      <svg
        className="sd-sparkline"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="score history"
        onMouseMove={handleHover}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <path
          d={path}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={ticks}
          fill="none"
          stroke="var(--dim)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {hoverIndex !== null && hoverPct !== null && (
        <>
          <div
            className="sd-sparkline-guide"
            style={{ left: `max(0px, min(100%, ${hoverPct}%))` }}
          />
          <span
            className="sd-sparkline-hover"
            style={{ left: `max(1.5rem, min(calc(100% - 1.5rem), ${hoverPct}%))` }}
          >
            day {hoverIndex + 1} // <span className="sd-sparkline-hover-value">{points[hoverIndex]}</span>{' '}
            {hoverDelta === null ? (
              <span className="sd-sparkline-hover-delta-none">—</span>
            ) : (
              <span className={hoverDelta >= 0 ? 'sd-sparkline-hover-delta-pos' : 'sd-sparkline-hover-delta-neg'}>
                {hoverDelta >= 0 ? '+' : ''}{hoverDelta}
              </span>
            )}
          </span>
        </>
      )}
      <span className="sd-sparkline-readout">
        last {points.length}d ·{' '}
        <span className="sd-sparkline-delta">{delta >= 0 ? '+' : ''}{delta}</span>
      </span>
    </div>
  );
}
