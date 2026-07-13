import type { ScoreBreakdown } from '../types.js';

interface Props {
  score: ScoreBreakdown;
  rank: { rank: string; color: string };
}

export default function ScoreDisplay({ score, rank }: Props) {
  const maxScore = 1000;
  const percentage = (score.total / maxScore) * 100;
  const circumference = 2 * Math.PI * 70;
  const dashOffset = circumference - (percentage / 100) * circumference;

  const breakdownItems = [
    { label: 'Repos', value: score.repos, max: 200, color: '#58a6ff' },
    { label: 'Stars', value: score.stars, max: 300, color: '#f0883e' },
    { label: 'Followers', value: score.followers, max: 200, color: '#f85149' },
    { label: 'Activity', value: score.activity, max: 150, color: '#3fb950' },
    { label: 'Diversity', value: score.diversity, max: 150, color: '#a371f7' },
  ];

  return (
    <div className="score-display">
      <div className="score-circle">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="70" fill="none" stroke="#21262d" strokeWidth="8" />
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke={rank.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <div className="score-text">
          <span className="score-number" style={{ color: rank.color }}>
            {score.total}
          </span>
          <span className="score-rank" style={{ color: rank.color }}>
            Rank {rank.rank}
          </span>
        </div>
      </div>

      <div className="score-breakdown">
        <h3>Score Breakdown</h3>
        {breakdownItems.map(item => (
          <div key={item.label} className="breakdown-row">
            <span className="breakdown-label">{item.label}</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill"
                style={{
                  width: `${(item.value / item.max) * 100}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <span className="breakdown-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
