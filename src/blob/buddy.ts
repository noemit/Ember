import { mulberry32 } from './seed';

/** Flat, matte palette in the spirit of the Buddy avatars. */
export type BuddyColor = {
  name: string;
  fill: string;
  /** Slightly darker tone used for the pupil so it reads on the flat body. */
  ink: string;
};

export const BUDDY_COLORS: BuddyColor[] = [
  { name: 'violet', fill: '#8b5cf6', ink: '#241a4a' },
  { name: 'magenta', fill: '#ff3fa4', ink: '#4a1030' },
  { name: 'scarlet', fill: '#ff4d4d', ink: '#4a1212' },
  { name: 'azure', fill: '#3b9dff', ink: '#0f2c4a' },
  { name: 'tangerine', fill: '#ff9f1c', ink: '#4a2c08' },
  { name: 'cobalt', fill: '#3d7bff', ink: '#0d1f4a' },
  { name: 'lime', fill: '#7ed957', ink: '#1f3d12' },
  { name: 'teal', fill: '#2ad9c8', ink: '#0b3a36' },
  { name: 'gold', fill: '#ffd23f', ink: '#4a3a08' },
  { name: 'coral', fill: '#ff7a5c', ink: '#4a1e14' },
  { name: 'lavender', fill: '#b48cff', ink: '#2f1f4a' },
  { name: 'mint', fill: '#5be3a3', ink: '#123a2a' },
  { name: 'bubblegum', fill: '#ff6ec7', ink: '#4a1038' },
  { name: 'sky', fill: '#38bdf8', ink: '#082f49' },
  { name: 'emerald', fill: '#10b981', ink: '#053b2a' },
  { name: 'sunflower', fill: '#facc15', ink: '#4a3a05' },
  { name: 'flamingo', fill: '#fb7185', ink: '#4a0f1a' },
  { name: 'grape', fill: '#a855f7', ink: '#2e0a4a' },
  { name: 'cyan', fill: '#22d3ee', ink: '#063a44' },
  { name: 'chartreuse', fill: '#a3e635', ink: '#2a3a05' },
  { name: 'pumpkin', fill: '#fb923c', ink: '#4a2408' },
  { name: 'raspberry', fill: '#e11d48', ink: '#4a0815' },
  { name: 'periwinkle', fill: '#818cf8', ink: '#1e1b4a' },
  { name: 'spring', fill: '#34d399', ink: '#053a2a' },
];

export type BuddyShape = {
  name: string;
  /** Closed path inside a 100x100 viewBox. */
  path: string;
  /** Centre of the eye pair. */
  eyeX: number;
  eyeY: number;
  /** Horizontal distance from centre to each eye. */
  eyeGap: number;
  eyeScale: number;
};

