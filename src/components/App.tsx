import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import ErrorBoundary from './ErrorBoundary.js';
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
import RecentActivity from './RecentActivity.js';
import RoastOfDay from './RoastOfDay.js';
import { saveLocalLeaderboardEntry } from '../lib/localLeaderboard.js';
import { apiJson, apiErrorMessage, ApiError } from '../lib/api.js';
import './App.css';

const CompareMode = lazy(() => import('./CompareMode.js'));
const LeaderboardView = lazy(() => import('./LeaderboardView.js'));

const LAST_USER_KEY = 'gitscore:lastUser';

type View = 'single' | 'compare' | 'leaderboard';

function readLastUser(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

function saveLastUser(username: string) {
  try {
    localStorage.setItem(LAST_USER_KEY, username);
  } catch {
    // ignore — persistence is best-effort
  }
}

function clearLastUser() {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // ignore — persistence is best-effort
  }
}

export default function App() {
  const [view, setView] = useState<View>('single');
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [roast, setRoast] = useState<RoastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRoast, setShowRoast] = useState(false);
  const [generatedAtMs, setGeneratedAtMs] = useState<number | null>(null);
  const [scoreHistory, setScoreHistory] = useState<number[] | null>(null);
  const [lastUsername, setLastUsername] = useState<string | null>(null);
  const [lastSavedUser, setLastSavedUser] = useState<string | null>(() =>
    readLastUser()
  );

  const handleSearch = useCallback(async (username: string) => {
    setLastUsername(username);
    setLoading(true);
    setError(null);
    setShowRoast(false);
    setRoast(null);
    setScoreHistory(null);

    // A manually searched different username invalidates the saved quick-check.
    setLastSavedUser(prev => {
      if (prev && prev.toLowerCase() !== username.trim().toLowerCase()) {
        clearLastUser();
        return null;
      }
      return prev;
    });

    try {
      const data = await apiJson<ProfileAnalysis>(
        `/api/profile/${encodeURIComponent(username)}`,
        undefined,
        { unreachableHint: 'API unreachable — run `npm run dev` (the Worker serves /api in-workerd), or check the deployment.' },
      );
      setAnalysis(data);
      setGeneratedAtMs(Date.now());
      saveLocalLeaderboardEntry(data);
      saveLastUser(data.user.login);
      setLastSavedUser(data.user.login);

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
      <a className="skip-link" href="#main">SKIP TO CONTENT</a>

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
        <main id="main" className="main-content">
          <RoastOfDay onPick={handleSearch} />

          <SearchBar onSearch={handleSearch} loading={loading} />

          <div className="status-region" aria-live="polite">
            {error && (
              <div className="error-banner">
                <span className="error-text">{error}</span>
                {lastUsername && (
                  <button
                    className="error-retry"
                    onClick={() => handleSearch(lastUsername)}
                  >
                    RETRY
                  </button>
                )}
              </div>
            )}

            {lastSavedUser && !loading && !error && !analysis && (
              <div className="last-user">
                <span className="last-user-label">LAST:</span>
                <span className="last-user-name">{lastSavedUser}</span>
                <button
                  className="last-user-btn"
                  onClick={() => handleSearch(lastSavedUser)}
                >
                  CHECK AGAIN
                </button>
              </div>
            )}

            {loading && (
              <div className="results-skeleton">
                <span className="sr-only">Analyzing profile</span>
                <div className="skeleton-hero" aria-hidden="true" />
                <div className="skeleton-row" aria-hidden="true">
                  <div className="skeleton-block" />
                  <div className="skeleton-block" />
                  <div className="skeleton-block" />
                </div>
                <div className="skeleton-lines" aria-hidden="true">
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                </div>
              </div>
            )}

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
          </div>

          {!analysis && !loading && !error && (
            <div className="empty-state">
              <div className="empty-mark" aria-hidden="true">
                <svg viewBox="0 0 16 16" shapeRendering="crispEdges">
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

      {view === 'compare' && (
        <ErrorBoundary key={view}>
          <Suspense fallback={<div className="loading">LOADING VIEW</div>}>
            <CompareMode />
          </Suspense>
        </ErrorBoundary>
      )}

      {view === 'leaderboard' && (
        <ErrorBoundary key={view}>
          <Suspense fallback={<div className="loading">LOADING VIEW</div>}>
            <LeaderboardView onSearch={handleSearch} />
          </Suspense>
        </ErrorBoundary>
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