import * as React from 'react';
import { LUMINOUS_PALETTE } from '../palette';
import { LUMINOUS_SHAPES } from '../shapes';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

export default function LuminousOrbRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const eyesRef = React.useRef<SVGGElement>(null);

  const uid = React.useId().replace(/[:]/g, '');
  const coreGradId = `lum-core-${uid}`;
  const auraGradId = `lum-aura-${uid}`;
  const eyeGlowId = `lum-eyeglow-${uid}`;

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const shapeIndex = Math.floor(rng() * LUMINOUS_SHAPES.length);
  const colorIndex = Math.floor(rng() * LUMINOUS_PALETTE.length);

  const shape = LUMINOUS_SHAPES[shapeIndex];
  const color = LUMINOUS_PALETTE[colorIndex];
  const isError = state === 'error';

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el || !eyesRef.current) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 280 / dist);
      const tx = ((dx / dist) * 4.5 * reach).toFixed(2);
      const ty = ((dy / dist) * 3.5 * reach).toFixed(2);
      eyesRef.current.setAttribute('transform', `translate(${tx} ${ty})`);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [interactive]);

  const eyeY = shape.eyeY;
  const spacing = shape.eyeSpacing;

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="blob-luminous-svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Deep Radiant Core Gradient */}
        <radialGradient id={coreGradId} cx="42%" cy="36%" r="68%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
          <stop offset="18%" stopColor={color.light} />
          <stop offset="55%" stopColor={color.base} />
          <stop offset="85%" stopColor={color.edge} />
          <stop offset="100%" stopColor={color.dark} />
        </radialGradient>

        {/* Diffused Ambient Glow Aura */}
        <radialGradient id={auraGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color.base} stopOpacity={0.55} />
          <stop offset="50%" stopColor={color.dark} stopOpacity={0.25} />
          <stop offset="100%" stopColor="transparent" stopOpacity={0} />
        </radialGradient>

        {/* Soft Eye Glow Filter */}
        <filter id={eyeGlowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.5" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* External Ambient Aura */}
      <ellipse cx="50" cy="54" rx="46" ry="44" fill={`url(#${auraGradId})`} />

      {/* Soft Bottom Shadow */}
      <ellipse cx="50" cy="94" rx="34" ry="5" fill="rgba(0,0,0,0.3)" />

      {/* Luminous Body */}
      <path
        d={shape.path}
        fill={`url(#${coreGradId})`}
        stroke={color.light}
        strokeWidth="0.8"
        strokeOpacity="0.4"
      />

      {/* Inner Rim Light / Glass Contour */}
      <path
        d={shape.path}
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeOpacity="0.35"
        transform="translate(1, 1) scale(0.96)"
      />

      {/* Top Glass Specular Arc */}
      <ellipse
        cx="40"
        cy="22"
        rx="16"
        ry="7"
        fill="#ffffff"
        opacity="0.35"
        transform="rotate(-15 40 22)"
      />

      {/* Luminous White Capsule Eyes */}
      <g ref={eyesRef} className="luminous-eyes-group">
        {isError ? (
          <g
            stroke="#ff5577"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`translate(50 ${eyeY})`}
            filter={`url(#${eyeGlowId})`}
          >
            <line x1={-spacing - 3} y1={-4} x2={-spacing + 3} y2={4} />
            <line x1={-spacing - 3} y1={4} x2={-spacing + 3} y2={-4} />
            <line x1={spacing - 3} y1={-4} x2={spacing + 3} y2={4} />
            <line x1={spacing - 3} y1={4} x2={spacing + 3} y2={-4} />
          </g>
        ) : (
          <g
            transform={`translate(50 ${eyeY})`}
            filter={`url(#${eyeGlowId})`}
            className="luminous-pill-eyes"
          >
            {/* Left Luminous Capsule Eye */}
            <rect
              x={-spacing - 3}
              y="-8.5"
              width="6"
              height="17"
              rx="3"
              fill="#ffffff"
            />

            {/* Right Luminous Capsule Eye */}
            <rect
              x={spacing - 3}
              y="-8.5"
              width="6"
              height="17"
              rx="3"
              fill="#ffffff"
            />
          </g>
        )}
      </g>
    </svg>
  );
}
