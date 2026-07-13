// FunStats.tsx — Display interesting trivia about the profile

import type { FunStat } from '../lib/funStats.js';

interface Props {
  stats: FunStat[];
}

export default function FunStats({ stats }: Props) {
  if (stats.length === 0) return null;

  return (
    <div className="fun-stats">
      <h3>Fun Stats</h3>
      <div className="fun-stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="fun-stat-item">
            <span className="fun-stat-emoji">{stat.emoji}</span>
            <div className="fun-stat-content">
              <span className="fun-stat-value">{stat.value}</span>
              <span className="fun-stat-label">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
