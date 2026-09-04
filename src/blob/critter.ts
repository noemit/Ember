/**
 * Critter blobs: little flat monsters built from independent trait slots so the combination
 * space is huge and each session's monster is easy to tell apart at a glance.
 *
 * Slot design follows what survives at 30px: body silhouette first (aspect ratio, taper,
 * bumps), then eye count/size, then the top contour (crown), then large accent fields.
 * Mouths, tails and feet are charm, not identity.
 *
 * Every path lives in a 100×100 viewBox. Bodies keep y ≥ 20 so crowns have headroom.
 * Appendages are authored for the right-hand side at the origin and mirrored for the left.
 */
import { contrastRatio, ensureContrast } from './contrast';

export type CritterColor = {
  name: string;
  fill: string;
  /** Two accent candidates; the one with more contrast against the theme-adjusted fill wins. */
  light: string;
  dark: string;
};

export const CRITTER_COLORS: CritterColor[] = [
  { name: 'plum', fill: '#7b4bb5', light: '#ffd66e', dark: '#2a1147' },
  { name: 'rust', fill: '#d2562a', light: '#ffe7a3', dark: '#3a1a3f' },
  { name: 'moss', fill: '#5c8f3a', light: '#f5f0c2', dark: '#22301a' },
  { name: 'sea', fill: '#2a86b5', light: '#ffd48a', dark: '#0b2b3f' },
  { name: 'rose', fill: '#e56b98', light: '#fff0d6', dark: '#3f1226' },
  { name: 'mustard', fill: '#dfae2c', light: '#fff5d0', dark: '#4a2c4a' },
  { name: 'mint', fill: '#4fc79a', light: '#f2fff8', dark: '#173a56' },
  { name: 'sky', fill: '#6fb0ee', light: '#fff2a8', dark: '#14304f' },
  { name: 'clay', fill: '#b8735a', light: '#ffefd6', dark: '#3f1f13' },
  { name: 'indigo', fill: '#3f52c0', light: '#ffc2d6', dark: '#121a4a' },
  { name: 'lilac', fill: '#ad8fe3', light: '#fff7c2', dark: '#2e1b4d' },
  { name: 'olive', fill: '#98a53a', light: '#fdf5d8', dark: '#3a2a4a' },
];

export type CritterPair = { fill: string; accent: string; ink: string };

const INK = '#1c1826';

/** Theme-adjusted palette, index-aligned with CRITTER_COLORS. */
export const critterPaletteFor = (surfaces: string[]): CritterPair[] =>
  CRITTER_COLORS.map((color) => {
    const fill = ensureContrast(color.fill, surfaces);
    const accent = contrastRatio(fill, color.light) >= contrastRatio(fill, color.dark) ? color.light : color.dark;
    // Mouths are drawn in ink; on a fill too dark for ink they borrow the pale accent instead.
    const ink = contrastRatio(fill, INK) >= 2.5 ? INK : color.light;
    return { fill, accent, ink };
  });

type Point = [number, number];

export type CritterBody = {
  name: string;
  path: string;
  /** Apex, where centred crowns sit. */
  top: Point;
  /** Right-hand anchor for paired crowns (mirrored around x=50). */
  ear: Point;
  /** Right-hand anchor for side parts. */
  side: Point;
  /** Right-hand anchor for feet, on the ground line. */
  foot: Point;
  /** Bottom-right anchor for the tail. */
  tail: Point;
  /** Face: centre of the eye line, half-distance between paired eyes, and mouth centre. */
  eye: Point;
  eyeSpan: number;
  faceScale: number;
  mouth: Point;
  /** Centre of the belly, used to place markings. */
  belly: Point;
  /** Bodies with no clean mirror line only take centred crowns. */
  centredOnly?: boolean;
  /** Bodies whose outline is already busy skip crowns and sides. */
  bare?: boolean;
};

const spiky = (cx: number, cy: number, rIn: number, rOut: number, count: number): string => {
  const points: string[] = [];
  for (let i = 0; i < count; i++) {
    const tip = (i / count) * Math.PI * 2 - Math.PI / 2;
    const valley = tip + Math.PI / count;
    points.push(`${(cx + Math.cos(tip) * rOut).toFixed(1)} ${(cy + Math.sin(tip) * rOut).toFixed(1)}`);
    points.push(`${(cx + Math.cos(valley) * rIn).toFixed(1)} ${(cy + Math.sin(valley) * rIn).toFixed(1)}`);
  }
  return `M${points.join(' L')} Z`;
};

