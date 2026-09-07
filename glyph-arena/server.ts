/**
 * Glyph Arena — a one-off playground for reviewing src/blob/glyphs.ts.
 *
 *   bun run arena   →  http://localhost:5799
 *
 * Serves the current glyphs side-by-side with improved variants (blind A/B), new candidate
 * glyphs, and removal suggestions. Every pick/like is POSTed here, appended to
 * glyph-arena/ratings.log and folded into glyph-arena/ratings.json.
 */
import { GLYPHS } from '../src/blob/glyphs';
import { IMPROVED } from './improved';
import { CANDIDATES } from './candidates';
import { REMOVAL_SUGGESTIONS } from './removals';
import { ensureContrast } from '../src/blob/contrast';
import { PAGE } from './page';

// Must be a published container port (see /workspace/AGENTS.md): 3000–3010, bound to 0.0.0.0,
// reachable from the user's Mac at http://100.70.127.78:<port>.
const PORT = Number(process.env.ARENA_PORT || 3002);
const ROOT = import.meta.dir;
const DOC_PATH = `${ROOT}/ratings.json`;
const LOG_PATH = `${ROOT}/ratings.log`;

type Ratings = {
  ab: Record<string, string>;
  candidates: Record<string, string>;
  removals: Record<string, string>;
  likes: Record<string, boolean>;
};

const EMPTY: Ratings = { ab: {}, candidates: {}, removals: {}, likes: {} };

const readDoc = async (): Promise<Ratings> => {
  try {
    return { ...EMPTY, ...(await Bun.file(DOC_PATH).json()) };
  } catch {
    return { ...EMPTY };
  }
};

const appendLog = async (entry: Record<string, unknown>) => {
  const line = `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`;
  await Bun.write(LOG_PATH, line, { append: true, createPath: true });
};

const buildSummary = (state: Ratings) => {
  const abValues = Object.values(state.ab);
  const kept = CANDIDATES.filter((c) => state.candidates[c.name] === 'keep').map((c) => c.name);
  const dropped = CANDIDATES.filter((c) => state.candidates[c.name] === 'drop').map((c) => c.name);
  const agreed = REMOVAL_SUGGESTIONS.filter((r) => state.removals[r.name] === 'agree').map((r) => r.name);
  const disagreed = REMOVAL_SUGGESTIONS.filter((r) => state.removals[r.name] === 'disagree').map((r) => r.name);
  return {
    pairs: {
      total: GLYPHS.length,
      decided: abValues.filter((v) => v !== 'skip').length,
      preferredImproved: abValues.filter((v) => v === 'improved').length,
      preferredOriginal: abValues.filter((v) => v === 'original').length,
      skipped: abValues.filter((v) => v === 'skip').length,
      undecided: GLYPHS.length - abValues.length,
    },
    candidates: {
      total: CANDIDATES.length,
      kept,
      dropped,
      undecided: CANDIDATES.filter((c) => !state.candidates[c.name]).map((c) => c.name),
    },
    removals: {
      total: REMOVAL_SUGGESTIONS.length,
      agreed,
      disagreed,
      undecided: REMOVAL_SUGGESTIONS.filter((r) => !state.removals[r.name]).map((r) => r.name),
    },
    liked: Object.keys(state.likes).sort(),
  };
};

const persist = async (state: Ratings) => {
  const doc = {
    savedAt: new Date().toISOString(),
    note: 'Glyph Arena results. ab: original|improved|skip per glyph; likes keyed by glyph:variant.',
    ab: state.ab,
    candidates: state.candidates,
    removals: state.removals,
    likes: state.likes,
    summary: buildSummary(state),
  };
  await Bun.write(DOC_PATH, `${JSON.stringify(doc, null, 2)}\n`, { createPath: true });
  return doc;
};

// Fresher palettes than the app's classic GLYPH_COLORS, adjusted per theme with the same
// ensureContrast the app uses. Nothing lands in src until a palette is picked here.
const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = ([r, g, b]: [number, number, number]): string =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
const hslToRgb = ([h, s, l]: [number, number, number]): [number, number, number] => {
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
};
const genPalette = (satBase: number, satStep: number, lightBase: number, lightStep: number): string[] =>
  Array.from({ length: 64 }, (_, index) => {
    const hue = ((index * 137.508) % 360) / 360;
    return rgbToHex(hslToRgb([hue, satBase + (index % 4) * satStep, lightBase + (Math.floor(index / 4) % 4) * lightStep]));
  });

