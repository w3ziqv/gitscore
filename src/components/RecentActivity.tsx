// RecentActivity.tsx — Last ~30 GitHub events for a user

import { useEffect, useState } from 'react';
import type { RecentActivityItem, RecentActivityType } from '../types.js';
import './RecentActivity.css';

interface Props {
  username: string;
}

const TYPE_ICON: Record<RecentActivityType, string> = {
  PullRequestEvent: '⇄',
  PushEvent: '⬆',
  IssuesEvent: '●',
  CreateEvent: '+',
  WatchEvent: '★',
  Other: '•',
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export default function RecentActivity({ username }: Props) {
  const [items, setItems] = useState<RecentActivityItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);
    setItems(null);

    fetch(`/api/activity/${encodeURIComponent(username)}`)
      .then(res => {
        if (!res.ok) throw new Error('activity fetch failed');
        return res.json() as Promise<{ items: RecentActivityItem[]; totalInRange: number }>;
      })
      .then(data => {
        if (!cancelled) setItems(data.items);
      })
      .catch(() => {
        if (!cancelled) setItems(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [username]);

  if (loading) {
    return (
      <div className="recent-activity">
        <div className="ra-panel">
          <p className="ra-eyebrow">Activity //</p>
          <p className="ra-loading">Loading recent activity…</p>
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="recent-activity">
        <div className="ra-panel">
          <p className="ra-eyebrow">Activity //</p>
          <p className="ra-empty">No recent activity.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="recent-activity">
      <div className="ra-panel">
        <p className="ra-eyebrow">Activity //</p>
        <ul className="ra-list">
          {items.map((item, i) => (
            <li key={i} className="ra-item">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ra-link"
              >
                <span className="ra-icon" data-type={item.type}>
                  {TYPE_ICON[item.type]}
                </span>
                <span className="ra-body">
                  <span className="ra-repo">{item.repo}</span>
                  <span className="ra-summary">{item.summary}</span>
                </span>
                <time className="ra-time" dateTime={item.createdAtIso}>
                  {formatTime(item.createdAtIso)}
                </time>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
