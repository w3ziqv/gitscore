// LeaderboardView.tsx — Top-scored profiles ranking with tabs:
//   - Global         (Neon + localStorage)
//   - Most improved  (F6 — score-delta over window)
//   - Squad          (F7 — pinned friends, localStorage)

import { useEffect, useState, type CSSProperties } from 'react';
import type { ImprovedLeaderboardEntry, LeaderboardEntry, ScoreRank } from '../types.js';
import { readLocalLeaderboard, mergeLeaderboards } from '../lib/localLeaderboard.js';
import {
  addSquadMember,
  readSquad,
  removeSquadMember,
} from '../lib/squad.js';
import './LeaderboardView.css';

interface Props {
  onSearch: (username: string) => void;
}

type Tab = 'global' | 'improved' | 'squad';
type WindowDays = 7 | 30;

// Rank chip colors reference the design-system tokens (index.css) —
// the hex values live there, this map only routes rank → token.
const RANK_COLORS: Record<string, string> = {
  'S+': 'var(--rank-s-plus)',
  'S': 'var(--rank-s)',
  'A': 'var(--rank-a)',
  'B': 'var(--rank-b)',
  'C': 'var(--rank-c)',
  'D': 'var(--rank-d)',
  'F': 'var(--rank-f)',
};

/** Rank chip style — the only presentation value kept inline is the
 *  data-driven rank color; typography/borders live in LeaderboardView.css. */
function rankChip(rank: ScoreRank): CSSProperties {
  return { '--rank-color': RANK_COLORS[rank] ?? 'var(--muted)' } as CSSProperties;
}

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
      <section className="lb-panel">
        <header className="lb-header">
          <span className="lb-eyebrow">Leaderboard //</span>
          <div className="lb-header-row">
            <div className="lb-tabs" role="tablist">
              <button
                role="tab"
                className={`lb-tab ${tab === 'global' ? 'active' : ''}`}
                onClick={() => setTab('global')}
              >
                Global
              </button>
              <button
                role="tab"
                className={`lb-tab ${tab === 'improved' ? 'active' : ''}`}
                onClick={() => setTab('improved')}
              >
                Most improved
              </button>
              <button
                role="tab"
                className={`lb-tab ${tab === 'squad' ? 'active' : ''}`}
                onClick={() => setTab('squad')}
              >
                Squad
              </button>
            </div>

            {tab === 'improved' && (
              <div className="lb-window" role="group" aria-label="Window">
                <button
                  className={`lb-window-btn${windowDays === 7 ? ' active' : ''}`}
                  onClick={() => setWindowDays(7)}
                >
                  7d
                </button>
                <button
                  className={`lb-window-btn${windowDays === 30 ? ' active' : ''}`}
                  onClick={() => setWindowDays(30)}
                >
                  30d
                </button>
              </div>
            )}
          </div>
        </header>

      {tab !== 'squad' && loading && (
        <div className="loading">Loading leaderboard…</div>
      )}

      {tab === 'squad' && (
        <>
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
            <p className="lb-empty-note">Pin a few logins above to see your squad here.</p>
          ) : (
            <ol className="lb-list">
              {Array.from(new Set(squad)).map(login => {
                const local = globalEntries.find(e => e.login.toLowerCase() === login.toLowerCase());
                return (
                  <li
                    key={login}
                    className="lb-row"
                    onClick={() => onSearch(login)}
                  >
                    <span className="lb-rank-num">—</span>
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
                          style={rankChip(local.rank)}
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
                      className="lb-remove"
                      aria-label={`Remove ${login} from squad`}
                      onClick={e => {
                        e.stopPropagation();
                        handleRemoveSquad(login);
                      }}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      {tab === 'global' && !loading && globalEntries.length === 0 && (
        <div className="empty-state lb-empty">
          <div className="lb-empty-mark" aria-hidden="true">◇</div>
          <p>No profiles analyzed yet. Search a profile to populate the leaderboard.</p>
        </div>
      )}

      {tab === 'global' && !loading && globalEntries.length > 0 && (
        <ol className="lb-list">
          {globalEntries.map((entry, i) => (
            <li
              key={entry.login}
              className="lb-row"
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
                style={rankChip(entry.rank)}
              >
                {entry.rank}
              </span>
              <span className="lb-score">{entry.score}</span>
              <span className="lb-meta lb-stars">◇ {entry.totalStars}</span>
              <span className="lb-meta lb-badges">▸ {entry.badgesEarned}</span>
              <span className="lb-time">{relativeTime(entry.analyzedAtMs)}</span>
            </li>
          ))}
        </ol>
      )}

      {tab === 'improved' && !loading && improvedEntries.length === 0 && (
        <div className="empty-state lb-empty">
          <div className="lb-empty-mark" aria-hidden="true">▸</div>
          <p>
            No score movement yet — analyze the same profile on different days to
            build score history for the &quot;most improved&quot; tab.
          </p>
        </div>
      )}

      {tab === 'improved' && !loading && improvedEntries.length > 0 && (
        <ol className="lb-list">
          {improvedEntries.map((entry, i) => {
            const deltaCls = entry.delta > 0 ? 'up' : entry.delta < 0 ? 'down' : '';
            const deltaStr = entry.delta >= 0 ? `+${entry.delta}` : `${entry.delta}`;
            return (
              <li
                key={entry.login}
                className="lb-row"
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
                  style={rankChip(entry.rank)}
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
      )}
    </section>
    </main>
  );
}

