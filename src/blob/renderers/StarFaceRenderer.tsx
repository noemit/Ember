import * as React from 'react';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

const STAR_YELLOWS = [
  { name: 'Classic Lemon', fill: '#f7e04b' },
  { name: 'Butter Pop', fill: '#ffe14d' },
  { name: 'Golden Hour', fill: '#f5cf2d' },
  { name: 'Honey Glow', fill: '#f9d949' },
  { name: 'Sunshine', fill: '#ffd93d' },
  { name: 'Chartreuse', fill: '#e8e337' },
];

const FACE_INK = '#1f1f1f';
const BLUSH = '#ff9eb5';

const FACE_X = 50;
const FACE_Y = 52;

// Flat rounded-tip 5-point star (from 7ec270c43): stroke with round joins
// bulges the tips soft, matching the reference sticker look.
const starPath = (cx: number, cy: number, outer: number, inner: number) => {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return `M ${points.join(' L ')} Z`;
};

export default function StarFaceRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const faceRef = React.useRef<SVGGElement>(null);

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const yellow = STAR_YELLOWS[Math.floor(rng() * STAR_YELLOWS.length)];
  const faceStyle = Math.floor(rng() * 6); // 0: Smile, 1: Glasses, 2: Sleepy, 3: Smirk, 4: Grumpy, 5: Blush
  const tilt = (rng() * 16 - 8).toFixed(1);

  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el || !faceRef.current) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 260 / dist);
      const tx = (dx / dist) * 2.5 * reach;
      const ty = (dy / dist) * 2 * reach;
      faceRef.current.setAttribute(
        'transform',
        `translate(${(FACE_X + tx).toFixed(2)} ${(FACE_Y + ty).toFixed(2)})`
      );
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [interactive]);

  const calmFace = () => {
    switch (faceStyle) {
      case 1:
        /* Round glasses (from 7ec270c43 row 1) */
        return (
          <g>
            <circle cx="-9" cy="-3" r="5.4" fill="none" stroke={FACE_INK} strokeWidth="2.4" />
            <circle cx="9" cy="-3" r="5.4" fill="none" stroke={FACE_INK} strokeWidth="2.4" />
            <line x1="-3.6" y1="-3" x2="3.6" y2="-3" stroke={FACE_INK} strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="-9" cy="-3" r="1.7" fill={FACE_INK} />
            <circle cx="9" cy="-3" r="1.7" fill={FACE_INK} />
            <path d="M -4 7 Q 0 11 4 7" fill="none" stroke={FACE_INK} strokeWidth="2.4" strokeLinecap="round" />
          </g>
        );
      case 2:
        /* Sleepy closed arcs + tiny o mouth */
        return (
          <g fill="none" stroke={FACE_INK} strokeWidth="2.4" strokeLinecap="round">
            <path d="M -12 -3 Q -9 0 -6 -3" />
            <path d="M 6 -3 Q 9 0 12 -3" />
            <circle cx="0" cy="7" r="2" />
          </g>
        );
      case 3:
        /* Smirk arcs + wavy mouth */
        return (
          <g fill="none" stroke={FACE_INK} strokeWidth="2.4" strokeLinecap="round">
            <path d="M -12 -2 Q -9 -5 -6 -2" />
            <path d="M 6 -2 Q 9 -5 12 -2" />
            <path d="M -4 7 Q -1 5 1 7 Q 3 9 6 7" />
          </g>
        );
      case 4:
        /* Grumpy brows + frown */
        return (
          <g fill="none" stroke={FACE_INK} strokeWidth="2.4" strokeLinecap="round">
            <line x1="-12" y1="-9" x2="-6" y2="-6" />
            <line x1="12" y1="-9" x2="6" y2="-6" />
            <circle cx="-8" cy="-2" r="1.9" fill={FACE_INK} stroke="none" />
            <circle cx="8" cy="-2" r="1.9" fill={FACE_INK} stroke="none" />
            <path d="M -5 9 Q 0 4 5 9" />
          </g>
        );
      case 5:
        /* Blush + happy open smile */
        return (
          <g>
            <circle cx="-8" cy="-2" r="2.1" fill={FACE_INK} />
            <circle cx="8" cy="-2" r="2.1" fill={FACE_INK} />
            <path d="M -5 4 Q 0 12 5 4 Z" fill={FACE_INK} />
            <circle cx="-15" cy="2" r="3.4" fill={BLUSH} opacity="0.85" />
            <circle cx="15" cy="2" r="3.4" fill={BLUSH} opacity="0.85" />
          </g>
        );
      default:
        /* Classic dot eyes + smile */
        return (
          <g>
            <circle cx="-8" cy="-2" r="2.1" fill={FACE_INK} />
            <circle cx="8" cy="-2" r="2.1" fill={FACE_INK} />
            <path d="M -5 5 Q 0 10 5 5" fill="none" stroke={FACE_INK} strokeWidth="2.4" strokeLinecap="round" />
          </g>
        );
    }
  };

  const stateFace = () => {
    if (isError) {
      return (
        <g>
          <g stroke={FACE_INK} strokeWidth="2.4" strokeLinecap="round">
            <line x1="-11" y1="-5" x2="-5" y2="1" />
            <line x1="-11" y1="1" x2="-5" y2="-5" />
            <line x1="5" y1="-5" x2="11" y2="1" />
            <line x1="5" y1="1" x2="11" y2="-5" />
          </g>
          <path d="M -5 10 Q 0 5 5 10" fill="none" stroke={FACE_INK} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      );
    }
    if (isNeedsInput) {
      return (
        <g>
          <circle cx="-8" cy="-3" r="2.8" fill={FACE_INK} />
          <circle cx="8" cy="-3" r="2.8" fill={FACE_INK} />
          <g stroke={FACE_INK} strokeWidth="2.2" strokeLinecap="round">
            <line x1="-12" y1="-11" x2="-5" y2="-8" />
            <line x1="12" y1="-11" x2="5" y2="-8" />
          </g>
          <ellipse cx="0" cy="7" rx="3" ry="4.5" fill={FACE_INK} />
        </g>
      );
    }
    return calmFace();
  };

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`blob-star-svg blob-state-${state}`}
      style={{ overflow: 'visible' }}
    >
      <g className="star-body">
        {/* Seeded tilt lives on an inner group so state animations compose on top */}
        <g
          style={{
            transform: `rotate(${tilt}deg)`,
            transformOrigin: '50px 52px',
            transformBox: 'view-box',
          }}
        >
          {/* Flat rounded-tip star body */}
          <path
            d={starPath(50, 52, 41, 19)}
            fill={yellow.fill}
            stroke={yellow.fill}
            strokeWidth="7"
            strokeLinejoin="round"
          />

          {/* Face (state-driven expression) */}
          <g ref={faceRef} transform={`translate(${FACE_X} ${FACE_Y})`}>
            {stateFace()}
          </g>

          {/* Excited sparkle ticks when active */}
          {state === 'active' && (
            <g className="star-sparkles" stroke={FACE_INK} strokeWidth="2.2" strokeLinecap="round">
              <line x1="14" y1="10" x2="10" y2="14" />
              <line x1="86" y1="10" x2="90" y2="14" />
              <line x1="8" y1="62" x2="12" y2="66" />
              <line x1="92" y1="62" x2="88" y2="66" />
            </g>
          )}

          {/* Alert exclamation pop */}
          {isNeedsInput && (
            <g className="star-alert" fill={FACE_INK}>
              <line x1="76" y1="10" x2="76" y2="20" stroke={FACE_INK} strokeWidth="3.4" strokeLinecap="round" />
              <circle cx="76" cy="25" r="1.9" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
