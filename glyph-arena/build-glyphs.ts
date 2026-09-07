/**
 * Rebuilds src/blob/glyphs.ts from the arena ratings + improved + candidates, and bakes every
 * background accent (fill/stroke="var(--background)") into the path geometry as a real hole:
 *
 *   union(all colour fills) − union(accent regions)
 *
 * so cut-outs are genuinely transparent (the surface behind shows through) instead of painted
 * with a background colour. Stroke accents (seams, stripes) become thin bands first.
 *
 *   bun run glyph-arena/build-glyphs.ts
 */
import { JSDOM } from 'jsdom';
import { readFileSync, writeFileSync } from 'node:fs';
import { ORIGINALS } from './originals';
import { IMPROVED } from './improved';
import { CANDIDATES } from './candidates';

// ---------------------------------------------------------------------------
// paper.js setup: geometry only, no rendering — jsdom + a stub 2D context.
// ---------------------------------------------------------------------------
const dom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).DOMParser = dom.window.DOMParser;
(globalThis as any).XMLSerializer = dom.window.XMLSerializer;
const stubCtx: any = new Proxy(
  {},
  {
    get(_t, prop: any) {
      if (prop === 'canvas') return { width: 48, height: 48 };
      return () => undefined;
    },
    set() {
      return true;
    },
  }
);
(dom.window.HTMLCanvasElement.prototype as any).getContext = function () {
  return stubCtx;
};

const paperModule: any = await import('paper');
const paper = paperModule.default ?? paperModule;
const canvas: any = dom.window.document.createElement('canvas');
canvas.width = 48;
canvas.height = 48;
paper.setup(canvas);

// ---------------------------------------------------------------------------
// Sentinels for classification (exact colours, so component comparison is safe).
// ---------------------------------------------------------------------------
const COLOR = '#010203'; // {c} → colour fill / stroke
const HOLE = '#ff00ff'; // var(--background) → to be subtracted
const isColor = (c: any) => !!c && Math.abs(c.red - 1 / 255) < 1e-6 && Math.abs(c.green - 2 / 255) < 1e-6 && Math.abs(c.blue - 3 / 255) < 1e-6;
const isHole = (c: any) => !!c && c.red === 1 && c.green === 0 && c.blue === 1;

const flatten = (item: any): any[] => {
  const out: any[] = [];
  for (const child of item.removeChildren()) {
    if (child.className === 'Group' || child.className === 'Layer') out.push(...flatten(child));
    else if (child.className === 'Shape') out.push(child.toPath(true));
    else out.push(child);
  }
  return out;
};

/** Stroke accent → filled band (outline offset both sides of the path). */
const strokeToBand = (item: any): any => {
  const w = (item.strokeWidth || 2) / 2;
  const length = item.length;
  const steps = Math.max(8, Math.ceil(length / 1.5));
  const left: any[] = [];
  const right: any[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const offset = (length * i) / steps;
    const point = item.getPointAt(offset);
    const normal = item.getNormalAt(offset);
    left.push(new paper.Point(point.x + normal.x * w, point.y + normal.y * w));
    right.push(new paper.Point(point.x - normal.x * w, point.y - normal.y * w));
  }
  return new paper.Path([...left, ...right.reverse()]);
};

const unionAll = (items: any[]): any =>
  items.reduce((acc, item) => (acc ? (acc.unite(item) as any) : item.clone({ insert: false })), null as any);

/** Bakes var(--background) accents of one glyph body into true holes, preserving z-order:
 *  an accent carves the colour fills below it; fills painted after it stay intact on top. */
