import * as React from 'react';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

const STAR_PALETTE = [
  { name: 'Ruby Sugar', base: '#ff3366', light: '#ff99b3', glow: '#ff0055', dark: '#b3003b', glitter: '#ffffff' },
  { name: 'Tangerine Candy', base: '#ff7700', light: '#ffc280', glow: '#ff5500', dark: '#b34700', glitter: '#fff3e0' },
  { name: 'Lemon Starlight', base: '#ffd000', light: '#fff080', glow: '#ffb700', dark: '#b38f00', glitter: '#ffffff' },
  { name: 'Mint Konpeito', base: '#00d084', light: '#80ffd4', glow: '#00b36b', dark: '#00804d', glitter: '#e6fff7' },
  { name: 'Cyan Crystal', base: '#00c3ff', light: '#99e8ff', glow: '#0099ff', dark: '#007399', glitter: '#f0fbff' },
  { name: 'Cosmic Blue', base: '#3b5bdb', light: '#91a7ff', glow: '#2240b8', dark: '#1c2d73', glitter: '#edf2ff' },
  { name: 'Amethyst Jelly', base: '#9747ff', light: '#d0a6ff', glow: '#7711ff', dark: '#5b1ab3', glitter: '#f8f0ff' },
  { name: 'Sakura Pink', base: '#ff66aa', light: '#ffb3d9', glow: '#ff3388', dark: '#b32467', glitter: '#fff0f7' },
  { name: 'Midnight Spark', base: '#2b2d42', light: '#8d99ae', glow: '#4a4e69', dark: '#14151f', glitter: '#ffffff' },
];

