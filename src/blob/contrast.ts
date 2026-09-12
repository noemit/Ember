/** WCAG 1.4.11 minimum for graphics; glyphs are the only thing identifying a session at a glance. */
const MIN_CONTRAST = 3;
/** Base palette floor: no two glyph colours are closer than this in OKLab (≈ just-noticeable). */
export const MIN_GLYPH_DISTANCE = 0.1;
/** Theme-adjusted floor: contrast correction must not collapse colours into near-duplicates. */
export const MIN_THEME_DISTANCE = 0.05;

type Rgb = [number, number, number];
type Oklab = [number, number, number];
type Oklch = [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`;

const srgbToLinear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (channel: number): number =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;

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

/*
 * OKLab/OKLCH (Björn Ottosson) gives a roughly perceptually uniform space, so equal steps look
 * like equal colour differences. Colours are chosen and adjusted here rather than in HSL, where
 * hue steps near green and blue are perceptually much smaller than near red and yellow.
 */
const linearToOklab = ([r, g, b]: Rgb): Oklab => {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
};

const oklabToLinear = ([L, a, b]: Oklab): Rgb => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

const oklabToRgb = (lab: Oklab): Rgb => {
  const [r, g, b] = oklabToLinear(lab);
  return [linearToSrgb(r) * 255, linearToSrgb(g) * 255, linearToSrgb(b) * 255];
};

const rgbToOklab = (rgb: Rgb): Oklab =>
  linearToOklab(rgb.map((c) => srgbToLinear(c / 255)) as Rgb);

const oklchToRgb = ([L, chroma, hue]: Oklch): Rgb => {
  const radians = (hue * Math.PI) / 180;
  return oklabToRgb([L, chroma * Math.cos(radians), chroma * Math.sin(radians)]);
};

const rgbToOklch = (rgb: Rgb): Oklch => {
  const [L, a, b] = rgbToOklab(rgb);
  return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
};

const inGamut = ([r, g, b]: Rgb): boolean =>
  r >= -0.5 && r <= 255.5 && g >= -0.5 && g <= 255.5 && b >= -0.5 && b <= 255.5;

const oklabDistance = (a: Oklab, b: Oklab): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Perceptual (OKLab) distance between two hex colours; 0.1 is roughly a just-noticeable step. */
export const perceptualDistance = (a: string, b: string): number =>
  oklabDistance(rgbToOklab(hexToRgb(a)), rgbToOklab(hexToRgb(b)));

/** OKLCH hue of a hex colour in degrees [0, 360); GLYPH_COLORS is sorted by this (rainbow order). */
export const colorHue = (hex: string): number => rgbToOklch(hexToRgb(hex))[2];

export const AVATAR_COLOR_COUNT = 22;
/** The yellow slot, forced because sampling always lands on a dark olive (see buildGlyphColors). */
const BRIGHT_YELLOW = '#ffd60a';
export const INSTANCE_MARKER_COLORS = [
  '#3D4EC7', '#A13DB8', '#D13F78', '#C84A3A', '#C66A24', '#9A7A12',
  '#4F8A2F', '#20866F', '#247F9E', '#3474C8', '#6757C2', '#8C4A9E',
];

/** Reduce chroma until the OKLCH triple maps back into sRGB. */
const oklchToHex = (lightness: number, chroma: number, hue: number): string => {
  let current = chroma;
  let rgb = oklchToRgb([lightness, current, hue]);
  for (let step = 0; step < 24 && !inGamut(rgb); step += 1) {
    current *= 0.95;
    rgb = oklchToRgb([lightness, current, hue]);
  }
  return rgbToHex(rgb);
};

/**
 * Drop the two most redundant violet/magenta tones. Farthest-point sampling keeps a lot of them
 * because they sit far from the rest of the wheel, but at picker size four purples and four pinks
 * read as similar shades. Removing the entries closest to a neighbour (and, on a tie, the least
 * chromatic) merges them without touching the other hues.
 */
const mergeVioletTones = (colors: string[]): string[] => {
  const band = colors
    .map((hex, index) => {
      const [, chroma, hue] = rgbToOklch(hexToRgb(hex));
      return { hex, index, hue, chroma };
    })
    .filter((entry) => entry.hue >= 275);
  if (band.length <= 2) return colors;

  const scored = band.map((entry) => {
    let nearest = Infinity;
    colors.forEach((other) => {
      if (other !== entry.hex) nearest = Math.min(nearest, perceptualDistance(entry.hex, other));
    });
    return { ...entry, nearest };
  });
  scored.sort((a, b) => a.nearest - b.nearest || a.chroma - b.chroma);
  const removed = new Set(scored.slice(0, 2).map((entry) => entry.index));
  return colors.filter((_, index) => !removed.has(index));
};

/**
 * Candidate colours spread across hue, lightness and chroma, then farthest-point sampled so every
 * pick is as far as possible from the ones already chosen. That guarantees a minimum OKLab
 * distance across the palette instead of relying on a hand-tuned HSL band, which repeatedly
 * collapsed into near-duplicate greens and blues. Two extra colours are sampled so
 * {@link mergeVioletTones} can merge a pair and still land on AVATAR_COLOR_COUNT.
 */
const buildGlyphColors = (): string[] => {
  const candidates: Array<{ hex: string; lab: Oklab }> = [];
  const seen = new Set<string>();
  for (let hue = 0; hue < 360; hue += 4) {
    for (let lightness = 0.45; lightness <= 0.82; lightness += 0.025) {
      for (let chroma = 0.07; chroma <= 0.2; chroma += 0.02) {
        const rgb = oklchToRgb([lightness, chroma, hue]);
        if (!inGamut(rgb)) continue;
        const hex = rgbToHex(rgb);
        if (seen.has(hex)) continue;
        seen.add(hex);
        candidates.push({ hex, lab: rgbToOklab(hexToRgb(hex)) });
      }
    }
  }

  // Seed with the most chromatic candidate so the palette starts vivid, then greedily add the
  // candidate whose nearest chosen neighbour is farthest away.
  let seedIndex = 0;
  let seedChroma = -1;
  candidates.forEach((candidate, index) => {
    const chroma = rgbToOklch(hexToRgb(candidate.hex))[1];
    if (chroma > seedChroma) {
      seedChroma = chroma;
      seedIndex = index;
    }
  });

  const chosen = [candidates[seedIndex]];
  const nearest = candidates.map((candidate) => oklabDistance(candidate.lab, chosen[0].lab));
  while (chosen.length < AVATAR_COLOR_COUNT + 2) {
    let bestIndex = 0;
    for (let index = 1; index < candidates.length; index += 1) {
      if (nearest[index] > nearest[bestIndex]) bestIndex = index;
    }
    const picked = candidates[bestIndex];
    chosen.push(picked);
    candidates.forEach((candidate, index) => {
      nearest[index] = Math.min(nearest[index], oklabDistance(candidate.lab, picked.lab));
    });
  }
  const colors = chosen.map((candidate) => candidate.hex);

  // Farthest-point sampling never picks a bright yellow — it is close to the light green and the
  // orange, so it is never the farthest point, and the search lands on a dark olive instead. That
  // reads as mud on light themes and dull mustard on dark ones, so override the yellow slot with a
  // fixed vivid yellow. The rest of the palette is untouched.
  let yellowIndex = -1;
  let yellowDistance = Infinity;
  colors.forEach((color, index) => {
    const distance = Math.abs(colorHue(color) - 95);
    if (distance < yellowDistance) {
      yellowDistance = distance;
      yellowIndex = index;
    }
  });
  if (yellowIndex >= 0 && yellowDistance < 30) colors[yellowIndex] = BRIGHT_YELLOW;

  // Index order is the picker's display order, so lay the picks out as a rainbow (ascending OKLCH
  // hue). Sampling is order-independent, so this only changes which index a colour lands on.
  return mergeVioletTones(colors.sort((a, b) => colorHue(a) - colorHue(b)));
};

export const GLYPH_COLORS = buildGlyphColors();

const meetsContrast = (hex: string, surfaces: string[]): boolean =>
  surfaces.every((surface) => contrastRatio(hex, surface) >= MIN_CONTRAST);

/**
 * The extreme OKLCH lightness at which a colour still clears MIN_CONTRAST against every surface:
 * the largest safe lightness on a light theme, the smallest safe lightness on a dark theme. Hue and
 * chroma are held so the adjustment stays recognisably the same colour.
 */
const contrastBoundary = (hex: string, surfaces: string[]): number => {
  const dark = luminance(hexToRgb(surfaces[0])) < 0.35;
  const [, chroma, hue] = rgbToOklch(hexToRgb(hex));
  const safeEdge = dark ? 1 : 0;
  const unsafeEdge = dark ? 0 : 1;
  if (!meetsContrast(oklchToHex(safeEdge, chroma, hue), surfaces)) return safeEdge;
  if (meetsContrast(oklchToHex(unsafeEdge, chroma, hue), surfaces)) return unsafeEdge;
  let safe = safeEdge;
  let unsafe = unsafeEdge;
  for (let step = 0; step < 40; step += 1) {
    const mid = (safe + unsafe) / 2;
    if (meetsContrast(oklchToHex(mid, chroma, hue), surfaces)) safe = mid;
    else unsafe = mid;
  }
  return safe;
};

/**
 * Nudge a single colour's lightness — away from the surfaces it sits on — until it clears
 * MIN_CONTRAST against every one of them. Prefer {@link adjustPaletteForContrast} when adjusting a
 * whole palette: this per-colour clamp can push distinct colours onto the same lightness.
 */
export const ensureContrast = (hex: string, surfaces: string[]): string => {
  if (meetsContrast(hex, surfaces)) return hex;
  const [, chroma, hue] = rgbToOklch(hexToRgb(hex));
  return oklchToHex(contrastBoundary(hex, surfaces), chroma, hue);
};

/**
 * Adjust a whole palette for the theme's surfaces without collapsing its colours together.
 *
 * A per-colour clamp moves each entry only as far as it must, so entries with the same hue end up
 * pinned to the same boundary and read as duplicates. Instead this clamps every entry into its own
 * feasible lightness interval, then repeatedly pushes the closest pair apart along lightness —
 * splitting the required gap by the room each colour has — until the palette clears
 * {@link MIN_THEME_DISTANCE} or no further separation is possible.
 */
export const adjustPaletteForContrast = (colors: string[], surfaces: string[]): string[] => {
  const dark = luminance(hexToRgb(surfaces[0])) < 0.35;
  const oklch = colors.map((color) => rgbToOklch(hexToRgb(color)));
  const boundaries = colors.map((color) => contrastBoundary(color, surfaces));

  // Dark surfaces require lightness above the boundary, light surfaces below it.
  const lower = oklch.map(([lightness], index) =>
    dark ? Math.max(lightness, boundaries[index]) : 0.02
  );
  const upper = oklch.map(([lightness], index) =>
    dark ? 0.98 : Math.min(lightness, boundaries[index])
  );
  const lightness = oklch.map(([value], index) =>
    Math.max(lower[index], Math.min(upper[index], value))
  );

  const labAt = (index: number): Oklab =>
    rgbToOklab(hexToRgb(oklchToHex(lightness[index], oklch[index][1], oklch[index][2])));
  const labs = colors.map((_, index) => labAt(index));
  // Aim past the floor so rounding to hex still leaves the palette comfortably above it.
  const target = MIN_THEME_DISTANCE + 0.01;

  for (let iteration = 0; iteration < 400; iteration += 1) {
    let first = 0;
    let second = 1;
    let closest = Infinity;
    for (let i = 0; i < labs.length; i += 1) {
      for (let j = i + 1; j < labs.length; j += 1) {
        const distance = oklabDistance(labs[i], labs[j]);
        if (distance < closest) {
          closest = distance;
          first = i;
          second = j;
        }
      }
    }
    if (closest >= target) break;

    if (lightness[first] > lightness[second]) {
      const swap = first;
      first = second;
      second = swap;
    }
    const need = target - closest + 0.005;
    const firstRoom = lightness[first] - lower[first];
    const secondRoom = upper[second] - lightness[second];
    const room = firstRoom + secondRoom;
    if (room <= 1e-6) break;
    lightness[first] -= Math.min(firstRoom, (need * firstRoom) / room);
    lightness[second] += Math.min(secondRoom, (need * secondRoom) / room);
    labs[first] = labAt(first);
    labs[second] = labAt(second);
  }

  return colors.map((_, index) =>
    oklchToHex(lightness[index], oklch[index][1], oklch[index][2])
  );
};

/** Theme-adjusted glyph palette, index-aligned with GLYPH_COLORS. */
export const glyphPaletteFor = (surfaces: string[]): string[] =>
  adjustPaletteForContrast(GLYPH_COLORS, surfaces);

export const instanceMarkerPaletteFor = (surfaces: string[]): string[] =>
  adjustPaletteForContrast(INSTANCE_MARKER_COLORS, surfaces);
