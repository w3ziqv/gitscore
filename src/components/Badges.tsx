import type { Badge } from '../types.js';

interface Props {
  badges: Badge[];
}

export default function Badges({ badges }: Props) {
  const earned = badges.filter(b => b.earned);
  const unearned = badges.filter(b => !b.earned);

  return (
    <div className="badges-section">
      <h3>Badges ({earned.length}/{badges.length})</h3>
      <div className="badges-grid">
        {earned.map(badge => (
          <div key={badge.id} className="badge badge-earned" title={badge.description}>
            <span className="badge-emoji">{badge.emoji}</span>
            <span className="badge-name">{badge.name}</span>
          </div>
        ))}
        {unearned.map(badge => (
          <div key={badge.id} className="badge badge-locked" title={badge.description}>
            <span className="badge-emoji">🔒</span>
            <span className="badge-name">{badge.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