// Generates an 8-nodule Konpeito sugar star candy path
const buildKonpeitoPath = (rng: () => number) => {
  const points: [number, number][] = [];
  const nodules = 8;
  for (let i = 0; i < nodules * 2; i++) {
    const angle = (i / (nodules * 2)) * Math.PI * 2 - Math.PI / 2;
    const isTip = i % 2 === 0;
    const r = isTip ? 44 + (rng() - 0.5) * 3 : 26 + (rng() - 0.5) * 4;
    points.push([50 + Math.cos(angle) * r, 50 + Math.sin(angle) * r]);
  }
  return 'M ' + points.map((p, i) => `${i ? 'L ' : ''}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + ' Z';
};

export default function StarCandyRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const eyesRef = React.useRef<SVGGElement>(null);

  const uid = React.useId().replace(/[:]/g, '');
  const gradId = `star-grad-${uid}`;
  const glowId = `star-glow-${uid}`;

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const color = STAR_PALETTE[Math.floor(rng() * STAR_PALETTE.length)];
  const path = React.useMemo(() => buildKonpeitoPath(rng), [seedHash]);
  const faceStyle = Math.floor(rng() * 4); // 0: Glasses/Nerd, 1: Star Eyes, 2: Cheerful Smile, 3: Wink

  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';
  const isActive = state === 'active';

  const breathDuration = (2.6 + ((seedHash >> 3) % 14) * 0.12).toFixed(2);
  const breathDelay = -(((seedHash >> 6) % 24) * 0.15).toFixed(2);

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el || !eyesRef.current) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 260 / dist);
      const tx = ((dx / dist) * 4 * reach).toFixed(2);
      const ty = ((dy / dist) * 3.5 * reach).toFixed(2);
      eyesRef.current.setAttribute('transform', `translate(${tx} ${ty})`);
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
      className={`blob-star-candy-svg blob-state-${state}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Glowing Translucent Jelly Gradient */}
        <radialGradient id={gradId} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
          <stop offset="25%" stopColor={color.light} />
          <stop offset="65%" stopColor={color.base} />
          <stop offset="100%" stopColor={color.dark} />
        </radialGradient>

        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color.glow} stopOpacity={0.6} />
          <stop offset="70%" stopColor={color.base} stopOpacity={0.2} />
          <stop offset="100%" stopColor="transparent" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Internal & Ambient Sugar Glow */}
      <ellipse cx="50" cy="50" rx="46" ry="46" fill={`url(#${glowId})`} />
      <ellipse cx="50" cy="94" rx="34" ry="5" fill="rgba(0,0,0,0.3)" />

      {/* Main Animated Star Body */}
      <g
        className="star-candy-body"
        style={state === 'idle' ? { animationDuration: `${breathDuration}s`, animationDelay: `${breathDelay}s` } : undefined}
      >
        {/* Konpeito Crystal Star Body */}
        <path
          d={path}
          fill={`url(#${gradId})`}
          stroke={color.light}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Specular Crystallized Nodules Highlights */}
        <circle cx="50" cy="14" r="5" fill="#ffffff" opacity="0.6" />
        <circle cx="78" cy="24" r="4.5" fill="#ffffff" opacity="0.45" />
        <circle cx="22" cy="26" r="4" fill="#ffffff" opacity="0.5" />
        <circle cx="50" cy="46" r="16" fill="#ffffff" opacity="0.2" />

        {/* Internal Glitter Starlight Particles */}
        <polygon points="50,28 52,34 58,36 52,38 50,44 48,38 42,36 48,34" fill={color.glitter} opacity="0.85" />
        <polygon points="68,54 69,58 73,59 69,60 68,64 67,60 63,59 67,58" fill={color.glitter} opacity="0.75" />
        <polygon points="32,60 33,63 36,64 33,65 32,68 31,65 28,64 31,63" fill={color.glitter} opacity="0.7" />

        {/* Expressive Emotional Face (Inspired by 7ec270c4) */}
        <g ref={eyesRef} transform="translate(50 50)">
          {isError ? (
            <g stroke="#121118" strokeWidth="3" strokeLinecap="round">
              <line x1="-16" y1="-4" x2="-8" y2="4" />
              <line x1="-16" y1="4" x2="-8" y2="-4" />
              <line x1="8" y1="-4" x2="16" y2="4" />
              <line x1="8" y1="4" x2="16" y2="-4" />
              <path d="M -8 12 Q 0 6 8 12" fill="none" strokeWidth="2.8" />
            </g>
          ) : isNeedsInput ? (
            <g>
              <circle cx="-12" cy="-4" r="4.5" fill="#121118" />
              <circle cx="12" cy="-4" r="4.5" fill="#121118" />
              <circle cx="-13" cy="-5.5" r="1.6" fill="#ffffff" />
              <circle cx="11" cy="-5.5" r="1.6" fill="#ffffff" />
              <path d="M -6 5 Q 0 14 6 5 Z" fill="#121118" />
            </g>
          ) : faceStyle === 0 ? (
            /* Glasses / Smart Star */
            <g>
              <circle cx="-12" cy="-3" r="7" fill="none" stroke="#121118" strokeWidth="2.2" />
              <circle cx="12" cy="-3" r="7" fill="none" stroke="#121118" strokeWidth="2.2" />
              <line x1="-5" y1="-3" x2="5" y2="-3" stroke="#121118" strokeWidth="2" />
              <circle cx="-12" cy="-3" r="3.2" fill="#121118" />
              <circle cx="12" cy="-3" r="3.2" fill="#121118" />
              <path d="M -5 10 Q 0 14 5 10" fill="none" stroke="#121118" strokeWidth="2.2" strokeLinecap="round" />
            </g>
          ) : faceStyle === 1 ? (
            /* Star Eyes / Wonder */
            <g>
              <polygon points="-12,-9 -10,-5 -6,-4 -10,-3 -12,1 -14,-3 -18,-4 -14,-5" fill="#121118" />
              <polygon points="12,-9 14,-5 18,-4 14,-3 12,1 10,-3 6,-4 10,-5" fill="#121118" />
              <path d="M -6 8 Q 0 16 6 8" fill="none" stroke="#121118" strokeWidth="2.6" strokeLinecap="round" />
            </g>
          ) : faceStyle === 2 ? (
            /* Cheerful Dot Eyes & Smile */
            <g>
              <circle cx="-12" cy="-4" r="4" fill="#121118" />
              <circle cx="12" cy="-4" r="4" fill="#121118" />
              <circle cx="-13" cy="-5.5" r="1.4" fill="#ffffff" />
              <circle cx="11" cy="-5.5" r="1.4" fill="#ffffff" />
              <path d="M -7 6 Q 0 14 7 6" fill="none" stroke="#121118" strokeWidth="2.6" strokeLinecap="round" />
            </g>
          ) : (
            /* Wink & Smirk */
            <g>
              <path d="M -16 -4 Q -12 -9 -8 -4" fill="none" stroke="#121118" strokeWidth="2.8" strokeLinecap="round" />
              <circle cx="12" cy="-4" r="4" fill="#121118" />
              <circle cx="11" cy="-5.5" r="1.4" fill="#ffffff" />
              <path d="M -6 8 Q 2 13 8 6" fill="none" stroke="#121118" strokeWidth="2.6" strokeLinecap="round" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
