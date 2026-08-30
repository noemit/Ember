import * as React from 'react';
import { HABIT_PALETTE } from '../palette';
import { HABIT_SHAPES } from '../shapes';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

export default function HabitPillRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const eyesGroupRef = React.useRef<SVGGElement>(null);
  const gradientId = `habit-grad-${React.useId().replace(/[:]/g, '')}`;

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const shapeIndex = Math.floor(rng() * HABIT_SHAPES.length);
  const colorIndex = Math.floor(rng() * HABIT_PALETTE.length);
  const eyeTiltVariant = Math.floor(rng() * 3); // 0: parallel right, 1: inward tilt, 2: outward tilt

  const shape = HABIT_SHAPES[shapeIndex];
  const color = HABIT_PALETTE[colorIndex];
  const isError = state === 'error';

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el || !eyesGroupRef.current) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 280 / dist);
      const tx = ((dx / dist) * 4 * reach).toFixed(2);
      const ty = ((dy / dist) * 3 * reach).toFixed(2);
      eyesGroupRef.current.setAttribute('transform', `translate(${tx} ${ty})`);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [interactive]);

  // Determine eye tilt angles
  let leftAngle = -6;
  let rightAngle = -6;
  if (eyeTiltVariant === 1) {
    leftAngle = 10;
    rightAngle = -10;
  } else if (eyeTiltVariant === 2) {
    leftAngle = -12;
    rightAngle = 12;
  }

  const eyeY = shape.eyeOffsetY;
  const spacing = shape.eyeSpacing;

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="blob-habit-svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor={color.light} />
          <stop offset="60%" stopColor={color.base} />
          <stop offset="100%" stopColor={color.dark} />
        </linearGradient>
        {/* Soft bottom ambient drop shadow */}
        <radialGradient id={`shadow-${gradientId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.3)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* Subtle floor contact shadow */}
      <ellipse cx="50" cy="95" rx="36" ry="5" fill={`url(#shadow-${gradientId})`} />

      {/* Main Body */}
      <path
        d={shape.path}
        fill={`url(#${gradientId})`}
        stroke={color.edge}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Soft inner top-left sheen highlight */}
      <path
        d={shape.path}
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeOpacity="0.22"
        transform="translate(1, 1) scale(0.96)"
      />

      {/* Eyes group */}
      <g ref={eyesGroupRef} className="habit-eyes-group">
        {isError ? (
          <g
            stroke="#1c181d"
            strokeWidth="3.5"
            strokeLinecap="round"
            transform={`translate(50 ${eyeY})`}
          >
            {/* Left X */}
            <line x1={-spacing - 4} y1={-4} x2={-spacing + 4} y2={4} />
            <line x1={-spacing - 4} y1={4} x2={-spacing + 4} y2={-4} />
            {/* Right X */}
            <line x1={spacing - 4} y1={-4} x2={spacing + 4} y2={4} />
            <line x1={spacing - 4} y1={4} x2={spacing + 4} y2={-4} />
          </g>
        ) : (
          <g transform={`translate(50 ${eyeY})`}>
            {/* Left Pill Eye */}
            <g transform={`translate(${-spacing} 0) rotate(${leftAngle})`}>
              <rect
                x="-3.5"
                y="-9.5"
                width="7"
                height="19"
                rx="3.5"
                fill="#121316"
                className="habit-pill-eye"
              />
              {/* Eye sheen glint */}
              <circle cx="-1" cy="-5" r="1.2" fill="#ffffff" opacity="0.8" />
            </g>

            {/* Right Pill Eye */}
            <g transform={`translate(${spacing} 0) rotate(${rightAngle})`}>
              <rect
                x="-3.5"
                y="-9.5"
                width="7"
                height="19"
                rx="3.5"
                fill="#121316"
                className="habit-pill-eye"
              />
              {/* Eye sheen glint */}
              <circle cx="-1" cy="-5" r="1.2" fill="#ffffff" opacity="0.8" />
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}
