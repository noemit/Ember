import * as React from 'react';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

const SQUIGGLE_INKS = [
  { name: 'Cobalt Marker', ink: '#4263eb' },
  { name: 'Coral Marker', ink: '#f2545b' },
  { name: 'Forest Marker', ink: '#1f9d55' },
  { name: 'Violet Marker', ink: '#7c5cff' },
  { name: 'Teal Marker', ink: '#0ea5c6' },
  { name: 'Charcoal Marker', ink: '#3a3a44' },
];

const EYE_INK = '#232046';

type Variant = {
  starts: number[];
  by: number;
  h: number;
  strokeWidth: number;
  eyeDy: number;
  eyeR: number;
  smileX: number;
  smileY: number;
  tail: string;
};

// Cursive teardrop loop: right-leaning upstroke, loop over the top, then a
// left-leaning downstroke that crosses the upstroke near the baseline —
// leaving a wide open loop pocket for the nested eyes.
const loopSegment = (bx: number, by: number, h: number) => {
  const s = h / 42;
  return (
    ` C ${(bx + 3 * s).toFixed(1)} ${(by - 14 * s).toFixed(1)}, ${(bx + 9 * s).toFixed(1)} ${(by - 30 * s).toFixed(1)}, ${(bx + 11 * s).toFixed(1)} ${by - h}` +
    ` C ${(bx - 8 * s).toFixed(1)} ${(by - h + 12 * s).toFixed(1)}, ${(bx - 14 * s).toFixed(1)} ${(by - 10 * s).toFixed(1)}, ${(bx + 5 * s).toFixed(1)} ${by + 1}`
  );
};

const buildSquigglePath = (v: Variant) => {
  const { starts, by, h } = v;
  let d = `M ${starts[0]} ${by}`;
  starts.forEach((bx, i) => {
    d += loopSegment(bx, by, h);
    if (i < starts.length - 1) {
      const nx = starts[i + 1];
      d += ` C ${bx + 9} ${by + 4}, ${nx - 7} ${by + 4}, ${nx} ${by}`;
    }
  });
  d += v.tail;
  return d;
};

const SQUIGGLE_VARIANTS: Variant[] = [
  {
    starts: [18, 38, 58],
    by: 58,
    h: 44,
    strokeWidth: 5,
    eyeDy: -21,
    eyeR: 2.8,
    smileX: 30,
    smileY: 72,
    tail: ' C 68 62, 74 50, 82 52 C 88 54, 91 52, 94 46',
  },
  {
    starts: [12, 26, 40, 54],
    by: 60,
    h: 36,
    strokeWidth: 4,
    eyeDy: -17,
    eyeR: 2.3,
    smileX: 22,
    smileY: 74,
    tail: ' C 61 62, 68 52, 76 55 C 83 58, 89 54, 93 48',
  },
  {
    starts: [26, 50],
    by: 56,
    h: 48,
    strokeWidth: 5.5,
    eyeDy: -23,
    eyeR: 3.1,
    smileX: 38,
    smileY: 71,
    tail: ' C 62 60, 70 46, 80 50 C 87 53, 91 49, 95 42',
  },
];

export default function SquiggleRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const eyesRef = React.useRef<SVGGElement>(null);

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const color = SQUIGGLE_INKS[Math.floor(rng() * SQUIGGLE_INKS.length)];
  const variant = SQUIGGLE_VARIANTS[Math.floor(rng() * SQUIGGLE_VARIANTS.length)];

  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';

  const path = buildSquigglePath(variant);
  const [loop1, loop2] = variant.starts;

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el || !eyesRef.current) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 260 / dist);
      const tx = (dx / dist) * 3 * reach;
      const ty = (dy / dist) * 2.5 * reach;
      eyesRef.current.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [interactive]);

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`blob-squiggle-svg blob-state-${state}`}
      style={{ overflow: 'visible' }}
    >
      <g className="squiggle-body">
        {/* One continuous looping marker stroke */}
        <path
          d={path}
          fill="none"
          stroke={color.ink}
          strokeWidth={variant.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dot eyes nested inside the loop openings */}
        <g ref={eyesRef} className="squiggle-eyes">
          {isError ? (
            <g stroke={EYE_INK} strokeWidth="2.4" strokeLinecap="round">
              <line x1={loop1 - 3} y1={variant.by + variant.eyeDy - 3} x2={loop1 + 3} y2={variant.by + variant.eyeDy + 3} />
              <line x1={loop1 - 3} y1={variant.by + variant.eyeDy + 3} x2={loop1 + 3} y2={variant.by + variant.eyeDy - 3} />
              <line x1={loop2 - 3} y1={variant.by + variant.eyeDy - 3} x2={loop2 + 3} y2={variant.by + variant.eyeDy + 3} />
              <line x1={loop2 - 3} y1={variant.by + variant.eyeDy + 3} x2={loop2 + 3} y2={variant.by + variant.eyeDy - 3} />
            </g>
          ) : (
            <g fill={EYE_INK}>
              <circle cx={loop1} cy={variant.by + variant.eyeDy} r={isNeedsInput ? variant.eyeR * 1.15 : variant.eyeR} />
              <circle cx={loop2} cy={variant.by + variant.eyeDy} r={isNeedsInput ? variant.eyeR * 1.15 : variant.eyeR} />
              <circle cx={loop1 - 1} cy={variant.by + variant.eyeDy - 1} r={variant.eyeR * 0.3} fill="#ffffff" />
              <circle cx={loop2 - 1} cy={variant.by + variant.eyeDy - 1} r={variant.eyeR * 0.3} fill="#ffffff" />
            </g>
          )}
        </g>

        {/* Dark navy smile arc below the loops (from d7cb9e8b) */}
        {isNeedsInput ? (
          <ellipse cx={variant.smileX} cy={variant.smileY} rx="4.5" ry="5.5" fill={EYE_INK} />
        ) : isError ? (
          <path
            d={`M ${variant.smileX - 7} ${variant.smileY + 2} Q ${variant.smileX} ${variant.smileY - 4} ${variant.smileX + 7} ${variant.smileY + 2}`}
            fill="none"
            stroke={EYE_INK}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        ) : (
          <path
            d={`M ${variant.smileX - 7} ${variant.smileY} Q ${variant.smileX} ${variant.smileY + 7} ${variant.smileX + 7} ${variant.smileY}`}
            fill="none"
            stroke={EYE_INK}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        )}

        {/* Alert exclamation pop */}
        {isNeedsInput && (
          <g className="squiggle-alert" fill={EYE_INK}>
            <line x1={loop1 + 8} y1={variant.by - variant.h - 10} x2={loop1 + 8} y2={variant.by - variant.h - 2} stroke={EYE_INK} strokeWidth="3.4" strokeLinecap="round" />
            <circle cx={loop1 + 8} cy={variant.by - variant.h + 2} r="1.8" />
          </g>
        )}
      </g>
    </svg>
  );
}
