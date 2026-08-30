import * as React from 'react';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

const LINE_MASCOT_PALETTE = [
  { name: 'Vintage Cobalt', stroke: '#0a38b8', fill: '#fdfbf7', blush: '#ff2a6d' },
  { name: 'Crimson Red', stroke: '#d00000', fill: '#fffbf5', blush: '#ff5c8a' },
  { name: 'Forest Green', stroke: '#086745', fill: '#f4fbf7', blush: '#ff4d6d' },
  { name: 'Royal Indigo', stroke: '#3a0ca3', fill: '#faf7ff', blush: '#f72585' },
  { name: 'Warm Chocolate', stroke: '#4a2810', fill: '#fff8f0', blush: '#e63946' },
  { name: 'Charcoal Minimal', stroke: '#1a1a24', fill: '#ffffff', blush: '#ff0055' },
];

export default function LineMascotRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const faceGroupRef = React.useRef<SVGGElement>(null);

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const color = LINE_MASCOT_PALETTE[Math.floor(rng() * LINE_MASCOT_PALETTE.length)];
  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';

  const breathDuration = (2.6 + ((seedHash >> 2) % 16) * 0.12).toFixed(2);
  const breathDelay = -(((seedHash >> 6) % 24) * 0.15).toFixed(2);

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el || !faceGroupRef.current) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 260 / dist);
      const tx = ((dx / dist) * 3.5 * reach).toFixed(2);
      const ty = ((dy / dist) * 3 * reach).toFixed(2);
      faceGroupRef.current.setAttribute('transform', `translate(${tx} ${ty})`);
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
      className={`blob-line-mascot-svg blob-state-${state}`}
      style={{ overflow: 'visible' }}
    >
      {/* Floor Shadow */}
      <ellipse cx="50" cy="94" rx="34" ry="5" fill="rgba(0,0,0,0.2)" />

      {/* Main Animated Mascot Body */}
      <g
        className="line-mascot-body"
        style={state === 'idle' ? { animationDuration: `${breathDuration}s`, animationDelay: `${breathDelay}s` } : undefined}
      >
        {/* Onion-Head Sprout Mascot Contour (Direct from 77e9cab4) */}
        <path
          d="M 50 8 C 53 14, 52 20, 50 26 C 68 28, 88 42, 88 64 C 88 84, 70 94, 50 94 C 30 94, 12 84, 12 64 C 12 42, 32 28, 50 26 C 48 20, 47 14, 50 8 Z"
          fill={color.fill}
          stroke={color.stroke}
          strokeWidth="3.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Top Hair Sprout Strands */}
        <path d="M 47 16 Q 50 11 48 8" fill="none" stroke={color.stroke} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M 53 17 Q 52 12 55 9" fill="none" stroke={color.stroke} strokeWidth="2.2" strokeLinecap="round" />

        {/* Expressive Face Elements */}
        <g ref={faceGroupRef} transform="translate(50 56)">
          {/* Cute Arched Eyebrows */}
          <path d="M -18 -15 Q -13 -20 -8 -15" fill="none" stroke={color.stroke} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M 8 -15 Q 13 -20 18 -15" fill="none" stroke={color.stroke} strokeWidth="2.6" strokeLinecap="round" />

          {isError ? (
            <g stroke={color.stroke} strokeWidth="3" strokeLinecap="round">
              <line x1="-16" y1="-7" x2="-8" y2="1" />
              <line x1="-16" y1="1" x2="-8" y2="-7" />
              <line x1="8" y1="-7" x2="16" y2="1" />
              <line x1="8" y1="1" x2="16" y2="-7" />
            </g>
          ) : (
            <g>
              {/* Left Eye & Cute Kewpie Eyelashes */}
              <circle cx="-12" cy="-4" r="4.2" fill={color.stroke} />
              <line x1="-17" y1="-8" x2="-14" y2="-5" stroke={color.stroke} strokeWidth="2.4" strokeLinecap="round" />
              <line x1="-17" y1="-4" x2="-14" y2="-3" stroke={color.stroke} strokeWidth="2.4" strokeLinecap="round" />
              <line x1="-15" y1="0" x2="-13" y2="-1" stroke={color.stroke} strokeWidth="2.4" strokeLinecap="round" />

              {/* Right Eye & Cute Kewpie Eyelashes */}
              <circle cx="12" cy="-4" r="4.2" fill={color.stroke} />
              <line x1="17" y1="-8" x2="14" y2="-5" stroke={color.stroke} strokeWidth="2.4" strokeLinecap="round" />
              <line x1="17" y1="-4" x2="14" y2="-3" stroke={color.stroke} strokeWidth="2.4" strokeLinecap="round" />
              <line x1="15" y1="0" x2="13" y2="-1" stroke={color.stroke} strokeWidth="2.4" strokeLinecap="round" />
            </g>
          )}

          {/* Tiny Button Nose */}
          <path d="M -2 2 Q 0 0 2 2" fill="none" stroke={color.stroke} strokeWidth="2.2" strokeLinecap="round" />

          {/* Vintage Diagonal Blush Ticks (Direct from 77e9cab4) */}
          <g stroke={color.blush} strokeWidth="2.2" strokeLinecap="round">
            <line x1="-24" y1="2" x2="-20" y2="8" />
            <line x1="-20" y1="2" x2="-16" y2="8" />
            <line x1="-16" y1="2" x2="-12" y2="8" />

            <line x1="12" y1="2" x2="16" y2="8" />
            <line x1="16" y1="2" x2="20" y2="8" />
            <line x1="20" y1="2" x2="24" y2="8" />
          </g>

          {/* Smile / Mouth */}
          {isNeedsInput ? (
            <path d="M -5 6 Q 0 16 5 6 Z" fill={color.stroke} />
          ) : isError ? (
            <path d="M -7 11 Q 0 5 7 11" fill="none" stroke={color.stroke} strokeWidth="2.8" strokeLinecap="round" />
          ) : (
            <path d="M -6 6 Q 0 12 6 6" fill="none" stroke={color.stroke} strokeWidth="2.8" strokeLinecap="round" />
          )}
        </g>
      </g>
    </svg>
  );
}
