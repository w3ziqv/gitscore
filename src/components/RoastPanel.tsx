import type { RoastResult } from '../types.js';

interface Props {
  roast: RoastResult;
}

export default function RoastPanel({ roast }: Props) {
  return (
    <div className="roast-panel">
      <h3>🔥 Roast</h3>
      <ul className="roast-lines">
        {roast.lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <p className="roast-overall">{roast.overall}</p>
    </div>
  );
}
