// WrappedStory.tsx — GitScore Wrapped: full-screen story viewer (rolling 365 days).
// IG-style segmented progress, auto-advance, count-ups, final share card.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScoreRank, WrappedReport } from '../types.js';
import { getScoreRank } from '../lib/score.js';
import { apiJson, apiErrorMessage } from '../lib/api.js';
import './WrappedStory.css';

interface Props {
  initialUsername?: string | null;
  onClose: () => void;
}

const SLIDE_COUNT = 7;
const SLIDE_MS = 4500;
const ANIM_MS = 900;
const USERNAME_RE = /^[a-z0-9_-]{1,39}$/i;

// Canvas cannot read CSS vars — literal mirrors of DESIGN.md §1 rank stripes.
const RANK_HEX: Record<ScoreRank, string> = {
  'S+': '#f85149',
  'S': '#f0883e',
  'A': '#ffa657',
  'B': '#d29922',
  'C': '#a5d6ff',
  'D': '#7d8590',
  'F': '#484f58',
};

const SLIDE_TITLES = ['Intro', 'Commits', 'Identity', 'Stars', 'Languages', 'Rank reveal', 'Share'];

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function CountUp({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(() => (prefersReducedMotion() ? value : 0));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayed(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / ANIM_MS, 1);
      setDisplayed(Math.round(value * easeOutCubic(t)));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <span className="ws-count">{fmt(displayed)}</span>;
}

export default function WrappedStory({ initialUsername, onClose }: Props) {
  const [usernameInput, setUsernameInput] = useState(initialUsername ?? '');
  const [report, setReport] = useState<WrappedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const loadReport = useCallback(async (login: string) => {
    setLoading(true);
    setError(null);
    try {
      const body = await apiJson<{ report: WrappedReport }>(
        `/api/wrapped/${encodeURIComponent(login)}`,
        undefined,
        { unreachableHint: 'API unreachable — run `npm run dev` (the Worker serves /api in-workerd), or check the deployment.' },
      );
      setReport(body.report);
      setSlideIndex(0);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUsername && USERNAME_RE.test(initialUsername)) void loadReport(initialUsername);
  }, [initialUsername, loadReport]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const goNext = useCallback(() => {
    setSlideIndex(i => Math.min(i + 1, SLIDE_COUNT - 1));
  }, []);

  const goPrev = useCallback(() => {
    setSlideIndex(i => Math.max(i - 1, 0));
  }, []);

  const hasStory = report !== null;

  useEffect(() => {
    if (!hasStory || prefersReducedMotion() || paused) return;
    if (slideIndex >= SLIDE_COUNT - 1) return;
    const t = window.setTimeout(() => setSlideIndex(i => Math.min(i + 1, SLIDE_COUNT - 1)), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [hasStory, paused, slideIndex]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const login = usernameInput.trim();
    if (!USERNAME_RE.test(login)) {
      setError('Enter a valid GitHub username (letters, digits, - or _).');
      return;
    }
    void loadReport(login);
  }, [usernameInput, loadReport]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (hasStory && e.key === 'ArrowRight') {
      goNext();
      return;
    }
    if (hasStory && e.key === 'ArrowLeft') {
      goPrev();
      return;
    }
    if (e.key === 'Tab') {
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [hasStory, goNext, goPrev, onClose]);

  const identity = useMemo(() => {
    if (!report) return null;
    const total = report.prsOpened + report.reviewsGiven;
    const ratio = total === 0 ? 0.5 : report.prsOpened / total;
    const tag = ratio > 0.65 ? 'BUILDER' : ratio < 0.35 ? 'REVIEWER' : 'BALANCED';
    return { ratio, tag };
  }, [report]);

  const verdictLine = useMemo(() => {
    if (!report) return '';
    if (report.aiVerdict) return report.aiVerdict;
    return `${fmt(report.commits)} commits, ${fmt(report.prsOpened)} PRs and ${fmt(report.reviewsGiven)} reviews in one year — ${fmt(report.starsNowTotal)} stars watched it happen.`;
  }, [report]);

  const rank = useMemo(
    () => (report ? getScoreRank(report.score) : null),
    [report],
  );

  const drawCard = useCallback(() => {
    if (!report || !rank) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1200;
    const H = 630;
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = RANK_HEX[rank.rank];
    ctx.fillRect(0, 0, 8, H);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#8f8f9b';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.fillText('GITSCORE WRAPPED // LAST 365 DAYS', 60, 80);

    ctx.fillStyle = '#f0f0fa';
    ctx.font = '700 56px Inter, sans-serif';
    ctx.fillText(report.name ? `${report.name} @${report.login}` : report.login, 60, 160);

    const stats: Array<[string, string]> = [
      ['COMMITS', fmt(report.commits)],
      ['PULL REQUESTS', fmt(report.prsOpened)],
      ['STARS', fmt(report.starsNowTotal)],
    ];
    stats.forEach(([label, value], i) => {
      const x = 60 + i * 360;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x, 240, 300, 1);
      ctx.fillStyle = '#f0f0fa';
      ctx.font = '700 52px "JetBrains Mono", monospace';
      ctx.fillText(value, x, 320);
      ctx.fillStyle = '#8f8f9b';
      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.fillText(label, x, 352);
    });

    ctx.fillStyle = RANK_HEX[rank.rank];
    ctx.font = '700 120px Inter, sans-serif';
    ctx.fillText(rank.rank, 60, 540);

    ctx.fillStyle = '#9d9d9d';
    ctx.font = '700 28px "JetBrains Mono", monospace';
    ctx.fillText(`SCORE ${fmt(report.score)}/1000`, 220, 500);

    ctx.fillStyle = '#8f8f9b';
    ctx.font = '400 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('gitscore.mateusz-szostak1.workers.dev', W - 60, H - 40);
    ctx.textAlign = 'left';
  }, [report, rank]);

  const handleDownload = useCallback(() => {
    drawCard();
    const canvas = canvasRef.current;
    const link = linkRef.current;
    if (!canvas || !link || !report) return;
    link.href = canvas.toDataURL('image/png');
    link.download = `gitscore-wrapped-${report.login}.png`;
    link.click();
  }, [drawCard, report]);

  const handleCopyLink = useCallback(async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?wrapped=${report.login}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, [report]);

  const midSlide = hasStory && slideIndex > 0 && slideIndex < SLIDE_COUNT - 1;

  return (
    <div
      className={`ws-overlay${paused ? ' ws-paused' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="GitScore Wrapped"
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button className="ws-close" onClick={onClose} aria-label="Close Wrapped">
        ×
      </button>

      {hasStory && (
        <div className="ws-progress" role="presentation">
          {SLIDE_TITLES.map((title, i) => (
            <div key={title} className={`ws-seg${i <= slideIndex ? ' done' : ''}${i === slideIndex ? ' active' : ''}`}>
              <div className="ws-seg-fill" />
              <span className="sr-only">{title}</span>
            </div>
          ))}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {hasStory ? `Slide ${slideIndex + 1}: ${SLIDE_TITLES[slideIndex]}` : 'Wrapped loading'}
      </p>

      <div className="ws-slide">
        {!hasStory && !loading && (
          <form className="ws-form" onSubmit={handleSubmit}>
            <p className="ws-eyebrow">GITSCORE WRAPPED //</p>
            <h2 className="ws-headline">YOUR YEAR IN CODE</h2>
            <p className="ws-sub">Last 365 days of commits, PRs, reviews and stars.</p>
            <input
              className="ws-input"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              placeholder="github username"
              autoComplete="off"
              spellCheck={false}
              aria-label="GitHub username"
            />
            {error && <p className="ws-error">{error}</p>}
            <button type="submit" className="ws-btn" disabled={loading}>
              OPEN STORY ▸
            </button>
          </form>
        )}

        {loading && (
          <div className="ws-loading">
            <p className="ws-eyebrow">WRAPPED //</p>
            <div className="ws-skeleton-line" aria-hidden="true" />
            <div className="ws-skeleton-block" aria-hidden="true" />
            <p className="ws-status">Aggregating the last 365 days…</p>
          </div>
        )}

        {hasStory && report && (
          <>
            {slideIndex === 0 && (
              <div className="ws-center">
                <img className="ws-avatar" src={report.avatarUrl} alt="" />
                <p className="ws-eyebrow">GITSCORE WRAPPED // LAST 365 DAYS</p>
                <h2 className="ws-login">{report.name ? `${report.name}` : `@${report.login}`}</h2>
                {report.name && <p className="ws-sub">@{report.login}</p>}
              </div>
            )}

            {slideIndex === 1 && (
              <div className="ws-center">
                <p className="ws-eyebrow">YOU SHIPPED</p>
                <span className="ws-big-num"><CountUp value={report.commits} /></span>
                <p className="ws-caption">COMMITS IN 365 DAYS{report.partial ? ' *' : ''}</p>
              </div>
            )}

            {slideIndex === 2 && identity && (
              <div className="ws-center">
                <p className="ws-eyebrow">YOUR IDENTITY</p>
                <span className="ws-tagline">{identity.tag}</span>
                <div className="ws-stat-row">
                  <div className="ws-cell">
                    <span className="ws-cell-value"><CountUp value={report.prsOpened} /></span>
                    <span className="ws-cell-label">PRS OPENED</span>
                  </div>
                  <div className="ws-cell">
                    <span className="ws-cell-value"><CountUp value={report.reviewsGiven} /></span>
                    <span className="ws-cell-label">REVIEWS GIVEN</span>
                  </div>
                </div>
              </div>
            )}

            {slideIndex === 3 && (
              <div className="ws-center">
                <p className="ws-eyebrow">STARS WATCHED IT HAPPEN</p>
                <span className="ws-big-num"><CountUp value={report.starsNowTotal} /></span>
                {report.topRepos.length > 0 && (
                  <p className="ws-caption">TOP REPO // {report.topRepos[0].name} ({fmt(report.topRepos[0].stars)})</p>
                )}
              </div>
            )}

            {slideIndex === 4 && (
              <div className="ws-center">
                <p className="ws-eyebrow">LANGUAGE DNA</p>
                {report.topLanguages.length > 0 ? (
                  <>
                    <div className="ws-lang-bar" role="presentation">
                      {report.topLanguages.map((lang, i) => (
                        <div
                          key={lang}
                          className={`ws-lang-seg${i % 2 === 0 ? ' strong' : ''}`}
                          style={{ flexGrow: 1 }}
                        >
                          <span className="sr-only">{lang}</span>
                        </div>
                      ))}
                    </div>
                    <div className="ws-legend">
                      {report.topLanguages.map((lang, i) => (
                        <span key={lang} className="ws-legend-item">
                          <span className={`ws-legend-chip${i % 2 === 0 ? ' strong' : ''}`} aria-hidden="true" />
                          {lang.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="ws-sub">No recent repo languages detected.</p>
                )}
              </div>
            )}

            {slideIndex === 5 && rank && (
              <div className="ws-center">
                <p className="ws-eyebrow">THE VERDICT OF THE MACHINE</p>
                <span className="ws-rank-letter" style={{ color: rank.color }}>{rank.rank}</span>
                <span className="ws-big-num"><CountUp value={report.score} /></span>
                <p className="ws-caption">OUT OF 1000</p>
              </div>
            )}

            {slideIndex === 6 && (
              <div className="ws-center">
                <p className="ws-eyebrow">CLOSING LINE //</p>
                <p className="ws-verdict">{verdictLine}</p>
                <div className="ws-actions">
                  <button className="ws-btn" onClick={handleDownload}>DOWNLOAD CARD</button>
                  <button className={`ws-btn ghost${copied ? ' copied' : ''}`} onClick={() => void handleCopyLink()}>
                    {copied ? 'LINK COPIED ◆' : 'COPY LINK'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {midSlide && (
        <>
          <button className="ws-zone left" onClick={goPrev} aria-label="Previous slide" tabIndex={-1} />
          <button className="ws-zone right" onClick={goNext} aria-label="Next slide" tabIndex={-1} />
        </>
      )}

      {hasStory && slideIndex === 0 && (
        <button className="ws-zone right" onClick={goNext} aria-label="Start story" tabIndex={-1} />
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />
      <a ref={linkRef} style={{ display: 'none' }} aria-hidden="true" />
    </div>
  );
}
