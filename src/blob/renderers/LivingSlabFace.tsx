import * as React from 'react';
import { hashString, mulberry32 } from '../seed';
import type { BallState } from '../../types';

export type SlabColor = {
  name: string;
  bg: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  faceWhite: string;
  pupil: string;
};

export const SLAB_PALETTE: SlabColor[] = [
  { name: 'Cobalt Night', bg: '#172a46', border: '#2563eb', text: '#f0f9ff', textDim: '#93c5fd', accent: '#60a5fa', faceWhite: '#ffffff', pupil: '#0b1329' },
  { name: 'Deep Amethyst', bg: '#2d153e', border: '#9333ea', text: '#faf5ff', textDim: '#d8b4fe', accent: '#c084fc', faceWhite: '#ffffff', pupil: '#180724' },
  { name: 'Emerald Pine', bg: '#103322', border: '#16a34a', text: '#f0fdf4', textDim: '#86efac', accent: '#4ade80', faceWhite: '#ffffff', pupil: '#041f11' },
  { name: 'Warm Tangerine', bg: '#3d1b10', border: '#ea580c', text: '#fff7ed', textDim: '#fdba74', accent: '#fb923c', faceWhite: '#ffffff', pupil: '#240a04' },
  { name: 'Berry Rose', bg: '#3b1227', border: '#db2777', text: '#fdf2f8', textDim: '#f472b6', accent: '#f472b6', faceWhite: '#ffffff', pupil: '#200513' },
  { name: 'Dark Cyan', bg: '#0d3238', border: '#0891b2', text: '#ecfeff', textDim: '#67e8f9', accent: '#22d3ee', faceWhite: '#ffffff', pupil: '#031c20' },
  { name: 'Royal Indigo', bg: '#1d1b4c', border: '#4f46e5', text: '#eef2ff', textDim: '#a5b4fc', accent: '#818cf8', faceWhite: '#ffffff', pupil: '#0b092b' },
  { name: 'Slate Steel', bg: '#1e2638', border: '#475569', text: '#f8fafc', textDim: '#94a3b8', accent: '#cbd5e1', faceWhite: '#ffffff', pupil: '#0a0f1d' },
];

type Props = {
  seed: string;
  size?: number;
  state?: BallState;
  interactive?: boolean;
};

