import { GLYPH_COLORS } from './contrast';
import { GEM_COLORS } from './palette';
import { GROK_COLORS } from './grok';
import { deriveTraits, hashString, mulberry32, seedIdentity } from './seed';
import type { AvatarIdentity, BlobStyle } from '../types';

/**
 * The dominant colour of the blob a seed renders in the given style, as a CSS colour, so UI
 * around a session (e.g. the activity dot) can pick up its identity. Each branch consumes the
 * RNG in the same order as the matching renderer, so this stays in lockstep with what's drawn.
 */
export const blobColor = (style: BlobStyle, seedOrIdentity: string | AvatarIdentity): string => {
  const identity = typeof seedOrIdentity === 'string' ? seedIdentity(seedOrIdentity) : seedOrIdentity;
  switch (style) {
    case 'critter': {
      const rng = mulberry32(hashString(`critter:${identity.colorSeed}`));
      for (let roll = 0; roll < 8; roll += 1) rng();
      const index = identity.colorIndex ?? Math.floor(rng() * 12);
      return `var(--critter-${Math.abs(index) % 12})`;
    }
    case 'glyph': {
      const rng = mulberry32(hashString(`glyph:${identity.colorSeed}`));
      rng();
      const index = identity.colorIndex ?? Math.floor(rng() * GLYPH_COLORS.length);
      return `var(--glyph-${Math.abs(index) % GLYPH_COLORS.length})`;
    }
    case 'gem': {
      const index = identity.colorIndex ?? deriveTraits(identity.colorSeed).colorIndex;
      return GEM_COLORS[Math.abs(index) % GEM_COLORS.length].base;
    }
    default: {
      const rng = mulberry32(hashString(`grok:${identity.colorSeed}`));
      const groupedColor = Boolean(identity.projectKey || identity.colorIndex !== undefined);
      const index = identity.colorIndex ?? Math.floor(
        rng() * (groupedColor ? GLYPH_COLORS.length : GROK_COLORS.length)
      );
      return groupedColor
        ? `var(--glyph-${Math.abs(index) % GLYPH_COLORS.length})`
        : GROK_COLORS[Math.abs(index) % GROK_COLORS.length].fill;
    }
  }
};
