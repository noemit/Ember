import * as React from 'react';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

// Glowing pastel gradient palettes (look inspired by habit's aura loaders:
// soft radial gradients fading to transparent, warm pink → lavender → sky)
const AGENTIC_PALETTES = [
  { name: 'Dream Haze', inner: '#ffe3f4', mid: '#c7b9ec', outer: '#74cbe8', ink: '#7a5fb8', red: '#ef4444' },
  { name: 'Aurora Veil', inner: '#d9fff2', mid: '#7ce3d0', outer: '#7aa8ff', ink: '#3f7fb8', red: '#f43f5e' },
  { name: 'Sunset Smoke', inner: '#ffe9d6', mid: '#ffb0b7', outer: '#c78ae8', ink: '#b85f9a', red: '#dc2626' },
  { name: 'Lily Glow', inner: '#fff3d6', mid: '#f4b3a8', outer: '#9ebce7', ink: '#b06a78', red: '#e11d48' },
  { name: 'Prism Fog', inner: '#e8fbff', mid: '#a5d8ff', outer: '#c7b9ec', ink: '#5f7fd9', red: '#e11d48' },
  { name: 'Meadow Mist', inner: '#f4ffe0', mid: '#b5e8a5', outer: '#74dbe8', ink: '#4fa87f', red: '#ef4444' },
];

// Smooth closed amorphous blob: seeded radius jitter around a circle,
// converted through a closed Catmull-Rom → bezier pass.
const blobPath = (rng: () => number, points: number, baseR: number, jitter: number) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 * i) / points - Math.PI / 2;
    const r = baseR + (rng() - 0.5) * 2 * jitter;
    pts.push([50 + Math.cos(angle) * r, 50 + Math.sin(angle) * r * 0.94]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + ' Z';
};

// Working doodles: curls, circles, spirals & loops that sketch themselves in
const DOODLE_GLYPHS = [
  'M -6 2 C -6 -4, 4 -4, 4 1 C 4 4.5, -2 4.5, -2 1.5', // curl
  'M 6 0 A 6 6 0 1 1 5.9 -0.5', // circle
  'M 0 0 C 0 -4, 6 -4, 6 0 C 6 5, -5 5, -5 0 C -5 -7, 9 -7, 9 0', // spiral
  'M 0 0 C 4 -6, 9 -2, 5 2 C 1 6, -4 0, 1 -5 C 4 -8, 8 -6, 9 -3', // loop-de-loop
  'M -8 1 Q -4 -4, 0 1 Q 4 6, 8 1', // wave
  'M -3 -5 L 0 0 L -4 3 L 1 5 L -1 9', // loose zigzag
];

// Angry messy scratch marks (needs-input)
const ANGER_MARKS = [
  'M -30 -16 L -21 -25 L -17 -13 L -7 -22',
  'M 8 -28 L 16 -18 L 6 -16 L 14 -6',
  'M -14 26 L -5 18 L 3 27',
  'M 20 14 L 30 6 L 24 20',
];

export default function AgenticGradientRenderer({ seed, size, state }: Props) {
  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const palette = AGENTIC_PALETTES[Math.floor(rng() * AGENTIC_PALETTES.length)];
  const blob = blobPath(rng, 9, 32, 7);

  // Seeded doodle selection & placement around the poof
  const doodlePool = [...DOODLE_GLYPHS];
  const doodles: { d: string; x: number; y: number; delay: number; dur: number }[] = [];
  const doodleCount = 4;
  for (let i = 0; i < doodleCount; i++) {
    const pick = Math.floor(rng() * doodlePool.length);
    const d = doodlePool.splice(pick, 1)[0];
    const angle = (Math.PI * 2 * i) / doodleCount + rng() * 1.2;
    const radius = 24 + rng() * 14;
    doodles.push({
      d,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius * 0.9,
      delay: -(rng() * 2).toFixed(2),
      dur: Number((1.1 + rng() * 0.9).toFixed(2)),
    });
  }

  // Seeded angry scratches
  const angerPool = [...ANGER_MARKS];
  const angerMarks: { d: string; rot: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const pick = Math.floor(rng() * angerPool.length);
    angerMarks.push({ d: angerPool.splice(pick, 1)[0], rot: Math.floor(rng() * 360) });
  }

  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';

  const uid = `agentic-${seedHash.toString(36)}`;
  const ids = {
    gradOuter: `${uid}-grad-outer`,
    gradMain: `${uid}-grad-main`,
    gradCore: `${uid}-grad-core`,
    gradRed: `${uid}-grad-red`,
    blurHalo: `${uid}-blur-halo`,
    blurSoft: `${uid}-blur-soft`,
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`blob-agentic-svg blob-state-${state}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={ids.gradOuter}>
          <stop offset="0%" stopColor={palette.mid} stopOpacity="0.5" />
          <stop offset="65%" stopColor={palette.outer} stopOpacity="0.3" />
          <stop offset="100%" stopColor={palette.outer} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.gradMain}>
          <stop offset="0%" stopColor={palette.inner} stopOpacity="0.95" />
          <stop offset="55%" stopColor={palette.mid} stopOpacity="0.78" />
          <stop offset="100%" stopColor={palette.outer} stopOpacity="0.12" />
        </radialGradient>
        <radialGradient id={ids.gradCore}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.inner} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.gradRed}>
          <stop offset="0%" stopColor="#ff9b9b" stopOpacity="0.95" />
          <stop offset="45%" stopColor={palette.red} stopOpacity="0.85" />
          <stop offset="100%" stopColor="#991b1b" stopOpacity="0.15" />
        </radialGradient>
        <filter id={ids.blurHalo} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        <filter id={ids.blurSoft} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>

      <g className="agentic-float">
        {/* Outer glow halo */}
        <path className="agentic-halo" d={blob} fill={`url(#${ids.gradOuter})`} filter={`url(#${ids.blurHalo})`} />

        {/* Main amorphous gradient body */}
        <path className="agentic-body" d={blob} fill={`url(#${ids.gradMain})`} filter={`url(#${ids.blurSoft})`} />

        {/* Bright drifting core */}
        <g className="agentic-core">
          <path d={blob} fill={`url(#${ids.gradCore})`} transform="translate(50 50) scale(0.55) translate(-50 -50)" />
        </g>

        {/* Working doodles: curls, circles & loops sketching around the poof */}
        {state === 'active' && (
          <g className="agentic-doodles">
            {doodles.map((doodle, i) => (
              <path
                key={i}
                className="agentic-doodle"
                d={doodle.d}
                pathLength={1}
                transform={`translate(${doodle.x.toFixed(1)} ${doodle.y.toFixed(1)})`}
                fill="none"
                stroke={palette.ink}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animationDelay: `${doodle.delay}s`,
                  animationDuration: `${doodle.dur}s`,
                  opacity: 0.85,
                }}
              />
            ))}
          </g>
        )}

        {/* Angry messy scratches when the agent demands input */}
        {isNeedsInput && (
          <g className="agentic-anger" stroke={palette.ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {angerMarks.map((mark, i) => (
              <path key={i} d={mark.d} transform={`rotate(${mark.rot} 50 50)`} />
            ))}
          </g>
        )}

        {/* Error: the whole gradient transitions to red and back over 2s each way */}
        {isError && <path className="agentic-red" d={blob} fill={`url(#${ids.gradRed})`} filter={`url(#${ids.blurSoft})`} />}
      </g>
    </svg>
  );
}
