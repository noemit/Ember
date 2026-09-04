import * as React from 'react';
import { hashString, mulberry32, seedIdentity } from './seed';
import { GLYPHS } from './glyphs';
import { GLYPH_COLORS } from './contrast';
import type { AvatarIdentity, BallState } from '../types';
import './blob.css';

type Props = {
  seed: string;
  identity?: AvatarIdentity;
  size?: number;
  state?: BallState;
  interactive?: boolean;
};

const ERROR_INK = '#8a8f9c';

export default function GlyphBlob({ seed, identity, size = 30, state = 'idle' }: Props) {
  // useId contains colons, which are illegal in SVG id references.
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');

  const { glyph, colorIndex, tilt, wobbleDelay } = React.useMemo(() => {
    const resolved = identity ?? seedIdentity(seed);
    const shapeRng = mulberry32(hashString(`glyph:${resolved.shapeSeed}`));
    const colorRng = mulberry32(hashString(`glyph:${resolved.colorSeed}`));
    const motionRng = mulberry32(hashString(`glyph:${resolved.motionSeed}`));
    colorRng();
    motionRng();
    motionRng();
    return {
      glyph:
        GLYPHS.find((entry) => entry.name === resolved.shapeName) ??
        GLYPHS[Math.floor(shapeRng() * GLYPHS.length)],
      colorIndex:
        Math.abs(resolved.colorIndex ?? Math.floor(colorRng() * GLYPH_COLORS.length)) %
        GLYPH_COLORS.length,
      tilt: Math.round((motionRng() - 0.5) * 24),
      wobbleDelay: -(motionRng() * 4).toFixed(2),
    };
  }, [identity, seed]);

  const isError = state === 'error';
  // The actual colour lives in a theme-set CSS variable (see themes.ts) so it has been
  // contrast-adjusted for the current surfaces; the markup just inherits it via currentColor.
  const ink = isError ? ERROR_INK : `var(--glyph-${colorIndex})`;
  const body = React.useMemo(
    () => glyph.body.replaceAll('{c}', 'currentColor').replaceAll('{id}', uid),
    [glyph, uid]
  );

  return (
    <div
      className="blob blob-glyph"
      data-state={state}
      aria-hidden="true"
      style={{ width: size, height: size, animationDelay: `${wobbleDelay}s` }}
      title={glyph.name}
    >
      {/* The source icons leave a ~4px margin in their 48 box; crop it so glyphs fill the slot like the other styles. */}
      <svg viewBox="3 3 42 42" width={size} height={size} style={{ overflow: 'visible' }}>
        <g
          className="blob-body"
          fill="currentColor"
          style={{ color: ink }}
          transform={`rotate(${tilt} 24 24)`}
          // Static markup from ./glyphs.ts, not user content.
          dangerouslySetInnerHTML={{ __html: body }}
        />
        {isError ? <circle cx={40} cy={40} r={6} fill="#E8542E" stroke="var(--background)" strokeWidth={2} /> : null}
      </svg>
    </div>
  );
}
