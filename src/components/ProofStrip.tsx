// ProofStrip.tsx — first-visit proof of value: a real output card + methodology link.

import { useState } from 'react';
import './ProofStrip.css';

const SAMPLE_LOGIN = 'torvalds';

export default function ProofStrip() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <section className="proof" aria-label="Example GitScore output">
      <p className="proof-eyebrow">REAL OUTPUT //</p>
      <a
        className="proof-card-link"
        href={`/?u=${SAMPLE_LOGIN}`}
        aria-label={`Open example analysis for ${SAMPLE_LOGIN}`}
      >
        {imgFailed ? (
          <div className="proof-fallback" role="presentation">
            <span className="proof-fallback-score">771<span>/1000</span></span>
            <span className="proof-fallback-rank">RANK S</span>
          </div>
        ) : (
          <img
            className="proof-img"
            src={`/api/wrapped-card/${SAMPLE_LOGIN}`}
            alt={`GitScore card for ${SAMPLE_LOGIN}`}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        )}
      </a>
      <a
        className="proof-method"
        href="https://github.com/w3ziqv/gitscore#score-algorithm"
        target="_blank"
        rel="noopener noreferrer"
      >
        HOW SCORING WORKS ▸
      </a>
    </section>
  );
}
