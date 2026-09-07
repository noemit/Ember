/**
 * Contact sheets for eyeballing glyphs without a browser:
 *   bun run glyph-arena/sheet.ts
 * Writes original/improved/candidate sheets (96px detail + 30px real size) as SVG + PNG
 * into /tmp/opencode/. CSS vars are baked in because librsvg doesn't resolve var().
 */
import { GLYPHS } from '../src/blob/glyphs';
import { IMPROVED } from './improved';
import { CANDIDATES } from './candidates';
import { glyphPaletteFor } from '../src/blob/contrast';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = '/tmp/opencode';
mkdirSync(OUT, { recursive: true });

const BG = '#101214';
const PANEL = '#16191d';
const TEXT = '#e6e9ed';
const PALETTE = glyphPaletteFor([PANEL, '#1f2329', BG]);

let uid = 0;
const prep = (body: string, color: string) =>
  body
    .replaceAll('{c}', color)
    .replaceAll('{id}', `s${uid++}`)
    .replaceAll('var(--background)', BG);

const cell = (name: string, body: string, color: string, x: number, y: number) => `
  <g transform="translate(${x + 24},${y + 18})">
    <rect x="-8" y="-8" width="112" height="112" rx="10" fill="${PANEL}"/>
    <svg viewBox="3 3 42 42" width="96" height="96"><g fill="${color}">${prep(body, color)}</g></svg>
  </g>
  <svg viewBox="3 3 42 42" x="${x + 140}" y="${y + 34}" width="30" height="30"><g fill="${color}">${prep(body, color)}</g></svg>
  <text x="${x + 24}" y="${y + 140}" font-family="sans-serif" font-size="11" fill="${TEXT}">${name}</text>`;

const sheet = (title: string, entries: { name: string; body: string }[]) => {
  const cols = 5;
  const cw = 200;
  const ch = 152;
  const rows = Math.ceil(entries.length / cols);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${rows * ch + 40}" viewBox="0 0 ${cols * cw} ${rows * ch + 40}">
  <rect width="100%" height="100%" fill="${BG}"/>
  <text x="12" y="24" font-family="sans-serif" font-size="14" fill="${TEXT}">${title} — 96px + 30px, glyph colour #3</text>
  ${entries.map((e, i) => cell(e.name, e.body, PALETTE[3], (i % cols) * cw, 40 + Math.floor(i / cols) * ch)).join('')}
</svg>`;
  return svg;
};

const write = (file: string, svg: string) => {
  writeFileSync(`${OUT}/${file}.svg`, svg);
  console.log(`wrote ${OUT}/${file}.svg`);
};

write('sheet-originals', sheet('originals', GLYPHS));
write('sheet-improved', sheet('improved', IMPROVED));
write('sheet-candidates', sheet('candidates', CANDIDATES));
