/** Flat, matte palette in the spirit of the Grok bot avatars. */
export type GrokColor = {
  name: string;
  fill: string;
  /** Slightly darker tone used for the pupil so it reads on the flat body. */
  ink: string;
};

export const GROK_COLORS: GrokColor[] = [
  { name: 'violet', fill: '#8b5cf6', ink: '#241a4a' },
  { name: 'magenta', fill: '#ff3fa4', ink: '#4a1030' },
  { name: 'scarlet', fill: '#f04141', ink: '#4a1212' },
  { name: 'azure', fill: '#3b9dff', ink: '#0f2c4a' },
  { name: 'tangerine', fill: '#ff9f1c', ink: '#4a2c08' },
  { name: 'cobalt', fill: '#2f6bff', ink: '#0d1f4a' },
  { name: 'lime', fill: '#7ed957', ink: '#1f3d12' },
  { name: 'teal', fill: '#21c7b7', ink: '#0b3a36' },
  { name: 'gold', fill: '#ffd23f', ink: '#4a3a08' },
  { name: 'coral', fill: '#ff7a5c', ink: '#4a1e14' },
  { name: 'lavender', fill: '#b48cff', ink: '#2f1f4a' },
  { name: 'mint', fill: '#5be3a3', ink: '#123a2a' },
];

export type GrokShape = {
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
export const GROK_SHAPES: GrokShape[] = [
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
    path: 'M36 20 C 44 14 52 20 50 24 C 54 18 66 16 72 24 C 86 34 94 54 88 72 C 82 88 62 92 50 92 C 36 92 16 88 10 72 C 4 54 14 30 36 20 Z',
    eyeX: 50,
    eyeY: 56,
    eyeGap: 15,
    eyeScale: 1,
  },
];