/** Squishy jelly silhouettes: wide domes, soft flattened bottoms, the odd bump or drip. */
const BASE_BUDDY_SHAPES: BuddyShape[] = [
  {
    name: 'jelly',
    path: 'M50 16 C 70 14 90 30 91 54 C 92 72 82 86 62 88 C 54 89 46 89 38 88 C 18 86 8 72 9 54 C 10 30 30 18 50 16 Z',
    eyeX: 50,
    eyeY: 52,
    eyeGap: 15,
    eyeScale: 1,
  },
  {
    name: 'splat',
    path: 'M42 20 C 52 14 66 18 76 26 C 90 36 96 56 90 72 C 84 86 64 90 50 90 C 34 90 12 86 8 70 C 4 54 14 38 26 28 C 32 24 36 23 42 20 Z',
    eyeX: 50,
    eyeY: 54,
    eyeGap: 15,
    eyeScale: 1,
  },
  {
    name: 'droop',
    path: 'M48 16 C 66 14 84 26 88 46 C 90 58 86 68 90 78 C 92 86 84 90 78 84 C 72 90 60 92 50 92 C 30 92 10 80 10 56 C 10 34 28 18 48 16 Z',
    eyeX: 48,
    eyeY: 52,
    eyeGap: 14,
    eyeScale: 1,
  },
  {
    name: 'bounce',
    path: 'M50 12 C 62 12 74 22 80 40 C 86 58 90 76 78 86 C 68 92 32 92 22 86 C 10 76 14 58 20 40 C 26 22 38 12 50 12 Z',
    eyeX: 50,
    eyeY: 54,
    eyeGap: 13,
    eyeScale: 0.95,
  },
  {
    name: 'puddle',
    path: 'M50 28 C 74 26 94 40 94 60 C 94 78 76 88 50 88 C 24 88 6 78 6 60 C 6 40 26 30 50 28 Z',
    eyeX: 50,
    eyeY: 58,
    eyeGap: 16,
    eyeScale: 0.9,
  },
  {
    name: 'nub',
    path: 'M50 10 C 54 10 56 16 58 20 C 76 22 90 36 90 56 C 90 76 74 90 50 90 C 26 90 10 76 10 56 C 10 36 24 22 42 20 C 44 16 46 10 50 10 Z',
    eyeX: 50,
    eyeY: 56,
    eyeGap: 15,
    eyeScale: 1,
  },
  {
    name: 'lopsided',
    path: 'M40 18 C 58 12 80 20 88 40 C 94 56 90 76 78 86 C 66 94 44 92 30 84 C 14 74 8 56 12 40 C 16 28 28 22 40 18 Z',
    eyeX: 50,
    eyeY: 52,
    eyeGap: 14,
    eyeScale: 1,
  },
  {
    name: 'dumpling',
    path: 'M36 20 C44 14 52 20 50 24 C54 18 66 16 72 24 C86 34 94 54 88 72 C82 88 62 92 50 92 C36 92 16 88 10 72 C4 54 14 30 36 20 Z',
    eyeX: 50,
    eyeY: 56,
    eyeGap: 15,
    eyeScale: 1,
  },
  {
    name: 'teddy',
    path: 'M50 26 C55 13 66 9 73 16 C80 23 80 34 76 40 C88 47 92 59 88 68 C82 82 67 90 50 90 C33 90 18 82 12 68 C8 59 12 47 24 40 C20 34 20 23 27 16 C34 9 45 13 50 26 Z',
    eyeX: 50,
    eyeY: 57,
    eyeGap: 16,
    eyeScale: 1,
  },
  {
    name: 'sprout',
    path: 'M50 28 C44 22 35 20 30 25 C25 30 29 37 36 41 C22 43 14 52 15 64 C16 79 31 88 50 88 C69 88 84 79 85 64 C86 52 78 43 64 41 C71 37 75 30 70 25 C65 20 56 22 50 28 Z',
    eyeX: 50,
    eyeY: 57,
    eyeGap: 16,
    eyeScale: 1,
  },
  {
    name: 'puff',
    path: 'M50 22 C58 17 68 20 71 28 C80 26 88 33 87 42 C94 50 91 63 83 68 C81 80 69 88 57 85 C48 91 35 88 31 80 C19 81 11 70 16 60 C8 51 13 38 23 35 C25 24 36 18 45 23 C47 22 48 22 50 22 Z',
    eyeX: 50,
    eyeY: 56,
    eyeGap: 15,
    eyeScale: 1,
  },
  {
    name: 'cat',
    path: 'M50 34 C48 24 41 13 34 9 C30 18 27 26 26 33 C16 38 10 48 10 59 C10 75 28 87 50 87 C72 87 90 75 90 59 C90 48 84 38 74 33 C73 26 70 18 66 9 C59 13 52 24 50 34 Z',
    eyeX: 50,
    eyeY: 60,
    eyeGap: 15,
    eyeScale: 1,
  },
  {
    name: 'ghost',
    path: 'M50 12 C67 12 81 27 81 50 L81 78 C77 73 73 73 69 78 C65 83 60 83 56 78 C52 73 48 73 44 78 C40 83 35 83 31 78 C27 73 23 73 19 78 L19 50 C19 27 33 12 50 12 Z',
    eyeX: 50,
    eyeY: 48,
    eyeGap: 15,
    eyeScale: 1,
  },
  {
    name: 'cloud',
    path: 'M28 72 C16 72 8 64 8 53 C8 43 16 35 27 35 C30 23 41 15 52 15 C63 15 74 23 77 35 C88 35 96 43 96 53 C96 64 88 72 76 72 Z',
    eyeX: 50,
    eyeY: 50,
    eyeGap: 15,
    eyeScale: 1,
  },
  {
    name: 'egg',
    path: 'M50 10 C64 10 78 34 78 56 C78 76 65 90 50 90 C35 90 22 76 22 56 C22 34 36 10 50 10 Z',
    eyeX: 50,
    eyeY: 60,
    eyeGap: 14,
    eyeScale: 1,
  },
  {
    name: 'mushroom',
    path: 'M50 14 C70 14 88 28 88 46 C88 54 82 58 74 58 L66 58 L66 78 C66 84 59 88 50 88 C41 88 34 84 34 78 L34 58 L26 58 C18 58 12 54 12 46 C12 28 30 14 50 14 Z',
    eyeX: 50,
    eyeY: 40,
    eyeGap: 15,
    eyeScale: 1,
  },
];

