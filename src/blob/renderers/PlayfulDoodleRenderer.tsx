import * as React from 'react';
import { DOODLE_PALETTE } from '../palette';
import { DOODLE_SHAPES } from '../shapes';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

export default function PlayfulDoodleRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const faceGroupRef = React.useRef<SVGGElement>(null);

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const shapeIndex = Math.floor(rng() * DOODLE_SHAPES.length);
  const colorIndex = Math.floor(rng() * DOODLE_PALETTE.length);
  const faceVariant = Math.floor(rng() * 4); // 0: wide smile, 1: cheeky tilted smirk, 2: open happy mouth, 3: wink & smile
  const tiltAngle = (rng() - 0.5) * 60; // -30deg to +30deg tilt like the reference screenshot

  const shape = DOODLE_SHAPES[shapeIndex];
  const color = DOODLE_PALETTE[colorIndex];
  const isError = state === 'error';

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
      const tx = ((dx / dist) * 4 * reach).toFixed(2);
      const ty = ((dy / dist) * 3.5 * reach).toFixed(2);
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
      className="blob-doodle-svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Soft floor shadow */}
        <radialGradient id={`doodle-shd-${seedHash}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.28)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* Floor contact shadow */}
      <ellipse cx="50" cy="95" rx="34" ry="5" fill={`url(#doodle-shd-${seedHash})`} />

      {/* Tilted Body and Face Group */}
      <g transform={`rotate(${tiltAngle} 50 50)`}>
        {/* Main Solid Body */}
        <path
          d={shape.path}
          fill={color.base}
          stroke={color.dark}
          strokeWidth="1.2"
        />

        {/* Soft upper-left highlight shine */}
        <path
          d={shape.path}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeOpacity="0.28"
          transform="translate(1, 1) scale(0.96)"
        />

        {/* Expressive Hand-Drawn Ink Face */}
        <g ref={faceGroupRef}>
          {isError ? (
            <g stroke="#121316" strokeWidth="3.5" strokeLinecap="round" transform="translate(50 48)">
              {/* Left X */}
              <line x1="-18" y1="-5" x2="-8" y2="5" />
              <line x1="-18" y1="5" x2="-8" y2="-5" />
              {/* Right X */}
              <line x1="8" y1="-5" x2="18" y2="5" />
              <line x1="8" y1="5" x2="18" y2="-5" />
              {/* Sad wavy mouth */}
              <path d="M -12 14 Q 0 6 12 14" fill="none" strokeWidth="3.5" />
            </g>
          ) : (
            <g transform="translate(50 45)">
              {faceVariant === 0 && (
                /* Classic Wide Hand-Drawn Smile + Dot Eyes */
                <g>
                  {/* Left & Right Bold Ink Dot Eyes */}
                  <circle cx="-13" cy="-6" r="4.2" fill="#121316" />
                  <circle cx="13" cy="-6" r="4.2" fill="#121316" />
                  {/* Big Curved Smile */}
                  <path
                    d="M -16 6 Q 0 24 16 6"
                    fill="none"
                    stroke="#121316"
                    strokeWidth="4.2"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {faceVariant === 1 && (
                /* Cheeky Tilted Smirk */
                <g>
                  <circle cx="-12" cy="-8" r="4" fill="#121316" />
                  <circle cx="14" cy="-4" r="4" fill="#121316" />
                  <path
                    d="M -10 10 Q 4 18 18 4"
                    fill="none"
                    stroke="#121316"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {faceVariant === 2 && (
                /* Open Happy Curve Mouth */
                <g>
                  <circle cx="-13" cy="-6" r="4" fill="#121316" />
                  <circle cx="13" cy="-6" r="4" fill="#121316" />
                  <path
                    d="M -12 5 Q 0 22 12 5 Z"
                    fill="#121316"
                    stroke="#121316"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {faceVariant === 3 && (
                /* Wink & Happy Smile */
                <g>
                  {/* Left Winking Eye */}
                  <path
                    d="M -18 -4 Q -12 -11 -6 -4"
                    fill="none"
                    stroke="#121316"
                    strokeWidth="3.8"
                    strokeLinecap="round"
                  />
                  {/* Right Open Dot Eye */}
                  <circle cx="13" cy="-6" r="4.2" fill="#121316" />
                  {/* Smile */}
                  <path
                    d="M -14 7 Q 0 22 14 7"
                    fill="none"
                    stroke="#121316"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </g>
              )}
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
