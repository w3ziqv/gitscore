// LeaderboardView.tsx — Top-scored profiles ranking with tabs:
//   - Global         (Neon + localStorage)
//   - Most improved  (F6 — score-delta over window)
//   - Squad          (F7 — pinned friends, localStorage)

import { useEffect, useState } from 'react';
import type { ImprovedLeaderboardEntry, LeaderboardEntry, ScoreRank } from '../types.js';
import { readLocalLeaderboard, mergeLeaderboards } from '../lib/localLeaderboard.js';
import {
  addSquadMember,
  readSquad,
  removeSquadMember,
} from '../lib/squad.js';

interface Props {
  onSearch: (username: string) => void;
}

type Tab = 'global' | 'improved' | 'squad';
type WindowDays = 7 | 30;

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

interface GlobalRow {
  login: string;
  name: string | null;
  avatar_url: string;
  score: number;
  rank: ScoreRank;
  badgesEarned: number;
  totalStars: number;
  followers: number;
  analyzedAtMs: number;
}

export default function LeaderboardView({ onSearch }: Props) {
  const [tab, setTab] = useState<Tab>('global');
  const [windowDays, setWindowDays] = useState<WindowDays>(7);
  const [loading, setLoading] = useState(true);
  const [globalEntries, setGlobalEntries] = useState<GlobalRow[]>([]);
  const [improvedEntries, setImprovedEntries] = useState<ImprovedLeaderboardEntry[]>([]);
  const [squad, setSquad] = useState<string[]>([]);
  const [squadInput, setSquadInput] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSquad(readSquad());
  }, []);

  // Load global + (lazily) improved.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/leaderboard?limit=10')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load leaderboard');
        return res.json() as Promise<{ entries: LeaderboardEntry[]; total: number }>;
      })
      .then(data => {
        if (cancelled) return;
        const local = readLocalLeaderboard();
        setGlobalEntries(mergeLeaderboards(data.entries, local, 10));
      })
      .catch(() => {
        if (cancelled) return;
        setGlobalEntries(mergeLeaderboards([], readLocalLeaderboard(), 10));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab !== 'improved') return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/leaderboard?tab=improved&window=${windowDays}&limit=10`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load improved');
        return res.json() as Promise<{ entries: ImprovedLeaderboardEntry[]; total: number }>;
      })
      .then(data => {
        if (!cancelled) setImprovedEntries(data.entries);
      })
      .catch(() => {
        if (!cancelled) setImprovedEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, windowDays]);

  const handleAddSquad = () => {
    const trimmed = squadInput.trim().replace(/^@/, '');
    if (!trimmed) return;
    const next = addSquadMember(trimmed);
    setSquad(next);
    setSquadInput('');
  };

  const handleRemoveSquad = (login: string) => {
    const next = removeSquadMember(login);
    setSquad(next);
  };

  return (
    <main className="main-content">
      <div className="leaderboard-tabs" role="tablist">
        <button
          role="tab"
          className={`leaderboard-tab ${tab === 'global' ? 'active' : ''}`}
          onClick={() => setTab('global')}
        >
          Global
        </button>
        <button
          role="tab"
          className={`leaderboard-tab ${tab === 'improved' ? 'active' : ''}`}
          onClick={() => setTab('improved')}
        >
          Most improved
        </button>
        <button
          role="tab"
          className={`leaderboard-tab ${tab === 'squad' ? 'active' : ''}`}
          onClick={() => setTab('squad')}
        >
          Squad
        </button>
      </div>

      {tab === 'improved' && (
        <div className="squad-controls" style={{ marginBottom: '1rem' }}>
          <button
            className="leaderboard-tab"
            onClick={() => setWindowDays(7)}
            style={{ background: windowDays === 7 ? 'var(--text)' : 'var(--bg)', color: windowDays === 7 ? 'var(--orange)' : 'var(--text)' }}
          >
            7 days
          </button>
          <button
            className="leaderboard-tab"
            onClick={() => setWindowDays(30)}
            style={{ background: windowDays === 30 ? 'var(--text)' : 'var(--bg)', color: windowDays === 30 ? 'var(--orange)' : 'var(--text)' }}
          >
            30 days
          </button>
        </div>
      )}

      {tab !== 'squad' && loading && (
        <div className="loading">Loading leaderboard…</div>
      )}

      {tab === 'squad' && (
        <div className="leaderboard">
          <div className="squad-controls">
            <input
              className="squad-input"
              type="text"
              placeholder="@username to pin"
              value={squadInput}
              onChange={e => setSquadInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSquad();
                }
              }}
            />
            <button className="squad-add-btn" onClick={handleAddSquad}>
              + PIN
            </button>
          </div>
          {squad.length === 0 ? (
            <p className="loading">Pin a few logins above to see your squad here.</p>
          ) : (
            <ol className="leaderboard-list">
              {Array.from(new Set(squad)).map(login => {
                const local = globalEntries.find(e => e.login.toLowerCase() === login.toLowerCase());
                return (
                  <li
                    key={login}
                    className="leaderboard-row"
                    onClick={() => onSearch(login)}
                  >
                    <span className="lb-rank-num">·</span>
                    {local && (
                      <img
                        src={local.avatar_url}
                        alt={local.login}
                        className="lb-avatar"
                        loading="lazy"
                      />
                    )}
                    <span className="lb-login">{login}</span>
                    {local && (
                      <>
                        <span
                          className="lb-rank-badge"
                          style={{
                            color: RANK_COLORS[local.rank] ?? 'var(--text-muted)',
                            borderColor: RANK_COLORS[local.rank] ?? 'var(--border)',
                          }}
                        >
                          {local.rank}
                        </span>
                        <span className="lb-score">{local.score}</span>
                      </>
                    )}
                    {!local && (
                      <span className="lb-meta">analyze first →</span>
                    )}
                    <button
                      className="squad-remove"
                      onClick={e => {
                        e.stopPropagation();
                        handleRemoveSquad(login);
                      }}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {tab === 'global' && !loading && globalEntries.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <p>No profiles analyzed yet. Search a profile to populate the leaderboard.</p>
        </div>
      )}

      {tab === 'global' && !loading && globalEntries.length > 0 && (
        <div className="leaderboard">
          <h2 className="leaderboard-title">Leaderboard</h2>
          <ol className="leaderboard-list">
            {globalEntries.map((entry, i) => (
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
      )}

      {tab === 'improved' && !loading && improvedEntries.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📈</div>
          <p>
            No score movement yet — analyze the same profile on different days to
            build score history for the &quot;most improved&quot; tab.
          </p>
        </div>
      )}

      {tab === 'improved' && !loading && improvedEntries.length > 0 && (
        <div className="leaderboard">
          <h2 className="leaderboard-title">Most improved · {windowDays}d</h2>
          <ol className="leaderboard-list">
            {improvedEntries.map((entry, i) => {
              const deltaCls = entry.delta > 0 ? 'up' : entry.delta < 0 ? 'down' : '';
              const deltaStr = entry.delta >= 0 ? `+${entry.delta}` : `${entry.delta}`;
              return (
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
                  <span className={`lb-delta ${deltaCls}`}>{deltaStr}</span>
                  <span className="lb-time">{relativeTime(entry.analyzedAtMs)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </main>
  );
}