export default function LivingSlabFace({ seed, size = 44, state = 'idle', interactive = true }: Props) {
  const containerRef = React.useRef<SVGSVGElement>(null);
  const leftPupilRef = React.useRef<SVGGElement>(null);
  const rightPupilRef = React.useRef<SVGGElement>(null);

  const uid = React.useId().replace(/[:]/g, '');
  const clipL = `slab-eye-l-${uid}`;
  const clipR = `slab-eye-r-${uid}`;

  const seedHash = hashString(seed);
  const rng = mulberry32(seedHash);

  const color = SLAB_PALETTE[Math.floor(rng() * SLAB_PALETTE.length)];
  const isError = state === 'error';
  const isNeedsInput = state === 'needs-input';
  const isActive = state === 'active';

  // Eye scan state when active
  const [scanPos, setScanPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = React.useState(false);

  // Active state: procedural rapid eye scanning (reading/inspecting code)
  React.useEffect(() => {
    if (!isActive) return;

    const interval = window.setInterval(() => {
      const sx = (Math.random() - 0.5) * 6;
      const sy = (Math.random() - 0.5) * 4.5;
      setScanPos({ x: sx, y: sy });
    }, 280);

    return () => window.clearInterval(interval);
  }, [isActive]);

  // Idle state: occasional natural blink
  React.useEffect(() => {
    if (isActive || isError || isNeedsInput) return;

    let timeout: number | undefined;
    const triggerBlink = () => {
      setIsBlinking(true);
      window.setTimeout(() => setIsBlinking(false), 140);
      timeout = window.setTimeout(triggerBlink, 3200 + Math.random() * 2400);
    };

    timeout = window.setTimeout(triggerBlink, 2000 + Math.random() * 2000);
    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [isActive, isError, isNeedsInput]);

  // Mouse tracking
  React.useEffect(() => {
    if (!interactive) return;

    const onMove = (event: MouseEvent) => {
      if (isActive) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, 260 / dist);
      const tx = ((dx / dist) * 3.5 * reach).toFixed(2);
      const ty = ((dy / dist) * 3 * reach).toFixed(2);
      const transform = `translate(${tx} ${ty})`;
      if (leftPupilRef.current) leftPupilRef.current.setAttribute('transform', transform);
      if (rightPupilRef.current) rightPupilRef.current.setAttribute('transform', transform);
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [interactive, isActive]);

  // Apply active scan position
  React.useEffect(() => {
    if (isActive) {
      const transform = `translate(${scanPos.x.toFixed(2)} ${scanPos.y.toFixed(2)})`;
      if (leftPupilRef.current) leftPupilRef.current.setAttribute('transform', transform);
      if (rightPupilRef.current) rightPupilRef.current.setAttribute('transform', transform);
    }
  }, [isActive, scanPos]);

  const eyeR = 10;
  const spacing = 14;
  const eyeY = 40;
  const mouthY = 66;

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`living-slab-face-svg state-${state}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <clipPath id={clipL}>
          <circle cx="0" cy="0" r={eyeR} />
        </clipPath>
        <clipPath id={clipR}>
          <circle cx="0" cy="0" r={eyeR} />
        </clipPath>
      </defs>

      {/* Eyes Group */}
      <g transform={`translate(50 ${eyeY})`}>
        {/* Left Eyeball */}
        <g transform={`translate(${-spacing} 0)`}>
          <ellipse cx="0" cy="2" rx={eyeR + 0.8} ry={eyeR * 0.9} fill="rgba(0,0,0,0.25)" />
          <circle cx="0" cy="0" r={eyeR} fill={color.faceWhite} stroke="#cbd5e1" strokeWidth="0.8" />
          {isBlinking ? (
            <path d={`M ${-eyeR * 0.8} 0 Q 0 ${eyeR * 0.5} ${eyeR * 0.8} 0`} fill="none" stroke="#111118" strokeWidth="2.4" strokeLinecap="round" />
          ) : isError ? (
            <g stroke="#111118" strokeWidth="2.8" strokeLinecap="round">
              <line x1="-5" y1="-5" x2="5" y2="5" />
              <line x1="-5" y1="5" x2="5" y2="-5" />
            </g>
          ) : (
            <g clipPath={`url(#${clipL})`}>
              <g ref={leftPupilRef}>
                <circle cx="0" cy="0" r={eyeR * 0.52} fill={color.pupil} />
                <circle cx={-eyeR * 0.18} cy={-eyeR * 0.18} r={eyeR * 0.2} fill="#ffffff" />
                <circle cx={eyeR * 0.16} cy={eyeR * 0.16} r={eyeR * 0.1} fill="#ffffff" opacity="0.9" />
              </g>
            </g>
          )}
        </g>

        {/* Right Eyeball */}
        <g transform={`translate(${spacing} 0)`}>
          <ellipse cx="0" cy="2" rx={eyeR + 0.8} ry={eyeR * 0.9} fill="rgba(0,0,0,0.25)" />
          <circle cx="0" cy="0" r={eyeR} fill={color.faceWhite} stroke="#cbd5e1" strokeWidth="0.8" />
          {isBlinking ? (
            <path d={`M ${-eyeR * 0.8} 0 Q 0 ${eyeR * 0.5} ${eyeR * 0.8} 0`} fill="none" stroke="#111118" strokeWidth="2.4" strokeLinecap="round" />
          ) : isError ? (
            <g stroke="#111118" strokeWidth="2.8" strokeLinecap="round">
              <line x1="-5" y1="-5" x2="5" y2="5" />
              <line x1="-5" y1="5" x2="5" y2="-5" />
            </g>
          ) : (
            <g clipPath={`url(#${clipR})`}>
              <g ref={rightPupilRef}>
                <circle cx="0" cy="0" r={eyeR * 0.52} fill={color.pupil} />
                <circle cx={-eyeR * 0.18} cy={-eyeR * 0.18} r={eyeR * 0.2} fill="#ffffff" />
                <circle cx={eyeR * 0.16} cy={eyeR * 0.16} r={eyeR * 0.1} fill="#ffffff" opacity="0.9" />
              </g>
            </g>
          )}
        </g>
      </g>

      {/* Rosy Blush Cheeks */}
      <ellipse cx={50 - spacing - eyeR * 0.65} cy={eyeY + eyeR * 0.75} rx={eyeR * 0.42} ry={eyeR * 0.24} fill="#ff4081" opacity="0.4" />
      <ellipse cx={50 + spacing + eyeR * 0.65} cy={eyeY + eyeR * 0.75} rx={eyeR * 0.42} ry={eyeR * 0.24} fill="#ff4081" opacity="0.4" />

      {/* Expressive Mouth */}
      <g transform={`translate(50 ${mouthY})`}>
        {isNeedsInput ? (
          /* Animated Chattering / Yelling Mouth */
          <g className="slab-talking-mouth">
            <path
              d="M -6 -1 Q 0 -4 6 -1 C 7 5, 5 9, 0 9 C -5 9, -7 5, -6 -1 Z"
              fill="#0d111a"
              stroke="#000000"
              strokeWidth="0.8"
            />
            <path d="M -3.5 4 Q 0 8 3.5 4 Q 2 2 -2 2 Z" fill="#ff4d79" />
          </g>
        ) : isError ? (
          /* Wobbly Sad Mouth */
          <path d="M -6 2 Q -3 -3 0 1 Q 3 -3 6 2" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
        ) : isActive ? (
          /* Happy Working Smile */
          <path d="M -5 -1 Q 0 6 5 -1" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
        ) : (
          /* Sweet Idle Smile */
          <path d="M -4 0 Q 0 4 4 0" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        )}
      </g>
    </svg>
  );
}
