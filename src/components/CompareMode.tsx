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
        { unreachableHint: 'API unreachable — run `npm run dev:all`, `vercel dev`, or use the Vercel deployment.' },
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