export const CRITTER_BODIES: CritterBody[] = [
  {
    name: 'gumdrop',
    path: 'M50 22 C67 22 81 40 81 64 L81 84 C81 88 78 90 74 90 L26 90 C22 90 19 88 19 84 L19 64 C19 40 33 22 50 22 Z',
    top: [50, 22],
    ear: [64, 30],
    side: [80, 66],
    foot: [64, 90],
    tail: [78, 86],
    eye: [50, 50],
    eyeSpan: 13,
    faceScale: 1,
    mouth: [50, 69],
    belly: [50, 74],
  },
  {
    name: 'pancake',
    path: 'M50 46 C76 46 94 58 94 76 C94 86 88 90 78 90 L22 90 C12 90 6 86 6 76 C6 58 24 46 50 46 Z',
    top: [50, 46],
    ear: [70, 51],
    side: [92, 74],
    foot: [66, 90],
    tail: [86, 86],
    eye: [50, 65],
    eyeSpan: 15,
    faceScale: 0.85,
    mouth: [50, 80],
    belly: [50, 82],
  },
  {
    name: 'ghost',
    path: 'M50 20 C64 20 80 34 82 58 C83 70 84 82 82 92 C74 86 68 92 60 88 C54 94 46 94 40 88 C32 92 26 86 18 92 C16 82 17 70 18 58 C20 34 36 20 50 20 Z',
    top: [50, 20],
    ear: [62, 26],
    side: [80, 62],
    foot: [60, 90],
    tail: [80, 86],
    eye: [50, 50],
    eyeSpan: 12,
    faceScale: 0.95,
    mouth: [50, 68],
    belly: [50, 76],
  },
  {
    name: 'loaf',
    path: 'M50 28 C70 28 86 34 86 50 L86 74 C86 86 74 90 50 90 C26 90 14 86 14 74 L14 50 C14 34 30 28 50 28 Z',
    top: [50, 28],
    ear: [68, 31],
    side: [86, 62],
    foot: [66, 90],
    tail: [80, 86],
    eye: [50, 50],
    eyeSpan: 14,
    faceScale: 1,
    mouth: [50, 70],
    belly: [50, 80],
  },
  {
    name: 'pear',
    path: 'M50 20 C62 20 71 29 71 40 C71 44 70 47 68 50 C78 56 84 66 84 74 C84 86 70 92 50 92 C30 92 16 86 16 74 C16 66 22 56 32 50 C30 47 29 44 29 40 C29 29 38 20 50 20 Z',
    top: [50, 20],
    ear: [63, 26],
    side: [82, 74],
    foot: [64, 92],
    tail: [78, 88],
    eye: [50, 38],
    eyeSpan: 9,
    faceScale: 0.8,
    mouth: [50, 52],
    belly: [50, 76],
  },
  {
    name: 'lumpy',
    path: 'M34 40 C30 30 42 24 50 30 C54 22 68 24 70 34 C82 34 90 46 84 56 C92 66 86 82 72 86 C66 94 44 94 36 86 C22 88 12 74 18 62 C12 52 20 40 34 40 Z',
    top: [58, 26],
    ear: [66, 32],
    side: [86, 62],
    foot: [64, 91],
    tail: [80, 86],
    eye: [52, 52],
    eyeSpan: 13,
    faceScale: 1,
    mouth: [52, 71],
    belly: [50, 76],
  },
  {
    name: 'spikeball',
    path: spiky(50, 58, 28, 38, 9),
    top: [50, 20],
    ear: [50, 20],
    side: [88, 58],
    foot: [60, 90],
    tail: [80, 88],
    eye: [50, 55],
    eyeSpan: 11,
    faceScale: 0.9,
    mouth: [50, 71],
    belly: [50, 76],
    bare: true,
  },
  {
    name: 'slug',
    path: 'M30 24 C44 18 62 26 66 42 C78 44 92 56 92 72 C92 84 84 90 72 90 L24 90 C16 90 10 84 12 74 C14 64 10 46 14 36 C17 28 22 26 30 24 Z',
    top: [34, 22],
    ear: [34, 22],
    side: [90, 72],
    foot: [64, 90],
    tail: [88, 86],
    eye: [40, 42],
    eyeSpan: 10,
    faceScale: 0.85,
    mouth: [42, 58],
    belly: [58, 76],
    centredOnly: true,
  },
];

export type CritterPart = {
  name: string;
  /** Paths in body colour, authored at the origin. */
  body?: string[];
  /** Paths in accent colour, authored at the origin. */
  accent?: string[];
  /** Crowns: drawn twice at `ear` (mirrored) or once at `top`. */
  placement?: 'pair' | 'centre';
};

const disc = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;

