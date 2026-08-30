import * as React from 'react';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

const CRITTER_PALETTE = [
  { name: 'Matcha Green', body: '#a3e635', line: '#1a2e05', accessory: '#c084fc' },
  { name: 'Coral Pop', body: '#fb7185', line: '#4c0519', accessory: '#38bdf8' },
  { name: 'Sky Bean', body: '#38bdf8', line: '#082f49', accessory: '#f472b6' },
  { name: 'Butter Doodler', body: '#fde047', line: '#422006', accessory: '#a78bfa' },
  { name: 'Lavender Ghost', body: '#c084fc', line: '#2e1065', accessory: '#4ade80' },
  { name: 'Pure White Doodle', body: '#ffffff', line: '#18181b', accessory: '#f87171' },
];

export default function MicroCritterRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const eyeRef = React.useRef<SVGGElement>(null);

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const color = CRITTER_PALETTE[Math.floor(rng() * CRITTER_PALETTE.length)];
  const critterType = Math.floor(rng() * 4); // 0: Laptop Bean, 1: Snail Shell Bug, 2: Mushroom Cap, 3: Four-Legged Bubble

  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';
  const isActive = state === 'active';

  const breathDuration = (2.5 + ((seedHash >> 2) % 18) * 0.12).toFixed(2);
  const breathDelay = -(((seedHash >> 5) % 26) * 0.15).toFixed(2);

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el || !eyeRef.current) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 260 / dist);
      const tx = ((dx / dist) * 3.5 * reach).toFixed(2);
      const ty = ((dy / dist) * 3 * reach).toFixed(2);
      eyeRef.current.setAttribute('transform', `translate(${tx} ${ty})`);
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
      className={`blob-micro-critter-svg blob-state-${state}`}
      style={{ overflow: 'visible' }}
    >
      {/* Floor Shadow */}
      <ellipse cx="50" cy="94" rx="36" ry="4" fill="rgba(0,0,0,0.22)" />

      {/* Main Animated Critter Group */}
      <g
        className={`micro-critter-body ${isActive ? 'critter-walking' : ''}`}
        style={state === 'idle' ? { animationDuration: `${breathDuration}s`, animationDelay: `${breathDelay}s` } : undefined}
      >
        {critterType === 0 && (
          /* Laptop Bean (Direct from 99124d0d) */
          <g>
            {/* Sleeping Bean Body */}
            <path
              d="M 28 32 C 28 18, 52 14, 68 20 C 84 26, 88 50, 84 68 C 80 82, 58 86, 42 82 C 26 78, 28 46, 28 32 Z"
              fill={color.body}
              stroke={color.line}
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            {/* Little Feet */}
            <path d="M 40 82 L 40 92" stroke={color.line} strokeWidth="3.2" strokeLinecap="round" />
            <path d="M 62 80 L 62 92" stroke={color.line} strokeWidth="3.2" strokeLinecap="round" />
            {/* Tiny Laptop Accessory in front */}
            <g transform="translate(18 58)">
              <polygon points="0,16 18,16 22,22 4,22" fill={color.accessory} stroke={color.line} strokeWidth="2.4" />
              <polygon points="0,16 4,2 20,2 18,16" fill="#ffffff" stroke={color.line} strokeWidth="2.4" />
            </g>
          </g>
        )}

        {critterType === 1 && (
          /* Snail Shell Bug (Direct from 131eeba4) */
          <g>
            {/* Swirling Shell on back */}
            <path
              d="M 50 20 C 72 20, 88 36, 84 58 C 80 76, 62 82, 44 80 C 30 78, 22 66, 26 50 C 30 36, 42 34, 52 38 C 60 42, 60 52, 54 58"
              fill={color.accessory}
              stroke={color.line}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            {/* Slug/Bug Body */}
            <path
              d="M 12 70 C 12 56, 32 54, 46 60 L 82 66 C 90 68, 92 84, 82 86 L 24 86 C 14 86, 12 78, 12 70 Z"
              fill={color.body}
              stroke={color.line}
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            {/* 3 Little walking feet */}
            <path d="M 32 86 L 32 94 M 50 86 L 50 94 M 68 86 L 68 94" stroke={color.line} strokeWidth="3.2" strokeLinecap="round" />
            {/* Antennae */}
            <path d="M 22 56 Q 16 44 14 46" fill="none" stroke={color.line} strokeWidth="2.8" strokeLinecap="round" />
            <circle cx="14" cy="46" r="2.2" fill={color.line} />
          </g>
        )}

        {critterType === 2 && (
          /* Mushroom Cap Critter */
          <g>
            {/* Mushroom Cap */}
            <path
              d="M 14 50 C 14 20, 86 20, 86 50 C 86 56, 14 56, 14 50 Z"
              fill={color.accessory}
              stroke={color.line}
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            {/* White Dots on Cap */}
            <circle cx="34" cy="34" r="5" fill="#ffffff" />
            <circle cx="66" cy="36" r="4.5" fill="#ffffff" />
            <circle cx="50" cy="24" r="3.5" fill="#ffffff" />
            {/* Stem / Chubby Body */}
            <path
              d="M 32 54 L 32 78 C 32 88, 68 88, 68 78 L 68 54 Z"
              fill={color.body}
              stroke={color.line}
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            {/* Feet */}
            <path d="M 40 84 L 40 94 M 60 84 L 60 94" stroke={color.line} strokeWidth="3.2" strokeLinecap="round" />
          </g>
        )}

        {critterType === 3 && (
          /* Four-Legged Bubble Bug */
          <g>
            {/* Round Bubble Body */}
            <circle cx="50" cy="48" r="36" fill={color.body} stroke={color.line} strokeWidth="3.2" />
            {/* 4 Little Stick Legs */}
            <path d="M 30 80 L 22 92 M 42 83 L 38 94 M 58 83 L 62 94 M 70 80 L 78 92" stroke={color.line} strokeWidth="3.2" strokeLinecap="round" />
            {/* Cute Top Antenna Nub */}
            <path d="M 50 12 L 50 4" stroke={color.line} strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="50" cy="4" r="3" fill={color.accessory} stroke={color.line} strokeWidth="1.8" />
          </g>
        )}

        {/* Doodle Eyes */}
        <g ref={eyeRef} transform="translate(50 52)">
          {isError ? (
            <g stroke={color.line} strokeWidth="2.8" strokeLinecap="round">
              <line x1="-14" y1="-4" x2="-6" y2="4" />
              <line x1="-14" y1="4" x2="-6" y2="-4" />
              <line x1="6" y1="-4" x2="14" y2="4" />
              <line x1="6" y1="4" x2="14" y2="-4" />
            </g>
          ) : (
            <g>
              <circle cx="-10" cy="-2" r="3.4" fill={color.line} />
              <circle cx="10" cy="-2" r="3.4" fill={color.line} />
              <circle cx="-11" cy="-3.2" r="1.1" fill="#ffffff" />
              <circle cx="9" cy="-3.2" r="1.1" fill="#ffffff" />
            </g>
          )}

          {/* Tiny Smile */}
          {isNeedsInput ? (
            <path d="M -5 6 Q 0 14 5 6 Z" fill={color.line} />
          ) : isError ? (
            <path d="M -6 8 Q 0 3 6 8" fill="none" stroke={color.line} strokeWidth="2.4" strokeLinecap="round" />
          ) : (
            <path d="M -5 5 Q 0 10 5 5" fill="none" stroke={color.line} strokeWidth="2.4" strokeLinecap="round" />
          )}
        </g>
      </g>
    </svg>
  );
}
