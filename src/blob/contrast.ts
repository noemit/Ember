/** The script's palette minus dark/white, which vanish on one theme or the other. */
export const GLYPH_COLORS = ['#3D4EC7', '#F17FB2', '#2F9E52', '#E96420', '#E8542E', '#F6C522'];

/** WCAG 1.4.11 minimum for graphics; glyphs are the only thing identifying a session at a glance. */
const MIN_CONTRAST = 3;
const STEP = 0.03;
const MAX_STEPS = 30;

type Rgb = [number, number, number];
type Hsl = [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`;

const luminance = ([r, g, b]: Rgb): number => {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const contrastRatio = (a: string, b: string): number => {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const rgbToHsl = ([r, g, b]: Rgb): Hsl => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6 : max === gn ? ((bn - rn) / d + 2) / 6 : ((rn - gn) / d + 4) / 6;
  return [h, s, l];
};

const hslToRgb = ([h, s, l]: Hsl): Rgb => {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
};

/**
 * Nudge a colour's lightness — away from the surfaces it sits on — until it clears
 * MIN_CONTRAST against every one of them. Hue and saturation are kept so the palette
 * still reads as the same six colours on every theme.
 */
export const ensureContrast = (hex: string, surfaces: string[]): string => {
  const meets = (candidate: string) => surfaces.every((surface) => contrastRatio(candidate, surface) >= MIN_CONTRAST);
  if (meets(hex)) return hex;

  const surfaceIsDark = luminance(hexToRgb(surfaces[0])) < 0.35;
  const direction = surfaceIsDark ? 1 : -1;
  const [h, s] = rgbToHsl(hexToRgb(hex));
  let [, , l] = rgbToHsl(hexToRgb(hex));
  let candidate = hex;

  for (let step = 0; step < MAX_STEPS; step += 1) {
    l = Math.max(0, Math.min(1, l + direction * STEP));
    candidate = rgbToHex(hslToRgb([h, s, l]));
    if (meets(candidate)) return candidate;
    if (l === 0 || l === 1) break;
  }
  return candidate;
};

/** Theme-adjusted glyph palette, index-aligned with GLYPH_COLORS. */
export const glyphPaletteFor = (surfaces: string[]): string[] =>
  GLYPH_COLORS.map((color) => ensureContrast(color, surfaces));
