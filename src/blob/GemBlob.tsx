import * as React from 'react';
import { deriveTraits, hashString, mulberry32 } from './seed';
import { GEM_COLORS } from './palette';
import { buildShape } from './shapes';
import { usePupilTracking } from './usePupilTracking';
import type { BallState } from '../types';
import './blob.css';

type Props = {
  seed: string;
  size?: number;
  state?: BallState;
  interactive?: boolean;
};

const EYE_SHAPES = ['round', 'almond', 'tall'] as const;

export default function GemBlob({ seed, size = 30, state = 'idle', interactive = true }: Props) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const leftPupil = React.useRef<SVGCircleElement>(null);
  const rightPupil = React.useRef<SVGCircleElement>(null);
  const gradientId = `gem-${React.useId().replace(/[:]/g, '')}`;

  const { color, shape, eyeShape } = React.useMemo(() => {
    const seedHash = hashString(seed);
    const traits = deriveTraits(seed);
    return {
      color: GEM_COLORS[Math.abs(traits.colorIndex) % GEM_COLORS.length],
      shape: buildShape(traits.shapeIndex, mulberry32((seedHash ^ 0x9e3779b9) >>> 0)),
      eyeShape: EYE_SHAPES[Math.abs(traits.eyeIndex) % EYE_SHAPES.length],
    };
  }, [seed]);
  const isError = state === 'error';

  usePupilTracking(wrapperRef, [leftPupil, rightPupil], interactive && !isError, 5);

  const renderEye = (offsetX: number, pupilRef: React.RefObject<SVGCircleElement | null>) => (
    <g transform={`translate(${50 + offsetX} 42)`}>
      {eyeShape === 'round' && <circle r={8} fill="#fbfbff" />}
      {eyeShape === 'almond' && <ellipse rx={9.5} ry={7} fill="#fbfbff" />}
      {eyeShape === 'tall' && <rect x={-6} y={-9} width={12} height={18} rx={6} fill="#fbfbff" />}
      {isError ? (
        <g stroke="#3a0d0d" strokeWidth={1.6} strokeLinecap="round">
          <line x1={-4} y1={-4} x2={4} y2={4} />
          <line x1={-4} y1={4} x2={4} y2={-4} />
        </g>
      ) : (
        <circle ref={pupilRef} r={4.2} fill="#16130f" />
      )}
    </g>
  );

  return (
    <div className="blob blob-gem" data-state={state} ref={wrapperRef} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id={gradientId} cx="38%" cy="32%" r="80%">
            <stop offset="0%" stopColor={color.light} />
            <stop offset="55%" stopColor={color.base} />
            <stop offset="100%" stopColor={color.dark} />
          </radialGradient>
        </defs>

        <g className="blob-body">
          <path
            d={shape.body}
            fill={`url(#${gradientId})`}
            stroke={color.edge}
            strokeWidth={2}
            strokeLinejoin="round"
          />

          <g stroke={color.light} strokeOpacity={0.45} strokeWidth={0.8} fill="none">
            {shape.facets.map((facet, index) => (
              <path key={index} d={facet} />
            ))}
          </g>

          {isError && <circle cx={50} cy={50} r={46} fill="rgba(255,90,90,0.32)" />}
        </g>

        <g className="blob-eyes">
          {renderEye(-11, leftPupil)}
          {renderEye(11, rightPupil)}
        </g>
      </svg>
    </div>
  );
}
