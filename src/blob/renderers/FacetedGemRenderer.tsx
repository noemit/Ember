import * as React from 'react';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
};

const GEM_PALETTE = [
  { name: 'Emerald', base: '#00c853', light: '#69f0ae', mid: '#00e676', dark: '#00701a', stroke: '#b9f6ca' },
  { name: 'Amethyst', base: '#8e24aa', light: '#e1bee7', mid: '#ba68c8', dark: '#4a148c', stroke: '#f3e5f5' },
  { name: 'Cyan Beryl', base: '#00b4d8', light: '#90e0ef', mid: '#48cae4', dark: '#03045e', stroke: '#caf0f8' },
  { name: 'Ruby', base: '#d81159', light: '#ff8fa3', mid: '#ff4d6d', dark: '#70052b', stroke: '#ffccd5' },
  { name: 'Topaz', base: '#ffb703', light: '#ffea7a', mid: '#ffd166', dark: '#b07d00', stroke: '#fff3b0' },
  { name: 'Sapphire', base: '#2b59ff', light: '#99b8ff', mid: '#5e85ff', dark: '#0d2270', stroke: '#d6e2ff' },
];

const GEM_SHAPES = [
  // 0: Octagon Brilliant
  {
    outer: 'M 30 10 L 70 10 L 92 32 L 92 68 L 70 90 L 30 90 L 8 68 L 8 32 Z',
    table: 'M 36 24 L 64 24 L 78 38 L 78 62 L 64 76 L 36 76 L 22 62 L 22 38 Z',
    facets: [
      'M 30 10 L 36 24', 'M 70 10 L 64 24', 'M 92 32 L 78 38', 'M 92 68 L 78 62',
      'M 70 90 L 64 76', 'M 30 90 L 36 76', 'M 8 68 L 22 62', 'M 8 32 L 22 38',
    ],
  },
  // 1: Diamond Point
  {
    outer: 'M 50 8 L 92 48 L 50 92 L 8 48 Z',
    table: 'M 50 24 L 74 48 L 50 74 L 26 48 Z',
    facets: ['M 50 8 L 50 24', 'M 92 48 L 74 48', 'M 50 92 L 50 74', 'M 8 48 L 26 48'],
  },
  // 2: Marquise Seed
  {
    outer: 'M 50 6 C 78 28, 92 50, 92 60 C 92 78, 72 94, 50 94 C 28 94, 8 78, 8 60 C 8 50, 22 28, 50 6 Z',
    table: 'M 50 22 C 68 38, 76 54, 76 62 C 76 74, 62 82, 50 82 C 38 82, 24 74, 24 62 C 24 54, 32 38, 50 22 Z',
    facets: ['M 50 6 L 50 22', 'M 92 60 L 76 62', 'M 50 94 L 50 82', 'M 8 60 L 24 62'],
  },
  // 3: Prism Triangle
  {
    outer: 'M 50 8 L 92 88 L 8 88 Z',
    table: 'M 50 32 L 76 76 L 24 76 Z',
    facets: ['M 50 8 L 50 32', 'M 92 88 L 76 76', 'M 8 88 L 24 76'],
  },
];