export const CRITTER_CROWNS: CritterPart[] = [
  { name: 'bare' },
  { name: 'stalks', placement: 'pair', body: ['M-3 4 L-2 -14 L2 -14 L3 4 Z'], accent: [disc(0, -16, 6)] },
  { name: 'unicorn', placement: 'centre', body: ['M-7 5 L0 -20 L7 5 Z'], accent: ['M-3 -9 L0 -20 L3 -9 Z'] },
  {
    name: 'lop',
    placement: 'pair',
    body: ['M-2 6 C-10 -2 -8 -24 2 -24 C12 -24 12 -2 2 6 Z'],
    accent: ['M0 2 C-5 -3 -4 -17 2 -17 C8 -17 8 -3 3 2 Z'],
  },
  { name: 'devil', placement: 'pair', body: ['M-8 6 C-5 -4 2 -12 13 -20 C9 -9 7 -2 7 6 Z'] },
  {
    name: 'mohawk',
    placement: 'centre',
    body: ['M-17 8 L-10 -4 L-5 5 L0 -12 L5 5 L10 -4 L17 8 Z'],
    accent: ['M-11 6 L-9 -2 L-5 5 L0 -9 L5 5 L9 -2 L11 6 Z'],
  },
  { name: 'cat', placement: 'pair', body: ['M-10 8 L-2 -15 L12 6 Z'], accent: ['M-5 6 L-2 -6 L6 4 Z'] },
  {
    name: 'ram',
    placement: 'pair',
    body: ['M-3 6 C-5 -6 4 -16 13 -14 C20 -12 20 -2 13 -1 C15 -7 11 -10 7 -8 C3 -6 3 2 5 6 Z'],
  },
];

export const CRITTER_SIDES: CritterPart[] = [
  { name: 'bare' },
  { name: 'nubs', body: ['M6 5 m-8 0 a8 6 0 1 0 16 0 a8 6 0 1 0 -16 0'] },
  {
    name: 'bat',
    body: ['M-2 -6 C6 -24 24 -24 26 -10 C22 -13 18 -9 18 -5 C14 -11 10 -9 8 -3 C4 -9 0 -7 -2 -6 Z'],
  },
  { name: 'gloves', body: ['M-4 4 L10 -14 L17 -7 L4 7 Z', disc(15, -18, 7.5)] },
  { name: 'fins', accent: ['M-2 -7 L17 -2 L-2 7 Z'] },
  { name: 'arms', body: ['M-4 -4 L6 -4 C14 4 16 14 14 24 L7 24 C9 14 6 8 -4 4 Z', disc(11, 25, 6.5)] },
];

export const CRITTER_TAILS: CritterPart[] = [
  { name: 'none' },
  { name: 'pom', body: ['M-3 -2 L8 -6 L9 -1 L-2 2 Z'], accent: [disc(12, -5, 7)] },
  { name: 'spade', body: ['M-3 -2 L10 -8 L11 -3 L-2 2 Z'], accent: ['M6 -14 L20 -10 L10 0 Z'] },
  { name: 'whip', body: ['M-3 3 C6 0 14 -8 16 -22 C17 -26 20 -26 20 -22 C19 -6 12 4 -1 6 Z'] },
];

export const CRITTER_FEET: CritterPart[] = [
  { name: 'none' },
  { name: 'stubs', accent: ['M-8 -5 L8 -5 L8 4 Q8 8 4 8 L-4 8 Q-8 8 -8 4 Z'] },
  { name: 'stilts', body: ['M-3.5 -6 L3.5 -6 L3.5 8 L-3.5 8 Z'], accent: ['M-7 8 a7 5 0 1 0 14 0 a7 5 0 1 0 -14 0'] },
  { name: 'webs', accent: ['M-9 -3 L13 -3 L3 7 Z'] },
];

export const CRITTER_EYES = ['cyclops', 'pair', 'huge', 'three', 'mismatch', 'visor', 'sleepy', 'angry'] as const;
export type CritterEyes = (typeof CRITTER_EYES)[number];

/** No flat-line mouths: at 30px they read as bored or dead, and the mouth is what says "monster". */
export const CRITTER_MOUTHS = ['o', 'grin', 'gape', 'wavy', 'fangs', 'underbite'] as const;
export type CritterMouth = (typeof CRITTER_MOUTHS)[number];

/** Mouths that dominate the face; only paired with calm two-eye layouts (see rule in CritterBlob). */
export const BIG_MOUTHS: CritterMouth[] = ['grin', 'gape', 'underbite'];
export const CALM_EYES: CritterEyes[] = ['pair', 'sleepy', 'angry', 'visor', 'huge'];

export const CRITTER_MARKINGS = ['none', 'belly', 'scoop', 'cap', 'bands', 'dots', 'blush'] as const;
export type CritterMarking = (typeof CRITTER_MARKINGS)[number];
