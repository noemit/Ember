import * as React from 'react';
import { deriveTraits, hashString, mulberry32 } from './seed';
import { GEM_COLORS } from './palette';
import { buildShape } from './shapes';
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

  const seedHash = hashString(seed);
  const traits = deriveTraits(seed);
  const color = GEM_COLORS[Math.abs(traits.colorIndex) % GEM_COLORS.length];
  const shape = buildShape(traits.shapeIndex, mulberry32((seedHash ^ 0x9e3779b9) >>> 0));
  const eyeShape = EYE_SHAPES[Math.abs(traits.eyeIndex) % EYE_SHAPES.length];
  const isError = state === 'error';

  React.useEffect(() => {
    if (!interactive) return;
    const onMove = (event: MouseEvent) => {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 260 / distance);
      const x = ((dx / distance) * 5 * reach).toFixed(2);
      const y = ((dy / distance) * 5 * reach).toFixed(2);
      const transform = `translate(${x} ${y})`;
      if (leftPupil.current) leftPupil.current.setAttribute('transform', transform);
      if (rightPupil.current) rightPupil.current.setAttribute('transform', transform);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [interactive]);

  const renderEye = (offsetX: number, pupilRef: React.RefObject<SVGCircleElement>) => (
    <g transform={`translate(${offsetX} 40)`}>
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
    <div className="gem-blob" data-state={state} ref={wrapperRef} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <radialGradient id={gradientId} cx="38%" cy="32%" r="80%">
            <stop offset="0%" stopColor={color.light} />
            <stop offset="55%" stopColor={color.base} />
            <stop offset="100%" stopColor={color.dark} />
          </radialGradient>
        </defs>

        <path
          className="gem-body"
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

        <g className="gem-eyes">
          {renderEye(-11, leftPupil)}
          {renderEye(11, rightPupil)}
        </g>
      </svg>
    </div>
  );
}
