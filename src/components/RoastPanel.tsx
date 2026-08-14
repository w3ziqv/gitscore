import type { RoastResult } from '../types.js';
import './RoastPanel.css';

interface Props {
  roast: RoastResult;
}

export default function RoastPanel({ roast }: Props) {
  return (
    <div className="roast-panel">
      <h3 className="roast-title">
        <span className="roast-glyph" aria-hidden="true">▸</span>
        <span>ROAST //</span>
      </h3>
      <ul className="roast-lines">
        {roast.lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <p className="roast-overall">{roast.overall}</p>
    </div>
  );
}