export default function FacetedGemRenderer({ seed, size, state, interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const eyeRef = React.useRef<SVGGElement>(null);

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const shape = GEM_SHAPES[Math.floor(rng() * GEM_SHAPES.length)];
  const color = GEM_PALETTE[Math.floor(rng() * GEM_PALETTE.length)];
  const eyeType = Math.floor(rng() * 4); // 0: Pixel Glasses, 1: Pixel Glints, 2: Pixel Hearts, 3: Pixel Visor

  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';

  const breathDuration = (2.8 + ((seedHash >> 3) % 12) * 0.12).toFixed(2);
  const breathDelay = -(((seedHash >> 5) % 20) * 0.15).toFixed(2);

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el || !eyeRef.current) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 260 / dist);
      const tx = ((dx / dist) * 3.5 * reach).toFixed(2);
      const ty = ((dy / dist) * 3 * reach).toFixed(2);
      eyeRef.current.setAttribute('transform', `translate(${tx} ${ty})`);
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
      className={`blob-faceted-gem-svg blob-state-${state}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`facet-base-${seedHash}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color.mid} />
          <stop offset="60%" stopColor={color.base} />
          <stop offset="100%" stopColor={color.dark} />
        </linearGradient>
      </defs>

      {/* Ambient Shadow */}
      <ellipse cx="50" cy="94" rx="36" ry="5" fill="rgba(0,0,0,0.3)" />

      {/* Main Faceted Gem Body */}
      <g
        className="faceted-gem-body"
        style={state === 'idle' ? { animationDuration: `${breathDuration}s`, animationDelay: `${breathDelay}s` } : undefined}
      >
        {/* Outer Facet Base */}
        <path d={shape.outer} fill={`url(#facet-base-${seedHash})`} stroke={color.dark} strokeWidth="1.5" />

        {/* Inner Table Plane */}
        <path d={shape.table} fill={color.light} opacity="0.45" stroke={color.stroke} strokeWidth="1" />

        {/* Facet Edge Seams */}
        {shape.facets.map((f, i) => (
          <path key={i} d={f} stroke={color.stroke} strokeWidth="1.2" strokeOpacity="0.75" />
        ))}

        {/* Specular Diagonal Light Sheen Bars (Reference e26eb778) */}
        <polygon points="36,32 44,32 28,68 20,68" fill="#ffffff" opacity="0.4" />
        <polygon points="48,32 53,32 37,68 32,68" fill="#ffffff" opacity="0.3" />

        {/* Sparkling Star Glints on Facet Vertices */}
        <polygon points="24,20 26,24 30,25 26,26 24,30 22,26 18,25 22,24" fill="#ffffff" opacity="0.85" />
        <polygon points="76,28 77,31 80,32 77,33 76,36 75,33 72,32 75,31" fill="#ffffff" opacity="0.75" />

        {/* Cyber Pixel Eyes (Inspired by 64508875) */}
        <g ref={eyeRef} transform="translate(50 50)">
          {isError ? (
            /* Pixel XX Eyes */
            <g fill="#12121c">
              <rect x="-14" y="-6" width="3" height="3" />
              <rect x="-8" y="-6" width="3" height="3" />
              <rect x="-11" y="-3" width="3" height="3" />
              <rect x="-14" y="0" width="3" height="3" />
              <rect x="-8" y="0" width="3" height="3" />

              <rect x="8" y="-6" width="3" height="3" />
              <rect x="14" y="-6" width="3" height="3" />
              <rect x="11" y="-3" width="3" height="3" />
              <rect x="8" y="0" width="3" height="3" />
              <rect x="14" y="0" width="3" height="3" />
            </g>
          ) : isNeedsInput ? (
            /* Pixel Warning Visor */
            <g>
              <rect x="-16" y="-5" width="32" height="10" rx="3" fill="#12121c" />
              <rect x="-10" y="-3" width="6" height="6" fill="#ff4081" />
              <rect x="4" y="-3" width="6" height="6" fill="#ff4081" />
            </g>
          ) : eyeType === 0 ? (
            /* Cyber Pixel Sunglasses */
            <g fill="#12121a">
              <rect x="-18" y="-5" width="16" height="10" rx="2" />
              <rect x="2" y="-5" width="16" height="10" rx="2" />
              <rect x="-2" y="-4" width="4" height="3" />
              <rect x="-15" y="-3" width="4" height="4" fill="#ffffff" opacity="0.6" />
              <rect x="5" y="-3" width="4" height="4" fill="#ffffff" opacity="0.6" />
            </g>
          ) : eyeType === 1 ? (
            /* Cyber Dual Pixel Glints */
            <g fill="#12121a">
              <rect x="-14" y="-6" width="8" height="12" rx="2" />
              <rect x="6" y="-6" width="8" height="12" rx="2" />
              <rect x="-12" y="-4" width="4" height="4" fill="#ffffff" />
              <rect x="8" y="-4" width="4" height="4" fill="#ffffff" />
            </g>
          ) : eyeType === 2 ? (
            /* Pixel Hearts */
            <g fill="#ff2a6d">
              {/* Left Heart */}
              <rect x="-15" y="-6" width="4" height="3" />
              <rect x="-10" y="-6" width="4" height="3" />
              <rect x="-16" y="-3" width="11" height="4" />
              <rect x="-14" y="1" width="7" height="3" />
              <rect x="-12" y="4" width="3" height="2" />
              {/* Right Heart */}
              <rect x="6" y="-6" width="4" height="3" />
              <rect x="11" y="-6" width="4" height="3" />
              <rect x="5" y="-3" width="11" height="4" />
              <rect x="7" y="1" width="7" height="3" />
              <rect x="9" y="4" width="3" height="2" />
            </g>
          ) : (
            /* Pixel Visor / Wide Screen */
            <g>
              <rect x="-16" y="-5" width="32" height="10" rx="3" fill="#12121c" />
              <rect x="-12" y="-3" width="7" height="6" fill="#00f0ff" />
              <rect x="5" y="-3" width="7" height="6" fill="#00f0ff" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
