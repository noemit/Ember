import * as React from 'react';
import { hashString, mulberry32, seedIdentity } from './seed';
import {
  BIG_MOUTHS,
  CALM_EYES,
  CRITTER_BODIES,
  CRITTER_COLORS,
  CRITTER_CROWNS,
  CRITTER_EYES,
  CRITTER_FEET,
  CRITTER_MARKINGS,
  CRITTER_MOUTHS,
  CRITTER_SIDES,
  CRITTER_TAILS,
  type CritterPart,
} from './critter';
import type { AvatarIdentity, BallState } from '../types';
import './blob.css';

type Props = {
  seed: string;
  identity?: AvatarIdentity;
  size?: number;
  state?: BallState;
  interactive?: boolean;
};

const pick = <T,>(list: readonly T[], rng: () => number): T => list[Math.floor(rng() * list.length)];
const hasAccent = (part: CritterPart) => Boolean(part.accent?.length);
const isOn = (part: CritterPart) => part.name !== 'bare' && part.name !== 'none';

/** Every trait a seed resolves to, after the guard rules. Pure, so callers can ask for e.g. the colour alone. */
export const deriveCritter = (seed: string) => {
  const rng = mulberry32(hashString(`critter:${seed}`));
  const body = pick(CRITTER_BODIES, rng);
  let crown = pick(CRITTER_CROWNS, rng);
  let side = pick(CRITTER_SIDES, rng);
  let tail = pick(CRITTER_TAILS, rng);
  const feet = pick(CRITTER_FEET, rng);
  let eyes = pick(CRITTER_EYES, rng);
  let mouth = pick(CRITTER_MOUTHS, rng);
  let marking = pick(CRITTER_MARKINGS, rng);
  const colorIndex = Math.floor(rng() * CRITTER_COLORS.length);
  const gaze: [number, number] = [pick([-1.6, 0, 1.6], rng), pick([0, 1.2], rng)];
  const tilt = Math.round((rng() - 0.5) * 10);
  const wobbleDelay = -(rng() * 4).toFixed(2);

  // Guard rules so random combinations stay readable:
  // - busy outlines (spikeball) take no crown or sides; asymmetric bodies only centred crowns
  if (body.bare) crown = side = CRITTER_CROWNS[0];
  else if (body.centredOnly && crown.placement === 'pair')
    crown = pick(CRITTER_CROWNS.filter((c) => c.placement === 'centre'), rng);
  // - protrusion budget: at most two of crown / side / tail
  if (isOn(crown) && isOn(side) && isOn(tail)) tail = CRITTER_TAILS[0];
  // - one bold face feature: a big mouth only goes with a calm pair of eyes
  if (BIG_MOUTHS.includes(mouth) && !CALM_EYES.includes(eyes)) mouth = 'o';
  // - accent budget: the accent colour must appear somewhere, but busy patterns only on
  //   otherwise plain monsters so it never turns into texture at rail size
  const accents = [crown, side, tail, feet].filter(hasAccent).length;
  if (accents === 0 && marking === 'none') marking = 'belly';
  if (accents >= 2 && (marking === 'bands' || marking === 'dots')) marking = 'none';
  if (accents >= 3 && marking !== 'blush') marking = 'none';
  // - blush needs cheeks beside a pair of eyes
  if (marking === 'blush' && (eyes === 'cyclops' || eyes === 'visor' || eyes === 'three')) marking = 'belly';
  // - a plain body with nothing on it is the one thing we never want
  if (!isOn(crown) && !isOn(side) && !isOn(tail) && !isOn(feet)) crown = pick(CRITTER_CROWNS.slice(1), rng);

  return { body, crown, side, tail, feet, eyes, mouth, marking, colorIndex, gaze, tilt, wobbleDelay };
};

