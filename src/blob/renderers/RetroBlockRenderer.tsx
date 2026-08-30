import * as React from 'react';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

const BLOCK_PALETTE = [
  { name: 'Cobalt Blue', fill: '#0077b6', stroke: '#023e8a', eyeWhite: '#ffffff', pupil: '#0d1b2a' },
  { name: 'Sunflower Yellow', fill: '#ffb703', stroke: '#fb8500', eyeWhite: '#ffffff', pupil: '#0d1b2a' },
  { name: 'Tangerine Orange', fill: '#fb5607', stroke: '#c1121f', eyeWhite: '#ffffff', pupil: '#0d1b2a' },
  { name: 'Bubblegum Pink', fill: '#ff006e', stroke: '#a50044', eyeWhite: '#ffffff', pupil: '#0d1b2a' },
  { name: 'Emerald Green', fill: '#06d6a0', stroke: '#049a72', eyeWhite: '#ffffff', pupil: '#0d1b2a' },
  { name: 'Electric Violet', fill: '#8338ec', stroke: '#5b1ab3', eyeWhite: '#ffffff', pupil: '#0d1b2a' },
];

export default function RetroBlockRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const leftPupilRef = React.useRef<SVGCircleElement>(null);
  const rightPupilRef = React.useRef<SVGCircleElement>(null);

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const color = BLOCK_PALETTE[Math.floor(rng() * BLOCK_PALETTE.length)];
  const shapeVariant = Math.floor(rng() * 3); // 0: Square, 1: Rounded Square, 2: Split Dual-Tone Block
  const faceVariant = Math.floor(rng() * 4); // 0: Cute curve smile, 1: Big wide smile, 2: Surprise O, 3: Smirk

  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';

  const breathDuration = (2.7 + ((seedHash >> 3) % 15) * 0.12).toFixed(2);
  const breathDelay = -(((seedHash >> 7) % 25) * 0.15).toFixed(2);

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 260 / dist);
      const tx = ((dx / dist) * 3 * reach).toFixed(2);
      const ty = ((dy / dist) * 2.5 * reach).toFixed(2);
      const transform = `translate(${tx} ${ty})`;
      if (leftPupilRef.current) leftPupilRef.current.setAttribute('transform', transform);
      if (rightPupilRef.current) rightPupilRef.current.setAttribute('transform', transform);
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
      className={`blob-retro-block-svg blob-state-${state}`}
      style={{ overflow: 'visible' }}
    >
      {/* Floor Contact Shadow */}
      <rect x="14" y="90" width="72" height="6" rx="3" fill="rgba(0,0,0,0.25)" />

      {/* Main Animated Block */}
      <g
        className="retro-block-body"
        style={state === 'idle' ? { animationDuration: `${breathDuration}s`, animationDelay: `${breathDelay}s` } : undefined}
      >
        {/* Block Shape */}
        {shapeVariant === 0 && (
          /* Sharp Modern Square with subtle rounded radius */
          <rect x="10" y="10" width="80" height="80" rx="6" fill={color.fill} stroke={color.stroke} strokeWidth="2" />
        )}
        {shapeVariant === 1 && (
          /* Rounded Squircle Cushion */
          <rect x="10" y="10" width="80" height="80" rx="18" fill={color.fill} stroke={color.stroke} strokeWidth="2" />
        )}
        {shapeVariant === 2 && (
          /* Split Dual-Block (Top light, bottom deep) */
          <g>
            <rect x="10" y="10" width="80" height="80" rx="10" fill={color.fill} stroke={color.stroke} strokeWidth="2" />
            <path d="M 10 50 L 90 50 L 90 80 C 90 85, 85 90, 80 90 L 20 90 C 15 90, 10 85, 10 80 Z" fill={color.stroke} opacity="0.3" />
          </g>
        )}

        {/* Soft Screenprint/Risograph Texture Accent */}
        <line x1="12" y1="12" x2="88" y2="12" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.4" />

        {/* Expressive Big Round Cartoon Eyes (Direct from f9cbec03) */}
        <g transform="translate(50 38)">
          {isError ? (
            <g stroke="#ffffff" strokeWidth="3" strokeLinecap="round">
              <line x1="-24" y1="-5" x2="-14" y2="5" />
              <line x1="-24" y1="5" x2="-14" y2="-5" />
              <line x1="14" y1="-5" x2="24" y2="5" />
              <line x1="14" y1="5" x2="24" y2="-5" />
            </g>
          ) : (
            <g>
              {/* Left Eye */}
              <circle cx="-19" cy="0" r="7.5" fill={color.eyeWhite} stroke="#0d1b2a" strokeWidth="1.2" />
              <circle ref={leftPupilRef} cx="-19" cy="0" r="3.6" fill={color.pupil} />

              {/* Right Eye */}
              <circle cx="19" cy="0" r="7.5" fill={color.eyeWhite} stroke="#0d1b2a" strokeWidth="1.2" />
              <circle ref={rightPupilRef} cx="19" cy="0" r="3.6" fill={color.pupil} />
            </g>
          )}
        </g>

        {/* Ink Hand-Drawn Mouth */}
        <g transform="translate(50 64)">
          {isNeedsInput ? (
            /* Yelling open mouth */
            <circle cx="0" cy="0" r="6.5" fill="#0d1b2a" />
          ) : isError ? (
            <path d="M -10 4 Q 0 -4 10 4" fill="none" stroke="#0d1b2a" strokeWidth="3.2" strokeLinecap="round" />
          ) : faceVariant === 0 ? (
            /* Cute centered curve smile */
            <path d="M -7 -2 Q 0 8 7 -2" fill="none" stroke="#0d1b2a" strokeWidth="3.2" strokeLinecap="round" />
          ) : faceVariant === 1 ? (
            /* Wide joyful smile */
            <path d="M -16 -4 Q 0 16 16 -4" fill="none" stroke="#0d1b2a" strokeWidth="3.5" strokeLinecap="round" />
          ) : faceVariant === 2 ? (
            /* Tiny surprise O dot */
            <circle cx="0" cy="0" r="3.6" fill="#0d1b2a" />
          ) : (
            /* Cheeky smirk */
            <path d="M -6 4 Q 4 8 10 -2" fill="none" stroke="#0d1b2a" strokeWidth="3.2" strokeLinecap="round" />
          )}
        </g>
      </g>
    </svg>
  );
}
