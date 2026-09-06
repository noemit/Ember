import { GLYPH_COLORS } from './contrast';
import { GROK_COLORS } from './grok';
import { hashString, mulberry32, seedIdentity } from './seed';
import type { AvatarIdentity, BlobStyle } from '../types';

/**
 * The dominant colour of the blob a seed renders in the given style, as a CSS colour, so UI
 * around a session (e.g. the activity dot) can pick up its identity. Each branch consumes the
 * RNG in the same order as the matching renderer, so this stays in lockstep with what's drawn.
 */
export const blobColor = (style: BlobStyle, seedOrIdentity: string | AvatarIdentity): string => {
  const identity = typeof seedOrIdentity === 'string' ? seedIdentity(seedOrIdentity) : seedOrIdentity;
  switch (style) {
    case 'glyph': {
      const rng = mulberry32(hashString(`glyph:${identity.colorSeed}`));
      rng();
      const index = identity.colorIndex ?? Math.floor(rng() * GLYPH_COLORS.length);
      return `var(--glyph-${Math.abs(index) % GLYPH_COLORS.length})`;
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
