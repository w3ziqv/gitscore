import { useState, useCallback } from 'react';
import type { ProfileAnalysis, RoastResult } from '../types.js';
import { getScoreRank } from '../lib/score.js';
import SearchBar from './SearchBar.js';
import ProfileCard from './ProfileCard.js';
import ScoreDisplay from './ScoreDisplay.js';
import LanguageChart from './LanguageChart.js';
import Badges from './Badges.js';
import RoastPanel from './RoastPanel.js';
import CompareMode from './CompareMode.js';
import './App.css';

type View = 'single' | 'compare';

export default function App() {
  const [view, setView] = useState<View>('single');
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [roast, setRoast] = useState<RoastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRoast, setShowRoast] = useState(false);

  const handleSearch = useCallback(async (username: string) => {
    setLoading(true);
    setError(null);
    setShowRoast(false);
    setRoast(null);

    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(username)}`);
      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error);
      }
      const data = (await res.json()) as ProfileAnalysis;
      setAnalysis(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRoast = useCallback(async () => {
    if (!analysis) return;
    if (roast) {
      setShowRoast(s => !s);
      return;
    }

    try {
      const res = await fetch(`/api/roast/${encodeURIComponent(analysis.user.login)}`);
      if (!res.ok) throw new Error('Failed to roast');
      const data = (await res.json()) as RoastResult;
      setRoast(data);
      setShowRoast(true);
    } catch {
      setError('Failed to generate roast');
    }
  }, [analysis, roast]);

  const rank = analysis ? getScoreRank(analysis.score.total) : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          <span className="logo-icon">#</span> GitScore
        </h1>
        <p className="app-subtitle">Analyze any GitHub profile. Get a score, badges, and a roast.</p>

        <div className="view-toggle">
          <button
            className={view === 'single' ? 'active' : ''}
            onClick={() => setView('single')}
          >
            Single
          </button>
          <button
            className={view === 'compare' ? 'active' : ''}
            onClick={() => setView('compare')}
          >
            Head-to-Head
          </button>
        </div>
      </header>

      {view === 'single' ? (
        <main className="main-content">
          <SearchBar onSearch={handleSearch} loading={loading} />

          {error && <div className="error-banner">{error}</div>}

          {loading && <div className="loading">Analyzing profile...</div>}

          {analysis && !loading && (
            <div className="results">
              <ProfileCard analysis={analysis} />
              <ScoreDisplay score={analysis.score} rank={rank!} />
              <Badges badges={analysis.badges} />
              <LanguageChart languages={analysis.languages} />

              <div className="top-repos">
                <h2>Top Repositories</h2>
                <div className="repo-list">
                  {analysis.topRepos.map(repo => (
                    <a
                      key={repo.id}
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="repo-card"
                    >
                      <div className="repo-name">{repo.name}</div>
                      {repo.description && <div className="repo-desc">{repo.description}</div>}
                      <div className="repo-meta">
                        {repo.language && <span className="repo-lang">{repo.language}</span>}
                        <span>★ {repo.stargazers_count}</span>
                        <span>⑂ {repo.forks_count}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <button className="roast-btn" onClick={handleRoast}>
                {showRoast ? 'Hide Roast' : '🔥 Roast Me'}
              </button>

              {showRoast && roast && <RoastPanel roast={roast} />}
            </div>
          )}

          {!analysis && !loading && !error && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>Enter a GitHub username to analyze.</p>
              <div className="suggestions">
                <span>Try:</span>
                {['torvalds', 'gaearon', 'sindresorhus', 'w3ziqv'].map(u => (
                  <button key={u} className="suggestion-btn" onClick={() => handleSearch(u)}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      ) : (
        <CompareMode />
      )}

      <footer className="app-footer">
        <a href="https://github.com/w3ziqv/gitscore" target="_blank" rel="noopener noreferrer">
          Source on GitHub
        </a>
        <span> · Built by w3ziqv</span>
      </footer>
    </div>
  );
}
