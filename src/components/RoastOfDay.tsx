// RoastOfDay.tsx — F4 — homepage card showing the day's funniest roast.

import { useEffect, useState } from 'react';
import type { RoastResult } from '../types.js';
import './RoastOfDay.css';

interface RoastOfDayPayload {
  login: string;
  avatar_url: string;
  roast: RoastResult;
  generatedAtMs: number;
}

interface Props {
  onPick?: (login: string) => void;
}

export default function RoastOfDay({ onPick }: Props) {
  const [data, setData] = useState<RoastOfDayPayload | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/roast-of-the-day')
      .then(r => (r.ok ? r.json() : null))
      .then((payload: RoastOfDayPayload | null) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (data === undefined) {
    return (
      <div className="roast-of-day">
        <div className="roast-of-day-header">
          <span className="roast-of-day-dot" aria-hidden="true" />
          <span className="roast-of-day-kicker">ROAST OF THE DAY //</span>
        </div>
        <p className="roast-of-day-loading">Loading today's roast…</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="roast-of-day">
        <div className="roast-of-day-header">
          <span className="roast-of-day-dot" aria-hidden="true" />
          <span className="roast-of-day-kicker">ROAST OF THE DAY //</span>
        </div>
        <p className="roast-of-day-error">Roast feed unavailable. Check back later.</p>
      </div>
    );
  }

  const firstLine = data.roast.lines[0] ?? data.roast.overall;

  return (
    <div className="roast-of-day">
      <div className="roast-of-day-header">
        <span className="roast-of-day-dot" aria-hidden="true" />
        <span className="roast-of-day-kicker">ROAST OF THE DAY //</span>
      </div>
      <p className="roast-of-day-target">
        <span className="roast-of-day-target-label">TARGET</span>
        <a
          href={`https://github.com/${data.login}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            onPick?.(data.login);
          }}
        >
          @{data.login}
        </a>
      </p>
      <p className="roast-of-day-line">{firstLine}</p>
      <p className="roast-of-day-overall">
        <span className="roast-of-day-arrow" aria-hidden="true">▸</span>
        {data.roast.overall}
      </p>
    </div>
  );
}
