import { useState, type FormEvent } from 'react';
import type { ProfileAnalysis } from '../types.js';
import { getScoreRank } from '../lib/score.js';
import { apiJson, apiErrorMessage } from '../lib/api.js';
import ProfileCard from './ProfileCard.js';
import ScoreDisplay from './ScoreDisplay.js';
import Badges from './Badges.js';
import './CompareMode.css';

interface CompareResult {
  user1: ProfileAnalysis;
  user2: ProfileAnalysis;
}

type Leader = 'USER 1' | 'USER 2' | 'TIE';

interface CategoryRow {
  label: string;
  leader: Leader;
  delta: number;
}

function categoryRows(u1: ProfileAnalysis, u2: ProfileAnalysis): CategoryRow[] {
  const entries: Array<[string, (s: ProfileAnalysis['score']) => number]> = [
    ['Repos', s => s.repos],
    ['Stars', s => s.stars],
    ['Followers', s => s.followers],
    ['Activity', s => s.activity],
    ['Diversity', s => s.diversity],
  ];
  return entries.map(([label, pick]) => {
    const a = pick(u1.score);
    const b = pick(u2.score);
    if (a === b) return { label, leader: 'TIE', delta: 0 };
    return a > b
      ? { label, leader: 'USER 1', delta: a - b }
      : { label, leader: 'USER 2', delta: b - a };
  });
}

export default function CompareMode() {
  const [user1, setUser1] = useState('');
  const [user2, setUser2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  const handleCompare = async (e: FormEvent) => {
    e.preventDefault();
    if (!user1.trim() || !user2.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiJson<CompareResult>(
        `/api/compare/${encodeURIComponent(user1.trim())}/${encodeURIComponent(user2.trim())}`,
        undefined,
        { unreachableHint: 'API unreachable — run `npm run dev` (the Worker serves /api in-workerd), or check the deployment.' },
      );
      setResult(data);
    } catch (err) {
      setError(apiErrorMessage(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const winner =
    result && result.user1.score.total !== result.user2.score.total
      ? result.user1.score.total > result.user2.score.total
        ? result.user1.user.login
        : result.user2.user.login
      : null;

  return (
    <main className="main-content">
      <section className="compare">
        <div className="compare-label">COMPARE //</div>

        <form className="compare-form" onSubmit={handleCompare}>
          <div className="compare-field">
            <span className="compare-field-prefix" aria-hidden="true">▸</span>
            <input
              type="text"
              className="compare-input"
              placeholder="User 1"
              value={user1}
              onChange={e => setUser1(e.target.value)}
              disabled={loading}
            />
          </div>
          <span className="vs" aria-hidden="true">VS</span>
          <div className="compare-field">
            <span className="compare-field-prefix" aria-hidden="true">▸</span>
            <input
              type="text"
              className="compare-input"
              placeholder="User 2"
              value={user2}
              onChange={e => setUser2(e.target.value)}
              disabled={loading}
            />
          </div>
          <button type="submit" className="search-btn" disabled={loading || !user1.trim() || !user2.trim()}>
            {loading ? 'Comparing...' : 'Compare'}
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        {result && (
          <>
            <div className="compare-breakdown">
              <div className="compare-breakdown-eyebrow">BREAKDOWN //</div>
              <div className="compare-breakdown-rows">
                {categoryRows(result.user1, result.user2).map(row => (
                  <div className="compare-breakdown-row" key={row.label}>
                    <span className="compare-breakdown-cat">{row.label}</span>
                    {row.leader === 'TIE' ? (
                      <span className="compare-breakdown-leader is-tie">TIE</span>
                    ) : (
                      <span className="compare-breakdown-leader">
                        {row.leader} +{row.delta}
                      </span>
                    )}
                    <span className="compare-breakdown-value">
                      {row.leader === 'TIE' ? '—' : `Δ +${row.delta}`}
                    </span>
                  </div>
                ))}
                <div className="compare-breakdown-row compare-breakdown-total">
                  <span className="compare-breakdown-cat">TOTAL</span>
                  {result.user1.score.total === result.user2.score.total ? (
                    <span className="compare-breakdown-leader is-tie">TIE</span>
                  ) : (
                    <span className="compare-breakdown-leader">
                      {result.user1.score.total > result.user2.score.total ? 'USER 1' : 'USER 2'}{' '}
                      <span className="compare-breakdown-delta">
                        +{Math.abs(result.user1.score.total - result.user2.score.total)}
                      </span>
                    </span>
                  )}
                  <span className="compare-breakdown-value">
                    {result.user1.score.total === result.user2.score.total
                      ? '—'
                      : Math.min(result.user1.score.total, result.user2.score.total)}
                  </span>
                </div>
              </div>
            </div>
            <div className="compare-results">
            <div className={`compare-side ${winner === result.user1.user.login ? 'winner' : ''}`}>
              {winner === result.user1.user.login ? (
                <div className="winner-tag">Winner</div>
              ) : (
                <div className="contender-tag">Contender</div>
              )}
              <ProfileCard analysis={result.user1} />
              <ScoreDisplay score={result.user1.score} rank={getScoreRank(result.user1.score.total)} />
              <Badges badges={result.user1.badges} />
            </div>
            <div className={`compare-side ${winner === result.user2.user.login ? 'winner' : ''}`}>
              {winner === result.user2.user.login ? (
                <div className="winner-tag">Winner</div>
              ) : (
                <div className="contender-tag">Contender</div>
              )}
              <ProfileCard analysis={result.user2} />
              <ScoreDisplay score={result.user2.score} rank={getScoreRank(result.user2.score.total)} />
              <Badges badges={result.user2.badges} />
            </div>
            </div>
          </>
        )}

        {!result && !loading && !error && (
          <div className="empty-state">
            <div className="compare-empty-glyph" aria-hidden="true">◇</div>
            <p>Enter two GitHub usernames to compare.</p>
          </div>
        )}
      </section>
    </main>
  );
}