/**
 * Generated silhouettes, reviewed in buddy-arena. A radial function with a few low-order
 * harmonics plus independent top/bottom squash gives smooth, closed, star-convex blobs — safe to
 * render without self-intersection. Deterministic per seed, so the picker's names stay stable.
 */
type BuddyHarmonic = { k: number; amp: number; phase: number };

const round = (value: number): number => Math.round(value * 100) / 100;

/** Closed Catmull-Rom → cubic Bézier, so a ring of samples reads as a smooth blob. */
const catmullRomPath = (points: Array<[number, number]>): string => {
  const count = points.length;
  let d = `M ${round(points[0][0])} ${round(points[0][1])}`;
  for (let index = 0; index < count; index += 1) {
    const p0 = points[(index - 1 + count) % count];
    const p1 = points[index];
    const p2 = points[(index + 1) % count];
    const p3 = points[(index + 2) % count];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(p2[0])} ${round(p2[1])}`;
  }
  return `${d} Z`;
};

const buildGeneratedShape = (
  radius: number,
  topScale: number,
  bottomScale: number,
  harmonics: BuddyHarmonic[]
): Omit<BuddyShape, 'name'> => {
  const cx = 50;
  const cy = 52;
  const samples = 48;
  const points: Array<[number, number]> = [];
  for (let index = 0; index < samples; index += 1) {
    const theta = (index / samples) * Math.PI * 2;
    let r = 1;
    for (const harmonic of harmonics) {
      r += harmonic.amp * Math.cos(harmonic.k * theta + harmonic.phase);
    }
    r *= radius;
    const sin = Math.sin(theta);
    points.push([cx + r * Math.cos(theta), cy + (sin > 0 ? bottomScale : topScale) * r * sin]);
  }
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    path: catmullRomPath(points),
    eyeX: 50,
    eyeY: round(minY + (maxY - minY) * 0.52),
    eyeGap: round(Math.max(13, Math.min(17, (maxX - minX) * 0.18))),
    eyeScale: 1,
  };
};

const generatedShape = (seed: number): Omit<BuddyShape, 'name'> => {
  const rng = mulberry32(seed * 2654435761 + 1013904223);
  const radius = 36 + rng() * 9;
  const topScale = 0.9 + rng() * 0.2;
  const bottomScale = 0.68 + rng() * 0.28;
  const harmonicCount = 1 + Math.floor(rng() * 3);
  const harmonics: BuddyHarmonic[] = [];
  for (let index = 0; index < harmonicCount; index += 1) {
    // Bias toward 3–7 lobes so candidates read as distinct silhouettes, not just ovals.
    const k = index === 0 && rng() < 0.35 ? 2 : 3 + Math.floor(rng() * 5);
    harmonics.push({ k, amp: 0.035 + rng() * 0.085, phase: rng() * Math.PI * 2 });
  }
  return buildGeneratedShape(radius, topScale, bottomScale, harmonics);
};

const GENERATED_BUDDY_SHAPES: BuddyShape[] = [
  2, 4, 5, 6, 9, 12, 15, 20, 21, 22, 24,
].map((seed) => ({
  name: `c${String(seed).padStart(2, '0')}`,
  ...generatedShape(seed),
}));

export const BUDDY_SHAPES: BuddyShape[] = [...BASE_BUDDY_SHAPES, ...GENERATED_BUDDY_SHAPES];
