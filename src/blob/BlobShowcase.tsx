import * as React from 'react';
import GemBlob from './GemBlob';
import type { BallState } from '../types';

const SAMPLE_WORDS = [
  'amber', 'ocean', 'quiet', 'pixel', 'storm', 'lunar', 'coral', 'birch', 'violet', 'onyx',
  'drift', 'maple', 'cobalt', 'pearl', 'raven', 'solar', 'mint', 'obsidian', 'cinder', 'willow',
  'azure', 'quartz', 'thorn', 'frost', 'sable', 'jade', 'saffron', 'nocturne', 'garnet', 'topaz',
];

const STATES: BallState[] = ['idle', 'active', 'needs-input', 'error'];

const randomSeed = (): string => {
  const first = SAMPLE_WORDS[Math.floor(Math.random() * SAMPLE_WORDS.length)];
  const second = SAMPLE_WORDS[Math.floor(Math.random() * SAMPLE_WORDS.length)];
  return `${first} ${second}`;
};

type Props = {
  onClose: () => void;
};

export default function BlobShowcase({ onClose }: Props) {
  const [seeds, setSeeds] = React.useState<string[]>(() => Array.from({ length: 30 }, randomSeed));
  const [showStates, setShowStates] = React.useState(false);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="showcase" onClick={(event) => event.stopPropagation()}>
        <div className="showcase-head">
          <h2>Blob showcase</h2>
          <button className="icon-button" onClick={() => setSeeds(Array.from({ length: 30 }, randomSeed))}>
            Shuffle
          </button>
          <button
            className="icon-button"
            onClick={() => setShowStates((prev) => !prev)}
          >
            {showStates ? 'Hide states' : 'Show active state'}
          </button>
          <button className="icon-button" onClick={onClose}>
            Close
          </button>
        </div>

        {showStates ? (
          <div className="showcase-grid">
            {STATES.map((state) => (
              <div className="showcase-cell" key={state} style={{ gridColumn: 'span 1' }}>
                <GemBlob seed="demo" size={64} state={state} interactive={false} />
                <span className="showcase-seed">{state}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="showcase-grid">
            {seeds.map((seed, index) => (
              <div className="showcase-cell" key={index}>
                <GemBlob seed={seed} size={64} state="idle" interactive={false} />
                <span className="showcase-seed">{seed}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
