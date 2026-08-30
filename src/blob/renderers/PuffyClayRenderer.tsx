import * as React from 'react';
import { PUFFY_CLAY_PALETTE } from '../palette';
import { PUFFY_CLAY_SHAPES } from '../shapes';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

type ActiveAction = 'bounce' | 'search' | 'backflip' | 'shimmy' | 'curious-lean';

const ACTIVE_ACTIONS: ActiveAction[] = ['bounce', 'search', 'backflip', 'shimmy', 'curious-lean'];

type Props = {
  seed: string;
  size: number;
  state: BallState;
  interactive?: boolean;
  shapeIndex?: number;
  colorIndex?: number;
};

export default function PuffyClayRenderer({
  seed,
  size,
  state,
  interactive = true,
  shapeIndex: explicitShapeIndex,
  colorIndex: explicitColorIndex,
}: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const leftPupilRef = React.useRef<SVGGElement>(null);
  const rightPupilRef = React.useRef<SVGGElement>(null);

  const uid = React.useId().replace(/[:]/g, '');
  const bodyGradId = `puffy-body-${uid}`;
  const eyeGradId = `puffy-eye-${uid}`;
  const floorShadowId = `puffy-floor-${uid}`;
  const auraGlowId = `puffy-aura-${uid}`;
  const alertBadgeGradId = `puffy-badge-${uid}`;
  const clipLeftId = `eye-clip-l-${uid}`;
  const clipRightId = `eye-clip-r-${uid}`;

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const derivedShapeIndex = Math.floor(rng() * PUFFY_CLAY_SHAPES.length);
  const derivedColorIndex = Math.floor(rng() * PUFFY_CLAY_PALETTE.length);
  const eyeStyle = Math.floor(rng() * 4); // 0: Classic Glossy, 1: Anime Sparkle, 2: Kawaii Round, 3: Deep Wonder

  const shapeIdx = explicitShapeIndex !== undefined ? explicitShapeIndex % PUFFY_CLAY_SHAPES.length : derivedShapeIndex;
  const colorIdx = explicitColorIndex !== undefined ? explicitColorIndex % PUFFY_CLAY_PALETTE.length : derivedColorIndex;

  const shape = PUFFY_CLAY_SHAPES[shapeIdx];
  const color = PUFFY_CLAY_PALETTE[colorIdx];
  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';
  const isActive = state === 'active';

  // Procedural Active Action State Machine
  const [activeAction, setActiveAction] = React.useState<ActiveAction>('bounce');
  const [searchTarget, setSearchTarget] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Procedural Action Loop when Active
  React.useEffect(() => {
    if (!isActive) return;

    let timer: number | undefined;
    let scanTimer: number | undefined;
    let currentAction: ActiveAction = 'bounce';

    const pickNextAction = () => {
      const pool = ACTIVE_ACTIONS.filter((a) => a !== currentAction);
      const next = pool[Math.floor(Math.random() * pool.length)];
      currentAction = next;
      setActiveAction(next);

      if (next === 'search') {
        const scan = () => {
          const sx = (Math.random() - 0.5) * 8;
          const sy = (Math.random() - 0.5) * 6;
          setSearchTarget({ x: sx, y: sy });
        };
        scan();
        scanTimer = window.setInterval(scan, 350);
      } else {
        if (scanTimer) {
          window.clearInterval(scanTimer);
          scanTimer = undefined;
        }
        setSearchTarget({ x: 0, y: 0 });
      }

      const duration = 1200 + Math.random() * 1200;
      timer = window.setTimeout(pickNextAction, duration);
    };

    pickNextAction();

    return () => {
      if (timer) window.clearTimeout(timer);
      if (scanTimer) window.clearInterval(scanTimer);
    };
  }, [isActive]);

  // Mouse cursor tracking
  React.useEffect(() => {
    if (!interactive) return;

    const onMove = (event: MouseEvent) => {
      if (isActive && activeAction === 'search') return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 280 / dist);
      const tx = ((dx / dist) * 4.2 * reach).toFixed(2);
      const ty = ((dy / dist) * 3.6 * reach).toFixed(2);
      const transform = `translate(${tx} ${ty})`;
      if (leftPupilRef.current) leftPupilRef.current.setAttribute('transform', transform);
      if (rightPupilRef.current) rightPupilRef.current.setAttribute('transform', transform);
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [interactive, isActive, activeAction]);

  // Update pupil position when active action is search
  React.useEffect(() => {
    if (isActive && activeAction === 'search') {
      const transform = `translate(${searchTarget.x.toFixed(2)} ${searchTarget.y.toFixed(2)})`;
      if (leftPupilRef.current) leftPupilRef.current.setAttribute('transform', transform);
      if (rightPupilRef.current) rightPupilRef.current.setAttribute('transform', transform);
    }
  }, [isActive, activeAction, searchTarget]);

  const eyeY = shape.eyeY;
  const spacing = shape.eyeSpacing;
  const eyeR = shape.eyeRadius;
  const naturalMouthY = eyeY + eyeR * 0.92;

  const renderPupil = (ref: React.RefObject<SVGGElement>) => {
    if (isError) {
      return (
        <g stroke="#1a1824" strokeWidth="3.2" strokeLinecap="round" className="clay-error-x">
          <line x1={-eyeR * 0.55} y1={-eyeR * 0.55} x2={eyeR * 0.55} y2={eyeR * 0.55} />
          <line x1={-eyeR * 0.55} y1={eyeR * 0.55} x2={eyeR * 0.55} y2={-eyeR * 0.55} />
        </g>
      );
    }

    if (eyeStyle === 1) {
      // Style 1: Anime Star Sparkle Pupil
      return (
        <g ref={ref} className="clay-pupil-group">
          <ellipse cx="0" cy="0" rx={eyeR * 0.58} ry={eyeR * 0.64} fill="#12111a" />
          <ellipse cx="0" cy={eyeR * 0.22} rx={eyeR * 0.44} ry={eyeR * 0.32} fill={color.base} opacity="0.85" />
          <circle cx={-eyeR * 0.22} cy={-eyeR * 0.25} r={eyeR * 0.22} fill="#ffffff" />
          <circle cx={eyeR * 0.2} cy={eyeR * 0.22} r={eyeR * 0.12} fill="#ffffff" opacity="0.9" />
          <circle cx={-eyeR * 0.18} cy={eyeR * 0.26} r={eyeR * 0.08} fill="#ffffff" opacity="0.85" />
        </g>
      );
    }

    if (eyeStyle === 2) {
      // Style 2: Soft Kawaii Round Pupil
      return (
        <g ref={ref} className="clay-pupil-group">
          <circle cx="0" cy="0" r={eyeR * 0.52} fill="#151420" />
          <circle cx={-eyeR * 0.18} cy={-eyeR * 0.18} r={eyeR * 0.2} fill="#ffffff" />
          <circle cx={eyeR * 0.16} cy={eyeR * 0.16} r={eyeR * 0.1} fill="#ffffff" opacity="0.9" />
        </g>
      );
    }

    if (eyeStyle === 3) {
      // Style 3: Deep Wonder Large Eye
      return (
        <g ref={ref} className="clay-pupil-group">
          <circle cx="0" cy="0" r={eyeR * 0.6} fill="#101018" />
          <circle cx={-eyeR * 0.22} cy={-eyeR * 0.24} r={eyeR * 0.24} fill="#ffffff" />
          <circle cx={eyeR * 0.22} cy={eyeR * 0.22} r={eyeR * 0.12} fill="#ffffff" opacity="0.95" />
        </g>
      );
    }

    // Default Style 0: Classic 3D Glossy Googly (Reference 05dcb78b151b13d955554fa4fc249a7b.jpg)
    return (
      <g ref={ref} className="clay-pupil-group">
        <circle cx="0" cy="0" r={eyeR * 0.54} fill="#13131d" />
        <circle cx={-eyeR * 0.2} cy={-eyeR * 0.2} r={eyeR * 0.22} fill="#ffffff" />
        <circle cx={eyeR * 0.18} cy={eyeR * 0.18} r={eyeR * 0.11} fill="#ffffff" opacity="0.9" />
      </g>
    );
  };

  const renderEye = (offsetX: number, pupilRef: React.RefObject<SVGGElement>, isLeft: boolean) => {
    const clipId = isLeft ? clipLeftId : clipRightId;

    return (
      <g transform={`translate(${offsetX} 0)`} className="clay-eyeball-unit">
        {/* 3D Eyeball Cast Shadow */}
        <ellipse cx="0" cy="4" rx={eyeR + 1.2} ry={eyeR * 0.88} fill="rgba(0, 0, 0, 0.22)" />

        {/* 3D White Spherical Eyeball */}
        <circle cx="0" cy="0" r={eyeR} fill={`url(#${eyeGradId})`} stroke="#cbd5e1" strokeWidth="0.8" />

        {/* Eyeball Inner Soft Rim */}
        <circle cx="0" cy="0" r={eyeR} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1.2" />

        {/* Pupil and Highlights strictly clipped to the eye circle */}
        <g clipPath={`url(#${clipId})`}>
          {renderPupil(pupilRef)}
        </g>
      </g>
    );
  };

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`blob-clay-svg blob-state-${state} ${isActive ? `active-action-${activeAction}` : ''}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Eye circular clip paths to prevent any leakage */}
        <clipPath id={clipLeftId}>
          <circle cx="0" cy="0" r={eyeR} />
        </clipPath>
        <clipPath id={clipRightId}>
          <circle cx="0" cy="0" r={eyeR} />
        </clipPath>

        {/* Stretched, ultra-soft subtle dual-tone body gradient */}
        <linearGradient id={bodyGradId} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={color.light} />
          <stop offset="28%" stopColor={color.base} />
          <stop offset="68%" stopColor={color.secondary ?? color.base} />
          <stop offset="100%" stopColor={color.dark} />
        </linearGradient>

        {/* 3D Eyeball Sphere Gradient */}
        <radialGradient id={eyeGradId} cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#d1d9e6" />
        </radialGradient>

        {/* Ambient Floor Shadow */}
        <radialGradient id={floorShadowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.32)" />
          <stop offset="65%" stopColor="rgba(0,0,0,0.12)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>

        {/* Pulsing Luminous Beacon Aura (Needs-Input) */}
        <radialGradient id={auraGlowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color.glow ?? color.accent ?? '#ff007f'} stopOpacity={0.65} />
          <stop offset="60%" stopColor={color.base} stopOpacity={0.25} />
          <stop offset="100%" stopColor="transparent" stopOpacity={0} />
        </radialGradient>

        {/* Notification Alert Badge Gradient */}
        <linearGradient id={alertBadgeGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff4d6d" />
          <stop offset="100%" stopColor="#d90429" />
        </linearGradient>
      </defs>

      {/* Needs-Input Radiant Glowing Aura Ring */}
      {isNeedsInput && (
        <ellipse cx="50" cy="50" rx="50" ry="48" fill={`url(#${auraGlowId})`} className="clay-needs-input-aura" />
      )}

      {/* Floor Contact Shadow */}
      <ellipse cx="50" cy="94" rx="38" ry="6" fill={`url(#${floorShadowId})`} className="clay-floor-shadow" />

      {/* Main Animated Clay Character Group */}
      <g className={`clay-character-body ${isActive ? `anim-${activeAction}` : ''}`}>
        {/* Main 3D Soft Clay Body */}
        <path
          d={shape.path}
          fill={`url(#${bodyGradId})`}
          stroke={color.edge}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Top Volumetric Specular Highlight */}
        <path
          d={shape.path}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.8"
          strokeOpacity="0.32"
          transform="translate(1, 1) scale(0.96)"
        />

        {/* Rosy Blush Cheeks under eyes */}
        <ellipse
          cx={50 - spacing - eyeR * 0.72}
          cy={eyeY + eyeR * 0.85}
          rx={eyeR * 0.44}
          ry={eyeR * 0.25}
          fill={color.accent ?? '#ff4081'}
          opacity="0.36"
          className="clay-blush"
        />
        <ellipse
          cx={50 + spacing + eyeR * 0.72}
          cy={eyeY + eyeR * 0.85}
          rx={eyeR * 0.44}
          ry={eyeR * 0.25}
          fill={color.accent ?? '#ff4081'}
          opacity="0.36"
          className="clay-blush"
        />

        {/* Eyeballs Group */}
        <g transform={`translate(50 ${eyeY})`} className="clay-eyes-group">
          {renderEye(-spacing, leftPupilRef, true)}
          {renderEye(spacing, rightPupilRef, false)}
        </g>

        {/* Natural Facial Mouth Expression (Centered directly under eyes) */}
        {isNeedsInput ? (
          /* Cute Yelling / Talking Mouth on Face */
          <g transform={`translate(50 ${naturalMouthY})`} className="clay-yelling-mouth">
            <path
              d="M -6 -1 Q 0 -3 6 -1 C 7 5, 5 9, 0 9 C -5 9, -7 5, -6 -1 Z"
              fill="#181320"
              stroke="#0d0a12"
              strokeWidth="0.8"
            />
            <path d="M -3.5 4 Q 0 8 3.5 4 Q 2 2 -2 2 Z" fill="#ff5c8a" />
          </g>
        ) : isError ? (
          /* Wobbly Sad Mouth */
          <g transform={`translate(50 ${naturalMouthY})`}>
            <path
              d="M -7 2 Q -3 -3 0 1 Q 3 -3 7 2"
              fill="none"
              stroke="#1c1824"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </g>
        ) : isActive ? (
          /* Cheerful Happy Open Smile */
          <g transform={`translate(50 ${naturalMouthY - 1})`} className="clay-active-mouth">
            <path
              d="M -6 -1 Q 0 7 6 -1"
              fill="none"
              stroke="#1a1824"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        ) : (
          /* Sweet Idle Smile */
          <g transform={`translate(50 ${naturalMouthY - 1})`}>
            <path
              d="M -4 0 Q 0 4 4 0"
              fill="none"
              stroke="#1a1824"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.85"
            />
          </g>
        )}
      </g>

      {/* Needs-Input Clean Notification Speech/Alert Badge */}
      {isNeedsInput && (
        <g transform="translate(78 16)" className="clay-alert-badge">
          <circle cx="0" cy="0" r="9" fill={`url(#${alertBadgeGradId})`} stroke="#ffffff" strokeWidth="1.6" />
          <text
            x="0"
            y="3.8"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="11"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
          >
            !
          </text>
        </g>
      )}
    </svg>
  );
}
