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

  const renderEye = (offsetX: number, pupilRef: React.RefObject<SVGCircleElement>, isLeft: boolean) => (
    <g transform={`translate(${offsetX} 48)`}>
      {/* Outer eye white / sclera - large, expressive anime/grokbot/poring style */}
      {eyeShape === 'round' && <ellipse rx={12.5} ry={14} fill="#ffffff" stroke={color.dark} strokeWidth={1.2} />}
      {eyeShape === 'almond' && <ellipse rx={14} ry={12} fill="#ffffff" stroke={color.dark} strokeWidth={1.2} />}
      {eyeShape === 'tall' && <rect x={-11} y={-15} width={22} height={30} rx={11} fill="#ffffff" stroke={color.dark} strokeWidth={1.2} />}

      {isError ? (
        <g stroke="#3a0d0d" strokeWidth={2.5} strokeLinecap="round">
          <line x1={-6} y1={-6} x2={6} y2={6} />
          <line x1={-6} y1={6} x2={6} y2={-6} />
        </g>
      ) : (
        <g>
          {/* Main large pupil / iris */}
          <ellipse ref={pupilRef} rx={7.5} ry={9} fill="#141419" />
          
          {/* Big primary sparkle highlight (top-left) */}
          <circle cx={isLeft ? -3.5 : -3.5} cy={-4} r={3.2} fill="#ffffff" />
          
          {/* Cute secondary bottom sparkle highlight */}
          <circle cx={isLeft ? 2.5 : 2.5} cy={3.5} r={1.6} fill="#ffffff" opacity={0.85} />
        </g>
      )}
    </g>
  );

  return (
    <div className="gem-blob" data-state={state} ref={wrapperRef} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <radialGradient id={gradientId} cx="35%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.85} />
            <stop offset="20%" stopColor={color.light} />
            <stop offset="65%" stopColor={color.base} />
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

        {/* Polished cabochon sheen & contour lines */}
        <g stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1} fill="none">
          {shape.facets.map((facet, index) => (
            <path key={index} d={facet} />
          ))}
        </g>

        {/* Glossy top-left primary specular highlight ellipse */}
        <ellipse
          cx={shape.highlight.cx}
          cy={shape.highlight.cy}
          rx={shape.highlight.rx}
          ry={shape.highlight.ry}
          fill="#ffffff"
          opacity={0.48}
          transform={shape.highlight.transform}
        />

        {/* Secondary soft rim highlight */}
        {shape.shine && <path d={shape.shine} stroke="#ffffff" strokeWidth={1.5} strokeLinecap="round" opacity={0.4} fill="none" />}

        {isError && <circle cx={50} cy={50} r={46} fill="rgba(255,90,90,0.32)" />}

        <g className="gem-eyes">
          {renderEye(-16, leftPupil, true)}
          {renderEye(16, rightPupil, false)}
        </g>
      </svg>
    </div>
  );
}
