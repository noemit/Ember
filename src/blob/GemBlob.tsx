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
      {/* Outer eye white / sclera - anime/grokbot/poring style with eyelash accent */}
      {eyeShape === 'round' && <ellipse rx={10} ry={11.5} fill="#ffffff" stroke={color.dark} strokeWidth={1.2} />}
      {eyeShape === 'almond' && <ellipse rx={11} ry={9.5} fill="#ffffff" stroke={color.dark} strokeWidth={1.2} />}
      {eyeShape === 'tall' && <rect x={-8.5} y={-11.5} width={17} height={23} rx={8.5} fill="#ffffff" stroke={color.dark} strokeWidth={1.2} />}

      {/* Cute top eyelid / eyelash line */}
      <path
        d={isLeft ? "M -9 -8 Q 0 -13 9 -7" : "M -9 -7 Q 0 -13 9 -8"}
        fill="none"
        stroke="#1c1618"
        strokeWidth={1.8}
        strokeLinecap="round"
      />

      {isError ? (
        <g stroke="#3a0d0d" strokeWidth={2.5} strokeLinecap="round">
          <line x1={-5} y1={-5} x2={5} y2={5} />
          <line x1={-5} y1={5} x2={5} y2={-5} />
        </g>
      ) : (
        <g>
          {/* Main iris/pupil gradient - rich anime eye depth */}
          <ellipse ref={pupilRef} rx={6} ry={7.5} fill="#181320" />
          
          {/* Inner iris gradient tint */}
          <ellipse cx={0} cy={2} rx={4.5} ry={4.5} fill={color.light} opacity={0.65} />
          
          {/* Pupil center */}
          <circle cx={0} cy={1} r={2.5} fill="#0d0a10" />

          {/* Big primary sparkle highlight (top-left) */}
          <circle cx={-2.2} cy={-3.2} r={2.6} fill="#ffffff" />
          
          {/* Cute secondary bottom-right sparkle highlight */}
          <circle cx={2.2} cy={2.8} r={1.4} fill="#ffffff" opacity={0.9} />
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
          {renderEye(-10, leftPupil, true)}
          {renderEye(10, rightPupil, false)}
        </g>

        {/* Cute blush cheeks under the eyes like Poring / anime characters */}
        <ellipse cx={27} cy={57} rx={5} ry={2.5} fill="#ff4d79" opacity={0.35} />
        <ellipse cx={73} cy={57} rx={5} ry={2.5} fill="#ff4d79" opacity={0.35} />
      </svg>
    </div>
  );
}
