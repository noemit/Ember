import * as React from 'react';

type Props = {
  /** Centre of the body the ring circles, in the SVG's user units. */
  cx: number;
  cy: number;
  /** Rough radius of the body; the ring sits just outside it. */
  r: number;
};

const TILT_DEG = -18;
/** Ellipse proportions: wide enough to clear the body, squashed so it reads as an orbit, not a halo. */
const RX_SCALE = 1.3;
const RY_SCALE = 0.4;
const MARKER_SCALE = 0.2;
const STROKE_SCALE = 0.075;

/**
 * "Something is circling this agent": a tilted orbit whose far half is hidden by the body and
 * whose marker dot travels around it, passing behind and then in front. Rendered as two halves so
 * the body can sit between them: place `<OrbitRing.Back>` before the body and `<OrbitRing.Front>`
 * after it, with identical props. Motion is `offset-distance` + opacity only (see blob.css).
 */
const geometry = (r: number) => {
  const rx = r * RX_SCALE;
  const ry = rx * RY_SCALE;
  // Start at the left, go through the bottom (front, sweep 0) to the right, then back over the top.
  const front = `M ${-rx} 0 A ${rx} ${ry} 0 0 0 ${rx} 0`;
  const back = `M ${rx} 0 A ${rx} ${ry} 0 0 0 ${-rx} 0`;
  return { rx, ry, front, back, orbit: `${front} A ${rx} ${ry} 0 0 0 ${-rx} 0` };
};

const Marker = ({ r, orbit, half }: { r: number; orbit: string; half: 'front' | 'back' }) => (
  <g className={`blob-orbit blob-orbit-${half}`} style={{ offsetPath: `path('${orbit}')` }}>
    <circle r={r * MARKER_SCALE} fill="var(--highlight)" stroke="var(--background)" strokeWidth={r * STROKE_SCALE} />
  </g>
);

const Half = ({ cx, cy, r, half }: Props & { half: 'front' | 'back' }) => {
  const { front, back, orbit } = geometry(r);
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${TILT_DEG})`} className="blob-orbit-plane">
      <path
        d={half === 'front' ? front : back}
        fill="none"
        stroke="var(--highlight)"
        strokeWidth={r * STROKE_SCALE}
        strokeLinecap="round"
        opacity={half === 'front' ? 0.9 : 0.45}
      />
      <Marker r={r} orbit={orbit} half={half} />
    </g>
  );
};

const Back = (props: Props) => <Half {...props} half="back" />;
const Front = (props: Props) => <Half {...props} half="front" />;

export const OrbitRing = { Back, Front };
