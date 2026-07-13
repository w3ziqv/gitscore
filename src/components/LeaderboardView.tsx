// LeaderboardView.tsx — Top-scored profiles ranking

import { useEffect, useState } from 'react';
import type { LeaderboardEntry } from '../types.js';

interface Props {
  onSearch: (username: string) => void;
}

const RANK_COLORS: Record<string, string> = {
  'S+': '#f85149',
  'S': '#f0883e',
  'A': '#ffa657',
  'B': '#d29922',
  'C': '#a5d6ff',
  'D': '#7d8590',
  'F': '#484f58',
};

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

export default function LeaderboardView({ onSearch }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/leaderboard?limit=10')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load leaderboard');
        return res.json() as Promise<{ entries: LeaderboardEntry[]; total: number }>;
      })
      .then(data => {
        if (!cancelled) setEntries(data.entries);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <main className="main-content">
        <div className="loading">Loading leaderboard…</div>
      </main>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <main className="main-content">
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <p>No profiles analyzed yet. Search a profile to populate the leaderboard.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <div className="leaderboard">
        <h2 className="leaderboard-title">Leaderboard</h2>
        <ol className="leaderboard-list">
          {entries.map((entry, i) => (
            <li
              key={entry.login}
              className="leaderboard-row"
              onClick={() => onSearch(entry.login)}
            >
              <span className="lb-rank-num">#{i + 1}</span>
              <img
                src={entry.avatar_url}
                alt={entry.login}
                className="lb-avatar"
                loading="lazy"
              />
              <span className="lb-login">{entry.login}</span>
              <span
                className="lb-rank-badge"
                style={{
                  color: RANK_COLORS[entry.rank] ?? 'var(--text-muted)',
                  borderColor: RANK_COLORS[entry.rank] ?? 'var(--border)',
                }}
              >
                {entry.rank}
              </span>
              <span className="lb-score">{entry.score}</span>
              <span className="lb-meta">★ {entry.totalStars}</span>
              <span className="lb-meta">🏅 {entry.badgesEarned}</span>
              <span className="lb-time">{relativeTime(entry.analyzedAtMs)}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}