export default function CritterBlob({ seed, identity, size = 30, state = 'idle' }: Props) {
  // useId contains colons, which are illegal in SVG id references.
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');

  const { body, crown, side, tail, feet, eyes, mouth, marking, colorIndex, gaze, tilt, wobbleDelay } = React.useMemo(() => {
    const resolved = identity ?? seedIdentity(seed);
    const shape = deriveCritter(resolved.shapeSeed);
    const motion = deriveCritter(resolved.motionSeed);
    return {
      ...shape,
      colorIndex: Math.abs(resolved.colorIndex ?? deriveCritter(resolved.colorSeed).colorIndex) % CRITTER_COLORS.length,
      gaze: motion.gaze,
      tilt: motion.tilt,
      wobbleDelay: motion.wobbleDelay,
    };
  }, [identity, seed]);
  const isError = state === 'error';
  // Colours are theme-set CSS variables (see themes.ts): the fill is contrast-adjusted for the
  // current surfaces, the accent re-picked to stay legible against it, and the ink checked too.
  const fill = `var(--critter-${colorIndex})`;
  const accent = `var(--critter-${colorIndex}-accent)`;
  const ink = `var(--critter-${colorIndex}-ink)`;
  const clipId = `critter-clip-${uid}`;

  const at = ([x, y]: [number, number], mirror = false) =>
    mirror ? `translate(${100 - x} ${y}) scale(-1 1)` : `translate(${x} ${y})`;

  const renderPart = (part: CritterPart, anchor: [number, number], mirrored: boolean, layer: 'body' | 'accent') => {
    const paths = part[layer];
    if (!paths?.length) return null;
    const color = layer === 'body' ? fill : accent;
    return (
      <>
        <g transform={at(anchor)} fill={color}>
          {paths.map((d, index) => <path key={index} d={d} />)}
        </g>
        {mirrored && (
          <g transform={at(anchor, true)} fill={color}>
            {paths.map((d, index) => <path key={index} d={d} />)}
          </g>
        )}
      </>
    );
  };

  // [part, anchor, mirrored]: feet and sides pair up, crowns unless centred, tails never.
  const parts: Array<[CritterPart, [number, number], boolean]> = [
    [feet, body.foot, true],
    [tail, body.tail, false],
    [side, body.side, true],
    [crown, crown.placement === 'centre' ? body.top : body.ear, crown.placement === 'pair'],
  ];

  const k = body.faceScale;
  const [ex, ey] = body.eye;
  const span = body.eyeSpan;

  const pupil = (x: number, y: number, r: number) =>
    isError ? (
      <g stroke={ink} strokeWidth={r * 0.6} strokeLinecap="round" transform={`translate(${x} ${y})`}>
        <line x1={-r} y1={-r} x2={r} y2={r} />
        <line x1={-r} y1={r} x2={r} y2={-r} />
      </g>
    ) : (
      <g transform={`translate(${x + gaze[0] * k} ${y + gaze[1] * k})`}>
        <circle r={r} fill={ink} />
        <circle cx={-r * 0.34} cy={-r * 0.36} r={r * 0.3} fill="#ffffff" />
      </g>
    );

  const eye = (x: number, y: number, r: number, pupilRatio = 0.58) => (
    <>
      <circle cx={x} cy={y} r={r} fill="#ffffff" />
      {pupil(x, y, r * pupilRatio)}
    </>
  );

  const renderEyes = () => {
    switch (eyes) {
      case 'cyclops':
        return eye(ex, ey, 10.5 * k, 0.55);
      case 'pair':
        return <>{eye(ex - span, ey, 7 * k)}{eye(ex + span, ey, 7 * k)}</>;
      case 'huge':
        return <>{eye(ex - span * 0.8, ey, 8.5 * k)}{eye(ex + span * 0.8, ey, 8.5 * k)}</>;
      case 'three':
        return (
          <>
            {eye(ex - span, ey - 3 * k, 5.5 * k)}
            {eye(ex + span, ey - 3 * k, 5.5 * k)}
            {eye(ex, ey + 6 * k, 5.5 * k)}
          </>
        );
      case 'mismatch':
        return <>{eye(ex - span, ey + 2 * k, 5.5 * k)}{eye(ex + span, ey, 8 * k)}</>;
      case 'visor': {
        const w = span * 2 + 16 * k;
        return (
          <>
            <rect x={ex - w / 2} y={ey - 6 * k} width={w} height={12 * k} rx={6 * k} fill="#ffffff" />
            {pupil(ex - span * 0.7, ey, 3.4 * k)}
            {pupil(ex + span * 0.7, ey, 3.4 * k)}
          </>
        );
      }
      case 'sleepy':
        return (
          <>
            {[-1, 1].map((dir) => (
              <g key={dir} transform={`translate(${ex + dir * span} ${ey})`}>
                <path d={`M${-7 * k} 0 A${7 * k} ${7 * k} 0 0 0 ${7 * k} 0 Z`} fill="#ffffff" />
                {pupil(0, 2.6 * k, 2.6 * k)}
              </g>
            ))}
          </>
        );
      case 'angry':
        return (
          <>
            {[-1, 1].map((dir) => (
              <g key={dir} transform={`translate(${ex + dir * span} ${ey}) scale(${dir * k} ${k})`}>
                <ellipse rx={7.5} ry={5.5} fill="#ffffff" />
                {/* Brow wedge in body colour, heavy on the inner corner. */}
                <path d="M-9 -1 L-9 -8 L9 -8 Z" fill={fill} />
              </g>
            ))}
            {pupil(ex - span, ey + 0.5 * k, 2.8 * k)}
            {pupil(ex + span, ey + 0.5 * k, 2.8 * k)}
          </>
        );
    }
  };

  const renderMouth = () => {
    let inner: React.ReactNode = null;
    switch (mouth) {
      case 'o':
        inner = <ellipse rx={4} ry={4.6} fill={ink} />;
        break;
      case 'grin':
        inner = (
          <>
            <path d="M-13 -3 Q0 14 13 -3 Q0 3 -13 -3 Z" fill={ink} />
            <rect x={-5} y={-1} width={4.2} height={4.5} fill="#ffffff" />
            <rect x={0.8} y={-1} width={4.2} height={4.5} fill="#ffffff" />
          </>
        );
        break;
      case 'gape':
        inner = (
          <>
            <ellipse rx={7.5} ry={8} fill={ink} />
            <path d="M-3.8 -7.6 L3.8 -7.6 L0 -1.5 Z" fill="#ffffff" />
          </>
        );
        break;
      case 'wavy':
        inner = <path d="M-9 0 Q-4.5 -6 0 0 T9 0" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />;
        break;
      case 'fangs':
        inner = (
          <>
            <path d="M-12 -3 Q0 9 12 -3 Q0 1 -12 -3 Z" fill={ink} />
            <path d="M-9 -2 L-5 -2 L-7 5 Z" fill="#ffffff" />
            <path d="M5 -2 L9 -2 L7 5 Z" fill="#ffffff" />
          </>
        );
        break;
      case 'underbite':
        inner = (
          <>
            <path d="M-12 -1 Q0 5 12 -1 L12 2 Q0 8 -12 2 Z" fill={ink} />
            <rect x={-7.5} y={-6} width={5} height={5.5} fill="#ffffff" />
            <rect x={2.5} y={-6} width={5} height={5.5} fill="#ffffff" />
          </>
        );
        break;
    }
    return <g transform={`${at(body.mouth)} scale(${k})`}>{inner}</g>;
  };

  const renderMarking = () => {
    const [bx, by] = body.belly;
    switch (marking) {
      case 'none':
      case 'blush':
        return null;
      case 'belly':
        return <ellipse cx={bx} cy={by} rx={17} ry={12} />;
      case 'scoop':
        return <path d={`M-10 ${by - 2} Q50 ${by - 12} 110 ${by - 2} L110 110 L-10 110 Z`} />;
      case 'cap': {
        const y = ey - 14 * k;
        return <path d={`M-10 -10 L110 -10 L110 ${y} Q50 ${y + 9} -10 ${y} Z`} />;
      }
      case 'bands':
        return (
          <>
            <rect x={-10} y={by - 3} width={120} height={5} />
            <rect x={-10} y={by + 7} width={120} height={5} />
          </>
        );
      case 'dots':
        return (
          <>
            <circle cx={bx - 12} cy={by - 5} r={5} />
            <circle cx={bx + 10} cy={by - 1} r={5.5} />
            <circle cx={bx - 2} cy={by + 10} r={4} />
          </>
        );
    }
  };

  return (
    <div
      className="blob blob-critter"
      data-state={state}
      aria-hidden="true"
      style={{ width: size, height: size, animationDelay: `${wobbleDelay}s` }}
      title={`${crown.name === 'bare' ? '' : `${crown.name} `}${body.name} · ${CRITTER_COLORS[colorIndex].name}`}
    >
      {/* Bodies are authored in 0..100; the viewBox is padded so the status ring and badge
          around them aren't clipped by the slot. */}
      <svg viewBox="-2 5 104 104" width={size} height={size} style={{ overflow: 'visible' }}>
        <defs>
          <clipPath id={clipId}>
            <path d={body.path} />
          </clipPath>
        </defs>

        <g className="blob-body" transform={`translate(50 56) rotate(${tilt}) scale(0.9) translate(-50 -56)`}>
          {/* Appendages sit behind the body so their joins are hidden by the silhouette. */}
          {parts.map(([part, anchor, mirrored], index) => (
            <React.Fragment key={index}>{renderPart(part, anchor, mirrored, 'body')}</React.Fragment>
          ))}

          <path d={body.path} fill={fill} />

          <g clipPath={`url(#${clipId})`} fill={accent}>
            {renderMarking()}
          </g>

          {parts.map(([part, anchor, mirrored], index) => (
            <React.Fragment key={index}>{renderPart(part, anchor, mirrored, 'accent')}</React.Fragment>
          ))}

          <g className="blob-face">
            {renderEyes()}
            {marking === 'blush' && (
              <g fill={accent}>
                <circle cx={ex - span - 4 * k} cy={ey + 9 * k} r={3.5 * k} />
                <circle cx={ex + span + 4 * k} cy={ey + 9 * k} r={3.5 * k} />
              </g>
            )}
            {renderMouth()}
          </g>
        </g>

        {/* Status lives outside the body so it stays put while the critter moves, and stays
            legible under prefers-reduced-motion where the body animations are dropped. */}
        {state !== 'idle' && (
          <circle
            className="blob-ring"
            cx={50}
            cy={55}
            r={48}
            fill="none"
            strokeWidth={4}
            stroke={isError ? 'var(--destructive)' : 'var(--highlight)'}
            strokeLinecap="round"
            // Segments sum to the circumference (2π·48) so the pattern tiles cleanly while spinning.
            strokeDasharray={state === 'active' ? '60 30 20 30 40 121.6' : undefined}
          />
        )}
        {(isError || state === 'needs-input') && (
          <circle
            className="blob-badge"
            cx={86}
            cy={92}
            r={9}
            fill={isError ? 'var(--destructive)' : 'var(--highlight)'}
            stroke="var(--background)"
            strokeWidth={3}
          />
        )}
      </svg>
    </div>
  );
}
