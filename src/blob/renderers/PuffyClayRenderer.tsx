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
  const bodyGradId = `puffy-body-${uid}`;
  const eyeGradId = `puffy-eye-${uid}`;
  const floorShadowId = `puffy-floor-${uid}`;
  const auraGlowId = `puffy-aura-${uid}`;
  const alertBadgeGradId = `puffy-badge-${uid}`;

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const shapeIndex = Math.floor(rng() * PUFFY_CLAY_SHAPES.length);
  const colorIndex = Math.floor(rng() * PUFFY_CLAY_PALETTE.length);
  const eyeStyle = Math.floor(rng() * 4); // 0: Glossy Googly, 1: Sparkle Wonder, 2: Chill / Half-lidded, 3: Wide Curious

  const shape = PUFFY_CLAY_SHAPES[shapeIndex];
  const color = PUFFY_CLAY_PALETTE[colorIndex];
  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';
  const isActive = state === 'active';

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
      const tx = ((dx / dist) * 4.4 * reach).toFixed(2);
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
  const mouthY = shape.mouthY ?? eyeY + eyeR + 8;

  const renderPupil = (ref: React.RefObject<SVGGElement>, isLeft: boolean) => {
    if (isError) {
      return (
        <g stroke="#1a1824" strokeWidth="3.2" strokeLinecap="round" className="clay-error-x">
          <line x1={-eyeR * 0.55} y1={-eyeR * 0.55} x2={eyeR * 0.55} y2={eyeR * 0.55} />
          <line x1={-eyeR * 0.55} y1={eyeR * 0.55} x2={eyeR * 0.55} y2={-eyeR * 0.55} />
        </g>
      );
    }

    if (eyeStyle === 1) {
      // Sparkle Wonder Anime Eye
      return (
        <g ref={ref} className="clay-pupil-group">
          <ellipse cx="0" cy="0" rx={eyeR * 0.58} ry={eyeR * 0.64} fill="#12111a" />
          {/* Inner iris color crescent */}
          <ellipse cx="0" cy={eyeR * 0.22} rx={eyeR * 0.44} ry={eyeR * 0.32} fill={color.base} opacity="0.8" />
          {/* Primary diamond star highlight */}
          <circle cx={-eyeR * 0.22} cy={-eyeR * 0.25} r={eyeR * 0.22} fill="#ffffff" />
          {/* Secondary sparkle */}
          <circle cx={eyeR * 0.2} cy={eyeR * 0.22} r={eyeR * 0.12} fill="#ffffff" opacity="0.9" />
          <circle cx={-eyeR * 0.18} cy={eyeR * 0.26} r={eyeR * 0.08} fill="#ffffff" opacity="0.85" />
        </g>
      );
    }

    if (eyeStyle === 2) {
      // Chill / Half-Lidded Eyelid
      return (
        <g ref={ref} className="clay-pupil-group">
          <circle cx="0" cy="1" r={eyeR * 0.48} fill="#14141e" />
          <circle cx={-eyeR * 0.16} cy={-eyeR * 0.12} r={eyeR * 0.18} fill="#ffffff" />
          {/* Top sleepy eyelid shade */}
          <path
            d={`M ${-eyeR} ${-eyeR * 0.1} Q 0 ${eyeR * 0.3} ${eyeR} ${-eyeR * 0.1} L ${eyeR} ${-eyeR} L ${-eyeR} ${-eyeR} Z`}
            fill={color.base}
            stroke={color.edge}
            strokeWidth="0.8"
          />
        </g>
      );
    }

    if (eyeStyle === 3) {
      // Wide Curious Pill-Round Pupil
      return (
        <g ref={ref} className="clay-pupil-group">
          <rect
            x={-eyeR * 0.38}
            y={-eyeR * 0.52}
            width={eyeR * 0.76}
            height={eyeR * 1.04}
            rx={eyeR * 0.38}
            fill="#12131a"
          />
          <circle cx={-eyeR * 0.12} cy={-eyeR * 0.22} r={eyeR * 0.18} fill="#ffffff" />
          <circle cx={eyeR * 0.14} cy={eyeR * 0.2} r={eyeR * 0.1} fill="#ffffff" opacity="0.85" />
        </g>
      );
    }

    // Default Style 0: Glossy 3D Googly Eye (Reference 05dcb78b151b13d955554fa4fc249a7b.jpg)
    return (
      <g ref={ref} className="clay-pupil-group">
        <circle cx="0" cy="0" r={eyeR * 0.54} fill="#13131d" />
        <circle cx={-eyeR * 0.2} cy={-eyeR * 0.2} r={eyeR * 0.22} fill="#ffffff" />
        <circle cx={eyeR * 0.18} cy={eyeR * 0.18} r={eyeR * 0.11} fill="#ffffff" opacity="0.9" />
      </g>
    );
  };

  const renderEye = (offsetX: number, pupilRef: React.RefObject<SVGGElement>, isLeft: boolean) => (
    <g transform={`translate(${offsetX} 0)`} className="clay-eyeball-unit">
      {/* 3D Eyeball Cast Shadow onto Clay Body */}
      <ellipse cx="0" cy="4.5" rx={eyeR + 1.2} ry={eyeR * 0.88} fill="rgba(0, 0, 0, 0.24)" />

      {/* 3D White Spherical Eyeball */}
      <circle cx="0" cy="0" r={eyeR} fill={`url(#${eyeGradId})`} stroke="#cbd5e1" strokeWidth="0.8" />

      {/* Eyeball Inner Soft Rim */}
      <circle cx="0" cy="0" r={eyeR} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1.2" />

      {/* Pupil and Expression */}
      {renderPupil(pupilRef, isLeft)}
    </g>
  );

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`blob-clay-svg blob-state-${state}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Stretched, ultra-soft subtle dual-tone body gradient */}
        <linearGradient id={bodyGradId} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={color.light} />
          <stop offset="28%" stopColor={color.base} />
          <stop offset="68%" stopColor={color.secondary ?? color.base} />
          <stop offset="100%" stopColor={color.dark} />
        </linearGradient>

        {/* 3D Eyeball Sphere Gradient */}
        <radialGradient id={eyeGradId} cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#d1d9e6" />
        </radialGradient>

        {/* Ambient Floor Shadow */}
        <radialGradient id={floorShadowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.32)" />
          <stop offset="65%" stopColor="rgba(0,0,0,0.12)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>

        {/* Pulsing Luminous Attention Beacon Aura (Needs-Input) */}
        <radialGradient id={auraGlowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color.glow ?? color.accent ?? '#ff007f'} stopOpacity={0.7} />
          <stop offset="55%" stopColor={color.base} stopOpacity={0.35} />
          <stop offset="100%" stopColor="transparent" stopOpacity={0} />
        </radialGradient>

        {/* Notification Alert Badge Gradient */}
        <linearGradient id={alertBadgeGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff4d4d" />
          <stop offset="100%" stopColor="#d90429" />
        </linearGradient>
      </defs>

      {/* Needs-Input Radiant Glowing Aura Ring */}
      {isNeedsInput && (
        <ellipse cx="50" cy="50" rx="52" ry="50" fill={`url(#${auraGlowId})`} className="clay-needs-input-aura" />
      )}

      {/* Floor Contact Shadow */}
      <ellipse cx="50" cy="94" rx="38" ry="6" fill={`url(#${floorShadowId})`} className="clay-floor-shadow" />

      {/* Main Animated Clay Character Group */}
      <g className="clay-character-body">
        {/* Main 3D Soft Clay Body */}
        <path
          d={shape.path}
          fill={`url(#${bodyGradId})`}
          stroke={color.edge}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Top Volumetric Ambient Specular Sheen */}
        <path
          d={shape.path}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.8"
          strokeOpacity="0.32"
          transform="translate(1, 1) scale(0.96)"
        />

        {/* Rosy Blush Cheeks under eyes */}
        <ellipse
          cx={50 - spacing - eyeR * 0.72}
          cy={eyeY + eyeR * 0.88}
          rx={eyeR * 0.46}
          ry={eyeR * 0.26}
          fill={color.accent ?? '#ff4081'}
          opacity="0.38"
          className="clay-blush"
        />
        <ellipse
          cx={50 + spacing + eyeR * 0.72}
          cy={eyeY + eyeR * 0.88}
          rx={eyeR * 0.46}
          ry={eyeR * 0.26}
          fill={color.accent ?? '#ff4081'}
          opacity="0.38"
          className="clay-blush"
        />

        {/* Mouth Expressions */}
        {isNeedsInput ? (
          /* Hilarious Rapidly Chattering / Yelling Mouth (Talking to user!) */
          <g transform={`translate(50 ${mouthY})`} className="clay-yelling-mouth">
            <ellipse cx="0" cy="0" rx="8.5" ry="7.5" fill="#181320" stroke="#0d0a12" strokeWidth="1" />
            {/* Tongue inside mouth */}
            <path d="M -5 3 Q 0 7 5 3 Q 3 0 -3 0 Z" fill="#ff5c8a" />
            {/* Sound / exclamation lines next to mouth */}
            <path d="M -12 -3 L -16 -6" stroke={color.dark} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M 12 -3 L 16 -6" stroke={color.dark} strokeWidth="1.8" strokeLinecap="round" />
          </g>
        ) : isError ? (
          /* Wobbly Sad Wavy Mouth */
          <g transform={`translate(50 ${mouthY})`}>
            <path
              d="M -9 4 Q -4 -3 0 2 Q 4 -3 9 4"
              fill="none"
              stroke="#1c1824"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>
        ) : isActive ? (
          /* Cheerful Open Smile */
          <g transform={`translate(50 ${mouthY - 2})`}>
            <path
              d="M -7 0 Q 0 8 7 0"
              fill="none"
              stroke="#1a1824"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </g>
        ) : (
          /* Subtle Idle Smile / Expression */
          <g transform={`translate(50 ${mouthY - 2})`}>
            <path
              d="M -5 0 Q 0 4.5 5 0"
              fill="none"
              stroke="#1a1824"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.85"
            />
          </g>
        )}

        {/* Eyeballs Group */}
        <g transform={`translate(50 ${eyeY})`} className="clay-eyes-group">
          {renderEye(-spacing, leftPupilRef, true)}
          {renderEye(spacing, rightPupilRef, false)}
        </g>
      </g>

      {/* Needs-Input Pulsing Alert Notification Badge at top-right */}
      {isNeedsInput && (
        <g transform="translate(82 14)" className="clay-alert-badge">
          <circle cx="0" cy="0" r="10" fill={`url(#${alertBadgeGradId})`} stroke="#ffffff" strokeWidth="1.8" />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="12"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
          >
            !
          </text>
        </g>
      )}
    </svg>
  );
}
