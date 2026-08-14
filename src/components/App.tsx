import { useState, useCallback, useMemo } from 'react';
import type { ProfileAnalysis, RoastResult } from '../types.js';
import { getScoreRank } from '../lib/score.js';
import { calculateFunStats } from '../lib/funStats.js';
import SearchBar from './SearchBar.js';
import ProfileCard from './ProfileCard.js';
import ScoreDisplay from './ScoreDisplay.js';
import LanguageChart from './LanguageChart.js';
import Badges from './Badges.js';
import AchievementProgress from './AchievementProgress.js';
import Recommendations from './Recommendations.js';
import FunStats from './FunStats.js';
import ShareCard from './ShareCard.js';
import RoastPanel from './RoastPanel.js';
import CompareMode from './CompareMode.js';
import LeaderboardView from './LeaderboardView.js';
import RecentActivity from './RecentActivity.js';
import RoastOfDay from './RoastOfDay.js';
import { saveLocalLeaderboardEntry } from '../lib/localLeaderboard.js';
import { apiJson, apiErrorMessage, ApiError } from '../lib/api.js';
import './App.css';

type View = 'single' | 'compare' | 'leaderboard';

export default function App() {
  const [view, setView] = useState<View>('single');
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [roast, setRoast] = useState<RoastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRoast, setShowRoast] = useState(false);
  const [generatedAtMs, setGeneratedAtMs] = useState<number | null>(null);
  const [scoreHistory, setScoreHistory] = useState<number[] | null>(null);

  const handleSearch = useCallback(async (username: string) => {
    setLoading(true);
    setError(null);
    setShowRoast(false);
    setRoast(null);
    setScoreHistory(null);

    try {
      const data = await apiJson<ProfileAnalysis>(
        `/api/profile/${encodeURIComponent(username)}`,
        undefined,
        { unreachableHint: 'API unreachable — run `npm run dev:all`, or `vercel dev`, or push to GitHub and use the Vercel deployment.' },
      );
      setAnalysis(data);
      setGeneratedAtMs(Date.now());
      saveLocalLeaderboardEntry(data);

      // Best-effort sparkline fetch — backend no-ops gracefully if DB absent.
      try {
        const histBody = await apiJson<{ history: number[] }>(
          `/api/score-history/${encodeURIComponent(data.user.login)}?days=14`,
          undefined,
          { unreachableHint: '' },
        );
        if (Array.isArray(histBody.history) && histBody.history.length >= 2) {
          setScoreHistory(histBody.history);
        }
      } catch {
        // ignore — sparkline is optional
      }
    } catch (err) {
      setError(apiErrorMessage(err));
      setAnalysis(null);
      setGeneratedAtMs(null);
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
      const userLang = (navigator.language || 'en').split('-')[0];
      const data = await apiJson<RoastResult>(
        `/api/roast/${encodeURIComponent(analysis.user.login)}?lang=${encodeURIComponent(userLang)}`,
        undefined,
        { unreachableHint: 'API unreachable — see above.' },
      );
      setRoast(data);
      setShowRoast(true);
    } catch (err) {
      setError(err instanceof ApiError ? apiErrorMessage(err) : 'Failed to generate roast');
    }
  }, [analysis, roast]);

  const rank = analysis ? getScoreRank(analysis.score.total) : null;
  const funStats = useMemo(
    () => (analysis ? calculateFunStats(analysis.user, analysis.repos, analysis.score) : []),
    [analysis]
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="masthead-grid">
          <div className="masthead-left">
            <div className="masthead-wordmark">
              <span className="masthead-glyph" aria-hidden="true">◆</span>
              <h1 className="app-title">GITSCORE</h1>
            </div>
            <p className="masthead-sub">GitHub Profile Analysis System</p>
            <p className="app-subtitle masthead-tagline">
              Analyze any GitHub profile. Get a score, badges, and a roast.
            </p>
          </div>

          <div className="masthead-right">
            <p className="masthead-status">
              <span className="masthead-dot" aria-hidden="true" />
              <span>SYS.STATUS: ONLINE</span>
            </p>
            <p className="masthead-coords">Kraków // 50.0647N 19.9450E</p>
          </div>
        </div>

        <div className="masthead-bottom">
          <div className="header-controls">
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
              <button
                className={view === 'leaderboard' ? 'active' : ''}
                onClick={() => setView('leaderboard')}
              >
                Leaderboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {view === 'single' && (
        <main className="main-content">
          <RoastOfDay onPick={handleSearch} />

          <SearchBar onSearch={handleSearch} loading={loading} />

          {error && <div className="error-banner">{error}</div>}

          {loading && <div className="loading">Analyzing profile</div>}

          {analysis && !loading && (
            <div className="results">
              <ProfileCard analysis={analysis} />
              <ScoreDisplay
                score={analysis.score}
                rank={rank!}
                generatedAtMs={generatedAtMs ?? undefined}
                historyPoints={scoreHistory ?? undefined}
              />
              <Badges badges={analysis.badges} />
              <AchievementProgress badges={analysis.badges} user={analysis.user} repos={analysis.repos} />
              <Recommendations user={analysis.user} repos={analysis.repos} score={analysis.score} />
              <FunStats stats={funStats} />
              <LanguageChart languages={analysis.languages} />
              <ShareCard analysis={analysis} />

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

              <RecentActivity username={analysis.user.login} />

              <button className="roast-btn" onClick={handleRoast}>
                {showRoast ? 'HIDE ROAST' : 'ROAST'}
              </button>

              {showRoast && roast && <RoastPanel roast={roast} />}
            </div>
          )}

          {!analysis && !loading && !error && (
            <div className="empty-state">
              <div className="empty-mark" aria-hidden="true">
                <svg viewBox="0 0 16 16" shape-rendering="crispEdges">
                  <g fill="currentColor">
                    <rect x="2" y="2" width="9" height="2" />
                    <rect x="2" y="4" width="2" height="8" />
                    <rect x="9" y="4" width="2" height="2" />
                    <rect x="9" y="6" width="2" height="2" />
                    <rect x="11" y="6" width="2" height="2" />
                    <rect x="9" y="8" width="2" height="2" />
                    <rect x="2" y="12" width="9" height="2" />
                  </g>
                </svg>
              </div>
              <p className="empty-status">Standby // awaiting input</p>
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
      )}

      {view === 'compare' && <CompareMode />}

      {view === 'leaderboard' && <LeaderboardView onSearch={handleSearch} />}

      <footer className="app-footer">
        <a href="https://github.com/w3ziqv/gitscore" target="_blank" rel="noopener noreferrer">
          Source on GitHub
        </a>
        <span> · Built by w3ziqv</span>
      </footer>
    </div>
  );
}