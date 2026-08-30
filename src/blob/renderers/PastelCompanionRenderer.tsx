import * as React from 'react';
import { PASTEL_PALETTE } from '../palette';
import { PASTEL_SHAPES } from '../shapes';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

export default function PastelCompanionRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const faceRef = React.useRef<SVGGElement>(null);
  const companionRef = React.useRef<SVGGElement>(null);

  const uid = React.useId().replace(/[:]/g, '');
  const bodyGradId = `pas-body-${uid}`;
  const compGradId = `pas-comp-${uid}`;

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const shapeIndex = Math.floor(rng() * PASTEL_SHAPES.length);
  const colorIndex = Math.floor(rng() * PASTEL_PALETTE.length);

  const shape = PASTEL_SHAPES[shapeIndex];
  const color = PASTEL_PALETTE[colorIndex];
  const isError = state === 'error';

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 280 / dist);
      const tx = ((dx / dist) * 3.5 * reach).toFixed(2);
      const ty = ((dy / dist) * 2.8 * reach).toFixed(2);
      if (faceRef.current) faceRef.current.setAttribute('transform', `translate(${tx} ${ty})`);
      // Parallax float for the companion
      const cx = ((dx / dist) * 6 * reach).toFixed(2);
      const cy = ((dy / dist) * 5 * reach).toFixed(2);
      if (companionRef.current) companionRef.current.setAttribute('transform', `translate(${cx} ${cy})`);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [interactive]);

  const faceY = shape.faceY;

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="blob-pastel-svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Main Body Soft Pastel Gradient */}
        <linearGradient id={bodyGradId} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor={color.light} />
          <stop offset="60%" stopColor={color.base} />
          <stop offset="100%" stopColor={color.dark} />
        </linearGradient>

        {/* Mini Companion Gradient */}
        <linearGradient id={compGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffb3d1" />
          <stop offset="100%" stopColor={color.secondary ?? '#f783ac'} />
        </linearGradient>
      </defs>

      {/* Ambient shadow */}
      <ellipse cx="44" cy="94" rx="32" ry="5" fill="rgba(0,0,0,0.22)" />

      {/* Main Character Body (slightly shifted left to leave room for companion) */}
      <g transform="translate(-4 4) scale(0.92)">
        <path
          d={shape.path}
          fill={`url(#${bodyGradId})`}
          stroke={color.edge}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Soft highlight arc */}
        <path
          d={shape.path}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeOpacity="0.35"
          transform="translate(1, 1) scale(0.96)"
        />

        {/* Sweet Minimalist Face */}
        <g ref={faceRef} transform={`translate(50 ${faceY})`}>
          {isError ? (
            <g stroke="#1a1824" strokeWidth="2.5" strokeLinecap="round">
              <line x1="-14" y1="-3" x2="-6" y2="3" />
              <line x1="-14" y1="3" x2="-6" y2="-3" />
              <line x1="6" y1="-3" x2="14" y2="3" />
              <line x1="6" y1="3" x2="14" y2="-3" />
              <path d="M -6 10 Q 0 4 6 10" fill="none" strokeWidth="2.5" />
            </g>
          ) : (
            <g>
              {/* Dot Eyes */}
              <circle cx="-10" cy="-4" r="3.2" fill="#1b1c2b" />
              <circle cx="10" cy="-4" r="3.2" fill="#1b1c2b" />
              {/* Tiny Smile */}
              <path
                d="M -6 4 Q 0 11 6 4"
                fill="none"
                stroke="#1b1c2b"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              {/* Sweet Blush Cheeks */}
              <circle cx="-18" cy="2" r="3" fill="#ff4d88" opacity="0.32" />
              <circle cx="18" cy="2" r="3" fill="#ff4d88" opacity="0.32" />
            </g>
          )}
        </g>
      </g>

      {/* Floating Mini Pal & Particles */}
      <g ref={companionRef} className="pastel-companion-group">
        {/* Floating Mini Companion Friend */}
        <g transform="translate(74 18)">
          <rect
            x="-10"
            y="-10"
            width="20"
            height="20"
            rx="6"
            fill={`url(#${compGradId})`}
            stroke="rgba(0,0,0,0.15)"
            strokeWidth="0.8"
          />
          {/* Mini Pal Face */}
          {isError ? (
            <g stroke="#1a1824" strokeWidth="1.5" strokeLinecap="round">
              <line x1="-5" y1="-2" x2="-1" y2="2" />
              <line x1="1" y1="-2" x2="5" y2="2" />
            </g>
          ) : (
            <g>
              <circle cx="-3.5" cy="-1.5" r="1.5" fill="#1b1c2b" />
              <circle cx="3.5" cy="-1.5" r="1.5" fill="#1b1c2b" />
              <path d="M -2 3 Q 0 5 2 3" fill="none" stroke="#1b1c2b" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          )}
        </g>

        {/* Orbiting Mini Sparkle Bits / Fairy Dust */}
        <rect
          x="88"
          y="4"
          width="5"
          height="5"
          rx="1.5"
          fill={color.secondary ?? '#f783ac'}
          opacity="0.85"
        />
        <rect
          x="58"
          y="2"
          width="4.5"
          height="4.5"
          rx="1.2"
          fill="#ffd166"
          opacity="0.9"
        />
      </g>
    </svg>
  );
}