const FRESH_PRESETS: Record<string, { name: string; args: [number, number, number, number] }> = {
  classic: { name: 'Classic', args: [0.58, 0.06, 0.42, 0.055] },
  fresh: { name: 'Fresh', args: [0.72, 0.05, 0.5, 0.05] },
  punch: { name: 'Punchy', args: [0.82, 0.04, 0.55, 0.045] },
};

const THEMES = {
  light: {
    bg: '#e2e2df',
    panel: '#d9d9d5',
    elev: '#d0d0cb',
    border: '#c4c4be',
    text: '#232322',
    dim: '#50504d',
    palettes: Object.fromEntries(
      Object.entries(FRESH_PRESETS).map(([id, p]) => [
        id,
        genPalette(...p.args).map((color) => ensureContrast(color, ['#d9d9d5', '#d0d0cb', '#e2e2df'])),
      ])
    ),
  },
  dark: {
    bg: '#101214',
    panel: '#16191d',
    elev: '#1f2329',
    border: '#262c34',
    text: '#e6e9ed',
    dim: '#8d96a1',
    palettes: Object.fromEntries(
      Object.entries(FRESH_PRESETS).map(([id, p]) => [
        id,
        genPalette(...p.args).map((color) => ensureContrast(color, ['#16191d', '#1f2329', '#101214'])),
      ])
    ),
  },
};

const pairs = GLYPHS.map((g) => {
  const improved = IMPROVED.find((i) => i.name === g.name);
  return {
    name: g.name,
    original: g.body,
    improved: improved?.body ?? '',
    note: improved?.note ?? '',
  };
});

/** The set as rated: AB winners (skips are cuts), minus agreed removals, plus kept candidates. */
const buildFinalSet = (state: Ratings): Array<{ name: string; body: string; source: string }> => {
  const out: Array<{ name: string; body: string; source: string }> = [];
  for (const g of GLYPHS) {
    const choice = state.ab[g.name];
    if (choice === 'skip' || state.removals[g.name] === 'agree') continue;
    const improved = IMPROVED.find((i) => i.name === g.name);
    if (choice === 'improved' && improved) out.push({ name: g.name, body: improved.body, source: 'improved' });
    else out.push({ name: g.name, body: g.body, source: 'original' });
  }
  for (const c of CANDIDATES) {
    if (state.candidates[c.name] === 'keep') out.push({ name: c.name, body: c.body, source: 'new' });
  }
  return out;
};

const data = async () => ({
  pairs,
  candidates: CANDIDATES,
  removals: REMOVAL_SUGGESTIONS.map((r) => ({
    ...r,
    body: GLYPHS.find((g) => g.name === r.name)?.body ?? '',
  })),
  themes: THEMES,
  final: buildFinalSet(await readDoc()),
  palettePresets: Object.entries(FRESH_PRESETS).map(([id, p]) => ({ id, name: p.name })),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const server = Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  fetch: async (req) => {
    const url = new URL(req.url);
    const route = `${req.method} ${url.pathname}`;
    switch (route) {
      case 'GET /':
        return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      case 'GET /api/data':
        return json(await data());
      case 'GET /api/ratings': {
        const state = await readDoc();
        return json(await persist(state));
      }
      case 'POST /api/decision': {
        const body = (await req.json()) as { section?: keyof Ratings; name?: string; value?: string };
        const { section, name, value } = body;
        if (!section || !name || !(section in EMPTY)) return json({ error: 'bad decision' }, 400);
        const state = await readDoc();
        if (section === 'likes') {
          if (value === 'like') state.likes[name] = true;
          else delete state.likes[name];
        } else {
          state[section][name] = value;
        }
        await appendLog({ section, name, value });
        const doc = await persist(state);
        return json({ ok: true, summary: doc.summary });
      }
      case 'POST /api/reset': {
        await appendLog({ section: 'reset', name: '*', value: 'reset' });
        const doc = await persist({ ...EMPTY, ab: {}, candidates: {}, removals: {}, likes: {} });
        return json({ ok: true, summary: doc.summary });
      }
      default:
        return new Response('not found', { status: 404 });
    }
  },
});

console.log(`Glyph arena → http://localhost:${server.port}`);
console.log(`  ${pairs.length} A/B pairs, ${CANDIDATES.length} candidates, ${REMOVAL_SUGGESTIONS.length} removal suggestions`);
console.log(`  picks are logged to glyph-arena/ratings.log and saved to glyph-arena/ratings.json`);
