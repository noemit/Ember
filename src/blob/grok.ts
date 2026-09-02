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

export const GROK_SHAPES: GrokShape[] = [
  {
    name: 'squircle',
    path: 'M50 10 C 78 10 90 22 90 50 C 90 78 78 90 50 90 C 22 90 10 78 10 50 C 10 22 22 10 50 10 Z',
    eyeX: 50,
    eyeY: 44,
    eyeGap: 13,
    eyeScale: 1,
  },
  {
    name: 'droplet',
    path: 'M50 8 C 56 22 84 44 84 62 C 84 82 68 92 50 92 C 32 92 16 82 16 62 C 16 44 44 22 50 8 Z',
    eyeX: 50,
    eyeY: 60,
    eyeGap: 12,
    eyeScale: 0.95,
  },
  {
    name: 'pill',
    path: 'M30 26 L70 26 C 84 26 92 36 92 50 C 92 64 84 74 70 74 L30 74 C 16 74 8 64 8 50 C 8 36 16 26 30 26 Z',
    eyeX: 50,
    eyeY: 47,
    eyeGap: 14,
    eyeScale: 0.85,
  },
  {
    name: 'round',
    path: 'M50 11 C 71.5 11 89 28.5 89 50 C 89 71.5 71.5 89 50 89 C 28.5 89 11 71.5 11 50 C 11 28.5 28.5 11 50 11 Z',
    eyeX: 50,
    eyeY: 45,
    eyeGap: 13,
    eyeScale: 1,
  },
  {
    name: 'bean',
    path: 'M36 14 C 52 10 68 16 78 28 C 90 42 92 62 82 76 C 72 90 52 92 36 84 C 22 78 12 66 12 50 C 12 32 22 18 36 14 Z',
    eyeX: 52,
    eyeY: 44,
    eyeGap: 13,
    eyeScale: 1,
  },
  {
    name: 'wedge',
    path: 'M50 12 C 58 12 62 18 66 26 L 86 68 C 90 76 86 86 76 86 L 24 86 C 14 86 10 76 14 68 L 34 26 C 38 18 42 12 50 12 Z',
    eyeX: 50,
    eyeY: 56,
    eyeGap: 12,
    eyeScale: 0.9,
  },
  {
    name: 'egg',
    path: 'M50 8 C 68 8 84 30 84 56 C 84 78 68 92 50 92 C 32 92 16 78 16 56 C 16 30 32 8 50 8 Z',
    eyeX: 50,
    eyeY: 46,
    eyeGap: 12,
    eyeScale: 0.95,
  },
  {
    name: 'tile',
    path: 'M22 20 L78 20 C 86 20 90 24 90 32 L90 68 C 90 76 86 80 78 80 L22 80 C 14 80 10 76 10 68 L10 32 C 10 24 14 20 22 20 Z',
    eyeX: 50,
    eyeY: 46,
    eyeGap: 14,
    eyeScale: 0.9,
  },
];
