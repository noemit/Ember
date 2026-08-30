import * as React from 'react';
import { PUFFY_CLAY_PALETTE } from '../palette';
import { PUFFY_CLAY_SHAPES } from '../shapes';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

export default function PuffyClayRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const leftPupilRef = React.useRef<SVGGElement>(null);
  const rightPupilRef = React.useRef<SVGGElement>(null);

  const uid = React.useId().replace(/[:]/g, '');
  const bodyGradId = `clay-body-${uid}`;
  const eyeGradId = `clay-eye-${uid}`;
  const shadowId = `clay-shd-${uid}`;

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const shapeIndex = Math.floor(rng() * PUFFY_CLAY_SHAPES.length);
  const colorIndex = Math.floor(rng() * PUFFY_CLAY_PALETTE.length);

  const shape = PUFFY_CLAY_SHAPES[shapeIndex];
  const color = PUFFY_CLAY_PALETTE[colorIndex];
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
      // Allow pupils to look up to 4.5px in any direction inside the eye
      const tx = ((dx / dist) * 4.2 * reach).toFixed(2);
      const ty = ((dy / dist) * 3.8 * reach).toFixed(2);
      const transform = `translate(${tx} ${ty})`;
      if (leftPupilRef.current) leftPupilRef.current.setAttribute('transform', transform);
      if (rightPupilRef.current) rightPupilRef.current.setAttribute('transform', transform);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [interactive]);

  const eyeY = shape.eyeY;
  const spacing = shape.eyeSpacing;
  const eyeR = shape.eyeRadius;

  const renderEye = (offsetX: number, pupilRef: React.RefObject<SVGGElement>) => (
    <g transform={`translate(${offsetX} 0)`}>
      {/* 3D Eyeball Cast Shadow onto Clay Body */}
      <ellipse cx="0" cy="4" rx={eyeR + 1} ry={eyeR * 0.9} fill="rgba(0, 0, 0, 0.25)" />

      {/* 3D White Spherical Eyeball with soft sphere shading */}
      <circle cx="0" cy="0" r={eyeR} fill={`url(#${eyeGradId})`} stroke="#e2e8f0" strokeWidth="0.8" />

      {/* Soft inner eye shadow rim */}
      <circle cx="0" cy="0" r={eyeR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1.5" />

      {isError ? (
        <g stroke="#1a1824" strokeWidth="3" strokeLinecap="round">
          <line x1={-eyeR * 0.5} y1={-eyeR * 0.5} x2={eyeR * 0.5} y2={eyeR * 0.5} />
          <line x1={-eyeR * 0.5} y1={eyeR * 0.5} x2={eyeR * 0.5} y2={-eyeR * 0.5} />
        </g>
      ) : (
        <g ref={pupilRef}>
          {/* Main large dark glossy pupil */}
          <circle cx="0" cy="0" r={eyeR * 0.52} fill="#14141e" />

          {/* Primary bright specular glint highlight (top-left) */}
          <circle cx={-eyeR * 0.2} cy={-eyeR * 0.2} r={eyeR * 0.2} fill="#ffffff" />

          {/* Secondary smaller bottom-right glint */}
          <circle cx={eyeR * 0.18} cy={eyeR * 0.18} r={eyeR * 0.1} fill="#ffffff" opacity="0.9" />
        </g>
      )}
    </g>
  );

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="blob-clay-svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Soft 3D dual-tone body gradient: top sky/mint down to bottom blush pink/peach */}
        <linearGradient id={bodyGradId} x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor={color.light} />
          <stop offset="45%" stopColor={color.base} />
          <stop offset="85%" stopColor={color.secondary ?? color.dark} />
          <stop offset="100%" stopColor={color.dark} />
        </linearGradient>

        {/* 3D Eyeball Sphere Gradient */}
        <radialGradient id={eyeGradId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="75%" stopColor="#f4f6fb" />
          <stop offset="100%" stopColor="#d5dbe7" />
        </radialGradient>

        {/* Ambient Floor Shadow */}
        <radialGradient id={shadowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
          <stop offset="70%" stopColor="rgba(0,0,0,0.12)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* Floor contact shadow */}
      <ellipse cx="50" cy="94" rx="38" ry="6" fill={`url(#${shadowId})`} />

      {/* Main 3D Clay Body */}
      <path
        d={shape.path}
        fill={`url(#${bodyGradId})`}
        stroke={color.edge}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Top ambient clay sheen */}
      <path
        d={shape.path}
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeOpacity="0.32"
        transform="translate(1, 1) scale(0.96)"
      />

      {/* Soft Rosy Blush Cheeks under eyes */}
      <ellipse
        cx={50 - spacing - eyeR * 0.7}
        cy={eyeY + eyeR * 0.85}
        rx={eyeR * 0.45}
        ry={eyeR * 0.25}
        fill={color.accent ?? '#ff4081'}
        opacity="0.38"
      />
      <ellipse
        cx={50 + spacing + eyeR * 0.7}
        cy={eyeY + eyeR * 0.85}
        rx={eyeR * 0.45}
        ry={eyeR * 0.25}
        fill={color.accent ?? '#ff4081'}
        opacity="0.38"
      />

      {/* Eyes Group */}
      <g transform={`translate(50 ${eyeY})`}>
        {renderEye(-spacing, leftPupilRef)}
        {renderEye(spacing, rightPupilRef)}
      </g>
    </svg>
  );
}
