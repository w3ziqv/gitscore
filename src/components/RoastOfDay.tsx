// RoastOfDay.tsx — F4 — homepage card showing the day's funniest roast.

import { useEffect, useState } from 'react';
import type { RoastResult } from '../types.js';

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
        <p className="roast-of-day-target">Loading today's roast…</p>
      </div>
    );
  }

  if (data === null) {
    return null;
  }

  const firstLine = data.roast.lines[0] ?? data.roast.overall;

  return (
    <div className="roast-of-day">
      <p className="roast-of-day-target">
        TARGET:{' '}
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
      <p className="roast-of-day-overall">» {data.roast.overall}</p>
    </div>
  );
}