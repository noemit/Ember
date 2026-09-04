import * as React from 'react';
import { hashString, mulberry32, seedIdentity } from './seed';
import { GLYPH_COLORS } from './contrast';
import { GROK_COLORS, GROK_SHAPES } from './grok';
import { usePupilTracking } from './usePupilTracking';
import type { AvatarIdentity, BallState } from '../types';
import './blob.css';

type Props = {
  seed: string;
  identity?: AvatarIdentity;
  size?: number;
  state?: BallState;
  interactive?: boolean;
};

export default function GrokBlob({ seed, identity, size = 30, state = 'idle', interactive = true }: Props) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const leftPupil = React.useRef<SVGGElement>(null);
  const rightPupil = React.useRef<SVGGElement>(null);

  const { color, shape, tilt, wobbleDelay } = React.useMemo(() => {
    const resolved = identity ?? seedIdentity(seed);
    const colorRng = mulberry32(hashString(`grok:${resolved.colorSeed}`));
    const shapeRng = mulberry32(hashString(`grok:${resolved.shapeSeed}`));
    const motionRng = mulberry32(hashString(`grok:${resolved.motionSeed}`));
    shapeRng();
    motionRng();
    motionRng();
    const groupedColor = Boolean(resolved.projectKey || resolved.colorIndex !== undefined);
    const colorIndex = resolved.colorIndex ?? Math.floor(
      colorRng() * (groupedColor ? GLYPH_COLORS.length : GROK_COLORS.length)
    );
    const baseColor = GROK_COLORS[Math.abs(colorIndex) % GROK_COLORS.length];
    return {
      color: groupedColor
        ? { ...baseColor, fill: `var(--glyph-${Math.abs(colorIndex) % GLYPH_COLORS.length})` }
        : baseColor,
      shape:
        GROK_SHAPES.find((entry) => entry.name === resolved.shapeName) ??
        GROK_SHAPES[Math.floor(shapeRng() * GROK_SHAPES.length)],
      tilt: Math.round((motionRng() - 0.5) * 16),
      wobbleDelay: -(motionRng() * 4).toFixed(2),
    };
  }, [identity, seed]);

  const isError = state === 'error';
  usePupilTracking(wrapperRef, [leftPupil, rightPupil], interactive && !isError, 5.5);

  const renderEye = (offsetX: number, pupilRef: React.RefObject<SVGGElement | null>) => (
    <g transform={`translate(${shape.eyeX + offsetX} ${shape.eyeY}) scale(${shape.eyeScale})`}>
      <ellipse rx={12} ry={13.5} fill="#ffffff" />
      {isError ? (
        <g stroke={color.ink} strokeWidth={3} strokeLinecap="round">
          <line x1={-5.5} y1={-5.5} x2={5.5} y2={5.5} />
          <line x1={-5.5} y1={5.5} x2={5.5} y2={-5.5} />
        </g>
      ) : (
        <g ref={pupilRef} className="blob-pupil">
          <circle r={6.5} fill={color.ink} />
          <circle cx={-2.2} cy={-2.4} r={2} fill="#ffffff" />
        </g>
      )}
    </g>
  );

  return (
    <div
      className="blob blob-grok"
      data-state={state}
      aria-hidden="true"
      ref={wrapperRef}
      style={{ width: size, height: size, animationDelay: `${wobbleDelay}s` }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
        <g className="blob-body" transform={`rotate(${tilt} 50 50)`}>
          <path d={shape.path} fill={color.fill} />
          {isError && <path d={shape.path} fill="rgba(0,0,0,0.28)" />}
        </g>
        <g className="blob-eyes">
          {renderEye(-shape.eyeGap, leftPupil)}
          {renderEye(shape.eyeGap, rightPupil)}
        </g>
      </svg>
    </div>
  );
}
