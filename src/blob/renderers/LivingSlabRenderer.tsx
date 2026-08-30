import * as React from 'react';
import { hashString, mulberry32 } from '../seed';
import { SLAB_PALETTE } from './LivingSlabFace';
import LivingSlabFace from './LivingSlabFace';
import type { BallState } from '../../types';

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
  title?: string;
  preview?: string;
};

export default function LivingSlabRenderer({
  seed,
  size,
  state,
  interactive = true,
  title,
  preview,
}: Props) {
  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);
  const color = SLAB_PALETTE[Math.floor(rng() * SLAB_PALETTE.length)];

  const displayTitle = title ?? seed;
  const displayPreview = preview ?? (state === 'active' ? 'Scanning files & running build…' : state === 'needs-input' ? 'Waiting for your review…' : 'Session active and ready');

  // If rendered at small square avatar size (e.g. 44px/64px), render the self-contained square slab
  const isMini = size <= 64;

  if (isMini) {
    return (
      <div
        className="living-slab-mini"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
          background: color.bg,
          border: `1.5px solid ${color.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 12px ${color.bg}80`,
          overflow: 'hidden',
          flex: 'none',
        }}
      >
        <LivingSlabFace seed={seed} size={size * 0.9} state={state} interactive={interactive} />
      </div>
    );
  }

  // Full-width Living Slab Card
  return (
    <div
      className="living-slab-card"
      style={{
        width: '100%',
        minHeight: 64,
        padding: '10px 14px',
        borderRadius: 12,
        background: color.bg,
        border: `1.5px solid ${color.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: `0 6px 18px ${color.bg}90`,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Embedded Character Face on the Left */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LivingSlabFace seed={seed} size={48} state={state} interactive={interactive} />
      </div>

      {/* Spanning Typography integrated into the Slab */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: color.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayTitle}
        </span>
        <span
          style={{
            fontSize: 11.5,
            color: color.textDim,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayPreview}
        </span>
      </div>

      {/* State Badge on the Right */}
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          padding: '3px 8px',
          borderRadius: 6,
          background: state === 'active' ? color.accent : state === 'needs-input' ? '#ff4081' : state === 'error' ? '#ff5c5c' : 'rgba(255,255,255,0.12)',
          color: state === 'active' || state === 'needs-input' || state === 'error' ? '#ffffff' : color.textDim,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          flex: 'none',
        }}
      >
        {state}
      </div>
    </div>
  );
}
