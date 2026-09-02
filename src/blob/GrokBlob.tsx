import * as React from 'react';
import { hashString, mulberry32 } from './seed';
import { GROK_COLORS, GROK_SHAPES } from './grok';
import { usePupilTracking } from './usePupilTracking';
import type { BallState } from '../types';
import './blob.css';

type Props = {
  seed: string;
  size?: number;
  state?: BallState;
  interactive?: boolean;
};

export default function GrokBlob({ seed, size = 30, state = 'idle', interactive = true }: Props) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const leftPupil = React.useRef<SVGCircleElement>(null);
  const rightPupil = React.useRef<SVGCircleElement>(null);

  const { color, shape, tilt, wobbleDelay } = React.useMemo(() => {
    const rng = mulberry32(hashString(`grok:${seed}`));
    return {
      color: GROK_COLORS[Math.floor(rng() * GROK_COLORS.length)],
      shape: GROK_SHAPES[Math.floor(rng() * GROK_SHAPES.length)],
      tilt: Math.round((rng() - 0.5) * 16),
      wobbleDelay: -(rng() * 4).toFixed(2),
    };
  }, [seed]);

  const isError = state === 'error';
  usePupilTracking(wrapperRef, [leftPupil, rightPupil], interactive && !isError, 3.2);

  const renderEye = (offsetX: number, pupilRef: React.RefObject<SVGCircleElement | null>) => (
    <g transform={`translate(${shape.eyeX + offsetX} ${shape.eyeY}) scale(${shape.eyeScale})`}>
      <ellipse rx={6.5} ry={7.5} fill="#ffffff" />
      {isError ? (
        <g stroke={color.ink} strokeWidth={2} strokeLinecap="round">
          <line x1={-3.2} y1={-3.2} x2={3.2} y2={3.2} />
          <line x1={-3.2} y1={3.2} x2={3.2} y2={-3.2} />
        </g>
      ) : (
        <circle ref={pupilRef} r={3.4} fill={color.ink} />
      )}
    </g>
  );

  return (
    <div
      className="blob blob-grok"
      data-state={state}
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
