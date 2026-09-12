import * as React from 'react';
import { hashString, mulberry32, seedIdentity } from './seed';
import { GLYPH_COLORS } from './contrast';
import { BUDDY_COLORS, BUDDY_SHAPES } from './buddy';
import { usePupilTracking } from './usePupilTracking';
import type { AvatarIdentity, BallMood, BallState } from '../types';
import './blob.css';

type Props = {
  seed: string;
  identity?: AvatarIdentity;
  size?: number;
  /** Kept for callers that only know the coarse state; `mood` is what drives the visuals. */
  state?: BallState;
  mood?: BallMood;
  interactive?: boolean;
};

/** Badge/accent colour per mood. */
const accentFor = (mood: BallMood): string => {
  if (mood === 'input') return 'var(--warning)';
  if (mood === 'error') return 'var(--destructive)';
  return 'var(--highlight)';
};

export default function BuddyBlob({ seed, identity, size = 30, mood = 'idle', interactive = true }: Props) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const leftPupil = React.useRef<SVGGElement>(null);
  const rightPupil = React.useRef<SVGGElement>(null);

  const { color, shape, tilt, wobbleDelay, flipDelay, flipDuration } = React.useMemo(() => {
    const resolved = identity ?? seedIdentity(seed);
    const colorRng = mulberry32(hashString(`buddy:${resolved.colorSeed}`));
    const shapeRng = mulberry32(hashString(`buddy:${resolved.shapeSeed}`));
    const motionRng = mulberry32(hashString(`buddy:${resolved.motionSeed}`));
    shapeRng();
    motionRng();
    motionRng();
    const groupedColor = Boolean(resolved.projectKey || resolved.colorIndex !== undefined);
    const colorIndex = resolved.colorIndex ?? Math.floor(
      colorRng() * (groupedColor ? GLYPH_COLORS.length : BUDDY_COLORS.length)
    );
    const baseColor = BUDDY_COLORS[Math.abs(colorIndex) % BUDDY_COLORS.length];
    return {
      color: groupedColor
        ? { ...baseColor, fill: `var(--glyph-${Math.abs(colorIndex) % GLYPH_COLORS.length})` }
        : baseColor,
      shape:
        BUDDY_SHAPES.find((entry) => entry.name === resolved.shapeName) ??
        BUDDY_SHAPES[Math.floor(shapeRng() * BUDDY_SHAPES.length)],
      tilt: Math.round((motionRng() - 0.5) * 16),
      wobbleDelay: -(motionRng() * 4).toFixed(2),
      // Busy blobs flip once every ~9–16s; the negative delay spreads them out so a busy list
      // never somersaults in unison.
      flipDelay: -(motionRng() * 16).toFixed(2),
      flipDuration: (9 + motionRng() * 7).toFixed(2),
    };
  }, [identity, seed]);

  const isError = mood === 'error';
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

  const accent = accentFor(mood);

  return (
    <div
      className="blob blob-buddy"
      data-mood={mood}
      aria-hidden="true"
      ref={wrapperRef}
      style={{ width: size, height: size, animationDelay: `${wobbleDelay}s` }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
        <g className="blob-hop" style={{ animationDelay: `${wobbleDelay}s` }}>
          <g
            className="blob-flip"
            style={{ animationDuration: `${flipDuration}s`, animationDelay: `${flipDelay}s` }}
          >
            <g className="blob-body" transform={`rotate(${tilt} 50 50)`}>
              <path d={shape.path} fill={color.fill} />
            </g>
            <g className="blob-eyes" style={{ animationDelay: `${wobbleDelay}s` }}>
              {renderEye(-shape.eyeGap, leftPupil)}
              {renderEye(shape.eyeGap, rightPupil)}
            </g>
          </g>
        </g>

        {mood === 'thinking' ? (
          <circle
            className="blob-arc"
            cx={50}
            cy={50}
            r={48}
            fill="none"
            stroke={accent}
            strokeWidth={3}
            strokeDasharray="64 238"
            strokeLinecap="round"
            opacity={0.9}
          />
        ) : null}

        {mood === 'input' ? (
          <g className="blob-badge">
            <circle cx={78} cy={22} r={16} fill={accent} stroke="var(--background)" strokeWidth={3} />
            <path d="M73 21 v-3 a5 5 0 0 1 10 0 v3" fill="none" stroke="#ffffff" strokeWidth={2.8} strokeLinecap="round" />
            <rect x={70} y={20.5} width={16} height={12.5} rx={3} fill="#ffffff" />
            <circle cx={78} cy={26.5} r={1.8} fill={accent} />
          </g>
        ) : null}

        {mood === 'question' ? (
          <g className="blob-badge">
            <circle cx={78} cy={22} r={16} fill={accent} stroke="var(--background)" strokeWidth={3} />
            <text x={78} y={29} textAnchor="middle" fontSize={21} fontWeight={700} fill="#ffffff">
              ?
            </text>
          </g>
        ) : null}

        {mood === 'error' ? (
          <g className="blob-badge">
            <path d="M78 4 L97 37 H59 Z" fill={accent} stroke="var(--background)" strokeWidth={3} strokeLinejoin="round" />
            <text x={78} y={32} textAnchor="middle" fontSize={20} fontWeight={700} fill="#ffffff">
              !
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