const hollow = (body: string, name: string): string => {
  if (!body.includes('var(--background)')) return body;
  const markup = body
    .replaceAll('{c}', COLOR)
    .replaceAll('{id}', `h${name.replace(/[^a-z0-9]/gi, '')}`)
    .replaceAll('var(--background)', HOLE);
  const imported = paper.project.importSVG(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="${COLOR}" stroke="none">${markup}</svg>`
  );
  const items = flatten(imported)
    .filter((item) => !(item.fillColor == null && item.strokeColor == null))
    .filter((item) => !item.isEmpty?.());

  // An accent erases what's beneath it, so a colour fill is carved by every accent that is
  // painted AFTER it. Walk the items, accumulating hole unions from the end.
  let holeUnion: any = null;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const isHoleAccent = isHole(item.fillColor) || isHole(item.strokeColor);
    item.holesAfter = holeUnion;
    if (isHoleAccent) {
      const regions: any[] =
        isHole(item.fillColor)
          ? [item]
          : (item.className === 'CompoundPath' ? item.children : [item]).map(strokeToBand);
      for (const region of regions) holeUnion = holeUnion ? holeUnion.unite(region) : region;
    }
  }
  const pieces: string[] = [];
  for (const item of items) {
    const fill = isColor(item.fillColor) ? 'color' : isHole(item.fillColor) ? 'hole' : null;
    const stroke = isColor(item.strokeColor) ? 'color' : isHole(item.strokeColor) ? 'hole' : null;
    if (fill === 'hole' || stroke === 'hole') continue;
    if (fill === 'color') {
      const carved = item.holesAfter ? item.subtract(item.holesAfter) : item;
      const d = carved.getPathData(null, 2);
      if (d) pieces.push(`<path d="${d}"/>`);
    } else if (stroke === 'color') {
      const attrs = [
        `fill="none"`,
        `stroke="{c}"`,
        `stroke-width="${+item.strokeWidth.toFixed(2)}"`,
        item.strokeCap ? `stroke-linecap="${item.strokeCap}"` : '',
        item.strokeJoin && item.strokeJoin !== 'miter' ? `stroke-linejoin="${item.strokeJoin}"` : '',
      ].filter(Boolean);
      pieces.push(`<path d="${item.getPathData(null, 2)}" ${attrs.join(' ')}/>`);
    } else {
      throw new Error(`${name}: unclassified element (fill=${String(item.fillColor)}, stroke=${String(item.strokeColor)})`);
    }
  }
  imported.remove();
  if (pieces.join('').includes(HOLE)) throw new Error(`${name}: accent leaked into output`);
  return pieces.join('');
};

// ---------------------------------------------------------------------------
// Assemble the set: AB winners (skips are cuts) minus agreed removals + kept candidates.
// ---------------------------------------------------------------------------
const ratings = JSON.parse(readFileSync(new URL('./ratings.json', import.meta.url), 'utf8'));
const { ab, candidates: cand, removals } = ratings;

type Glyph = { name: string; body: string };
const lines: Glyph[] = [];
for (const g of ORIGINALS) {
  const choice = ab[g.name];
  if (choice === 'skip' || removals[g.name] === 'agree') continue;
  const improved = IMPROVED.find((i) => i.name === g.name);
  const body = choice === 'improved' && improved ? improved.body : g.body;
  lines.push({ name: g.name, body: hollow(body, g.name) });
}
for (const c of CANDIDATES) {
  if (cand[c.name] === 'keep') lines.push({ name: c.name, body: hollow(c.body, c.name) });
}

const names = lines.map((l) => l.name);
if (new Set(names).size !== names.length) throw new Error('duplicate glyph names');
const leftover = lines.filter((l) => l.body.includes('var(--background)'));
if (leftover.length) throw new Error(`un-hollowed accents remain: ${leftover.map((l) => l.name).join(', ')}`);

const header = [
  '/**',
  ' * Hand-drawn 48x48 glyphs, curated through glyph-arena (bun run arena; rebuild via',
  ' * glyph-arena/build-glyphs.ts). `{c}` is the glyph colour and `{id}` a per-instance prefix for',
  ' * internal ids. Cut-outs are baked into the paths as real holes, so accents are genuinely',
  ' * transparent on any surface.',
  ' */',
  'export type Glyph = { name: string; body: string };',
  '',
  'export const GLYPHS: Glyph[] = [',
];
const out =
  header.join('\n') +
  '\n' +
  lines.map((e) => `  { name: ${JSON.stringify(e.name)}, body: ${JSON.stringify(e.body)} },`).join('\n') +
  '\n];\n';
writeFileSync(new URL('../src/blob/glyphs.ts', import.meta.url), out);

const hollowed = lines.filter((l, i) => l.body !== [ORIGINALS, []].flat()[0] || true).length;
console.log(`wrote src/blob/glyphs.ts — ${lines.length} glyphs`);
console.log('names:', names.join(', '));
process.exit(0);
