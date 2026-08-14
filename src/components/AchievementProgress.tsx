// AchievementProgress.tsx — Progress bars for unearned badges

import type { Badge, GitHubUser, GitHubRepo } from '../types.js';
import { calculateTotalStars, extractLanguages } from '../lib/score.js';
import './AchievementProgress.css';

interface Props {
  badges: Badge[];
  user: GitHubUser;
  repos: GitHubRepo[];
}

function getBadgeProgress(badge: Badge, user: GitHubUser, repos: GitHubRepo[]): { current: number; target: number } {
  const totalStars = calculateTotalStars(repos);
  const languages = extractLanguages(repos);
  const accountAgeDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));

  switch (badge.id) {
    case 'polyglot':
      return { current: languages.length, target: 5 };
    case 'rising-star':
      return { current: totalStars, target: 10 };
    case 'social-butterfly':
      return { current: user.followers, target: 50 };
    case 'open-sourcerer':
      return { current: user.public_repos, target: 20 };
    case 'veteran':
      return { current: Math.floor(accountAgeDays / 365), target: 3 };
    case 'newcomer':
      return { current: 365 - accountAgeDays, target: 365 };
    default:
      return { current: 0, target: 1 };
  }
}

export default function AchievementProgress({ badges, user, repos }: Props) {
  const unearned = badges.filter(b => !b.earned);

  if (unearned.length === 0) {
    return (
      <div className="achievement-progress">
        <p className="progress-eyebrow">ACHIEVEMENTS //</p>
        <p className="all-earned">▸ ALL BADGES EARNED</p>
      </div>
    );
  }

  return (
    <div className="achievement-progress">
      <p className="progress-eyebrow">ACHIEVEMENTS //</p>
      <div className="progress-list">
        {unearned.map(badge => {
          const { current, target } = getBadgeProgress(badge, user, repos);
          const pct = Math.min(100, Math.round((current / target) * 100));

          return (
            <div key={badge.id} className="progress-row">
              <div className="progress-header">
                <span className="progress-glyph">{badge.glyph}</span>
                <span className="progress-name">{badge.name}</span>
                <span className="progress-numbers">{current} / {target}</span>
              </div>
              <p className="progress-description">{badge.description}</p>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="progress-pct">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
