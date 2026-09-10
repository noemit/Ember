/**
 * Review page for the glyph/blob palette's yellows. The shipped palette samples the whole OKLCH
 * range and ends up with a dark olive yellow that darkens into mud on light themes. This page
 * compares a few ways to get a brighter yellow, on the light and dark theme surfaces. Nothing here
 * is imported by the app.
 *
 *   bun run buddy-arena/server.ts  →  http://localhost:3004/palette
 */
import { adjustPaletteForContrast } from '../src/blob/contrast';

type Rgb = [number, number, number];
type Oklab = [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const v = hex.replace('#', '');
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`;
const srgbToLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linToSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const linToOklab = ([r, g, b]: Rgb): Oklab => {
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
const oklabToLin = ([L, a, b]: Oklab): Rgb => {
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
  const [r, g, b] = oklabToLin(lab);
  return [linToSrgb(r) * 255, linToSrgb(g) * 255, linToSrgb(b) * 255];
};
const rgbToOklab = (rgb: Rgb): Oklab => linToOklab(rgb.map((c) => srgbToLin(c / 255)) as Rgb);
const oklchToRgb = ([L, C, h]: [number, number, number]): Rgb => {
  const rad = (h * Math.PI) / 180;
  return oklabToRgb([L, C * Math.cos(rad), C * Math.sin(rad)]);
};
const rgbToOklch = (rgb: Rgb): [number, number, number] => {
  const [L, a, b] = rgbToOklab(rgb);
  return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
};
const inGamut = ([r, g, b]: Rgb): boolean => r >= -0.5 && r <= 255.5 && g >= -0.5 && g <= 255.5 && b >= -0.5 && b <= 255.5;
const dEOk = (a: Oklab, b: Oklab): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

type Config = {
  id: string;
  name: string;
  desc: string;
  /** Seed the search with a vivid yellow instead of the most chromatic colour. */
  yellowSeed: boolean;
  /** Minimum chroma for every candidate (removes muted tans/browns). */
  minChroma: number;
  /** Yellow-band (hue 65-120) floors. */
  yellowLightness: number;
  yellowChroma: number;
};

export const CONFIGS: Config[] = [
  { id: 'current', name: 'Current (shipped)', desc: 'What ships now: a dark olive yellow that goes muddy on the light theme.', yellowSeed: false, minChroma: 0.07, yellowLightness: 0.45, yellowChroma: 0.07 },
  { id: 'warm', name: 'Warm gold', desc: 'Only the yellow band is sampled brighter; the rest of the palette is unchanged.', yellowSeed: false, minChroma: 0.07, yellowLightness: 0.72, yellowChroma: 0.14 },
  { id: 'vivid', name: 'Vivid yellow', desc: 'Seeds the search with a bright yellow — brightest result, but reshuffles the other hues.', yellowSeed: true, minChroma: 0.07, yellowLightness: 0.72, yellowChroma: 0.14 },
  { id: 'punch', name: 'Punchy all-round', desc: 'No muted colours anywhere, plus the bright yellow. Most saturated palette.', yellowSeed: false, minChroma: 0.11, yellowLightness: 0.72, yellowChroma: 0.15 },
];

export const buildPalette = (config: Config): string[] => {
  const candidates: Array<{ hex: string; lab: Oklab }> = [];
  const seen = new Set<string>();
  for (let hue = 0; hue < 360; hue += 4) {
    const yellow = hue >= 65 && hue <= 120;
    const minLightness = yellow ? config.yellowLightness : 0.45;
    const minChroma = yellow ? config.yellowChroma : config.minChroma;
    for (let lightness = minLightness; lightness <= 0.82; lightness += 0.025) {
      for (let chroma = minChroma; chroma <= 0.2; chroma += 0.02) {
        const rgb = oklchToRgb([lightness, chroma, hue]);
        if (!inGamut(rgb)) continue;
        const hex = rgbToHex(rgb);
        if (seen.has(hex)) continue;
        seen.add(hex);
        candidates.push({ hex, lab: rgbToOklab(hexToRgb(hex)) });
      }
    }
  }

  let seed = candidates[0];
  if (config.yellowSeed) {
    let best = -Infinity;
    candidates.forEach((candidate) => {
      const [lightness, chroma, hue] = rgbToOklch(hexToRgb(candidate.hex));
      if (hue >= 80 && hue <= 110 && lightness + chroma > best) {
        best = lightness + chroma;
        seed = candidate;
      }
    });
  } else {
    let best = -Infinity;
    candidates.forEach((candidate) => {
      const chroma = rgbToOklch(hexToRgb(candidate.hex))[1];
      if (chroma > best) {
        best = chroma;
        seed = candidate;
      }
    });
  }

  const chosen = [seed];
  const nearest = candidates.map((candidate) => dEOk(candidate.lab, seed.lab));
  while (chosen.length < 24) {
    let bestIndex = 0;
    for (let index = 1; index < candidates.length; index += 1) {
      if (nearest[index] > nearest[bestIndex]) bestIndex = index;
    }
    const picked = candidates[bestIndex];
    chosen.push(picked);
    candidates.forEach((candidate, index) => {
      nearest[index] = Math.min(nearest[index], dEOk(candidate.lab, picked.lab));
    });
  }
  return chosen.map((candidate) => candidate.hex).sort((a, b) => rgbToOklch(hexToRgb(a))[2] - rgbToOklch(hexToRgb(b))[2]);
};

const STONE = ['#d9d9d5', '#d0d0cb', '#e2e2df'];
const GRAPHITE = ['#16191d', '#1f2329', '#101214'];

/** The app's three themes, for the standalone preview generator. */
export const REVIEW_THEMES = [
  { id: 'stone', name: 'Stone', dark: false, bg: '#e2e2df', panel: '#d9d9d5', elev: '#d0d0cb', text: '#232322', dim: '#50504d' },
  { id: 'clay', name: 'Clay', dark: true, bg: '#37322d', panel: '#3f3933', elev: '#4a433c', text: '#f1ebe2', dim: '#c2b7a7' },
  { id: 'graphite', name: 'Graphite', dark: true, bg: '#101214', panel: '#16191d', elev: '#1f2329', text: '#e6e9ed', dim: '#8d96a1' },
];

const swatches = (colors: string[], surface: string): string =>
  `<div class="swatches" style="background:${surface}">${colors
    .map((color) => `<span class="swatch" style="background:${color}" title="${color}"></span>`)
    .join('')}</div>`;

const section = (config: Config): string => {
  const base = buildPalette(config);
  const stone = adjustPaletteForContrast(base, STONE);
  const graphite = adjustPaletteForContrast(base, GRAPHITE);
  return `
  <section>
    <h2>${config.name}</h2>
    <p class="blurb">${config.desc}</p>
    <div class="row"><span class="tag">Base</span>${swatches(base, '#e2e2df')}</div>
    <div class="row"><span class="tag">Stone (light)</span>${swatches(stone, '#e2e2df')}</div>
    <div class="row"><span class="tag">Graphite (dark)</span>${swatches(graphite, '#101214')}</div>
  </section>`;
};

export const PALETTE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Blob palette review</title>
<style>
  :root { --bg: #e2e2df; --panel: #d9d9d5; --text: #232322; --dim: #50504d; --border: #c4c4be; --highlight: #2f6fdc; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; }
  header { position: sticky; top: 0; z-index: 10; padding: 14px 20px; border-bottom: 1px solid var(--border); background: color-mix(in oklab, var(--bg) 86%, transparent); backdrop-filter: blur(10px); }
  header h1 { font-size: 15px; margin: 0 0 4px; }
  header p { margin: 0; color: var(--dim); max-width: 720px; }
  header a { color: var(--highlight); text-decoration: none; }
  main { padding: 18px 20px 80px; }
  section { margin-bottom: 26px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); margin: 0 0 4px; }
  .blurb { color: var(--dim); margin: 0 0 10px; font-size: 12px; }
  .row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .tag { width: 110px; flex: none; color: var(--dim); font-size: 11.5px; text-align: right; }
  .swatches { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; border-radius: 10px; }
  .swatch { width: 26px; height: 26px; border-radius: 999px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12); }
</style>
</head>
<body>
<header>
  <h1>Blob palette · yellows</h1>
  <p>Each variant's 24 colours on the base, light (Stone) and dark (Graphite) surfaces. Pick the yellow you like. <a href="/">← shape review</a></p>
</header>
<main>
  ${CONFIGS.map(section).join('\n  ')}
</main>
</body>
</html>
`;
