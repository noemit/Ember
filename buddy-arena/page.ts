import { GROK_COLORS, GROK_SHAPES, type GrokShape } from '../src/blob/grok';

const TILTS = [-4, 3, -2, 5, -3, 2, -5, 4];

const renderBlob = (shape: GrokShape, colorIndex: number, tilt: number, state: 'idle' | 'active'): string => {
  const color = GROK_COLORS[colorIndex % GROK_COLORS.length];
  const eye = (x: number) => `
        <g transform="translate(${x} ${shape.eyeY}) scale(${shape.eyeScale})">
          <ellipse rx="12" ry="13.5" fill="#ffffff" />
          <g class="pupil"><circle r="6.5" fill="${color.ink}" /><circle cx="-2.2" cy="-2.4" r="2" fill="#ffffff" /></g>
        </g>`;
  return `
  <div class="blob state-${state}" style="--fill:${color.fill};--ink:${color.ink}">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g class="hop">
        <g class="flip">
          <g transform="rotate(${tilt} 50 50)">
            <g class="body"><path d="${shape.path}" fill="var(--fill)" /></g>
            <g class="eyes">${eye(shape.eyeX - shape.eyeGap)}${eye(shape.eyeX + shape.eyeGap)}</g>
          </g>
        </g>
      </g>
    </svg>
  </div>`;
};

const card = (shape: GrokShape, colorIndex: number, tilt: number): string => `
  <button class="card" type="button" data-name="${shape.name}">
    <div class="pair">
      <div class="state">
        <div class="stage">${renderBlob(shape, colorIndex, tilt, 'idle')}</div>
        <span class="state-label">idle</span>
      </div>
      <div class="state">
        <div class="stage">${renderBlob(shape, colorIndex, tilt, 'active')}</div>
        <span class="state-label">active</span>
      </div>
    </div>
    <span class="label">${shape.name}</span>
  </button>`;

const handDrawn = GROK_SHAPES.filter((shape) => !/^c\d\d$/.test(shape.name));
const generated = GROK_SHAPES.filter((shape) => /^c\d\d$/.test(shape.name));
const currentCards = handDrawn.map((shape, index) => card(shape, index, TILTS[index % TILTS.length])).join('');
const candidateCards = generated
  .map((shape, index) => card(shape, index + handDrawn.length, TILTS[(index + 3) % TILTS.length]))
  .join('');

/** Teddy-bear head ideas: round head, two ear lobes on top, eyes low and wide. */
const TEDDY_IDEAS: GrokShape[] = [
  {
    name: 'teddy-a',
    path: 'M50 24 C54 15 62 11 68 15 C75 19 77 28 74 35 C85 41 89 52 87 60 C83 75 68 85 50 85 C32 85 17 75 13 60 C11 52 15 41 26 35 C23 28 25 19 32 15 C38 11 46 15 50 24 Z',
    eyeX: 50,
    eyeY: 54,
    eyeGap: 15,
    eyeScale: 1,
  },
  {
    name: 'teddy-b',
    path: 'M50 26 C55 13 66 9 73 16 C80 23 80 34 76 40 C88 47 92 59 88 68 C82 82 67 90 50 90 C33 90 18 82 12 68 C8 59 12 47 24 40 C20 34 20 23 27 16 C34 9 45 13 50 26 Z',
    eyeX: 50,
    eyeY: 57,
    eyeGap: 16,
    eyeScale: 1,
  },
  {
    name: 'teddy-c',
    path: 'M50 22 C53 13 61 10 67 14 C73 18 75 26 71 32 C84 38 90 50 87 61 C83 77 68 88 50 88 C32 88 17 77 13 61 C10 50 16 38 29 32 C25 26 27 18 33 14 C39 10 47 13 50 22 Z',
    eyeX: 50,
    eyeY: 56,
    eyeGap: 14,
    eyeScale: 1,
  },
];
const teddyCards = TEDDY_IDEAS.map((shape, index) => card(shape, index + 2, TILTS[index % TILTS.length])).join('');

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Buddy shape keep/drop</title>
<style>
  :root {
    --size: 55px;
    --bg: #e2e2df; --panel: #d9d9d5; --elev: #d0d0cb;
    --text: #232322; --dim: #50504d; --border: #c4c4be; --accent: #2f6fdc;
  }
  body.dark {
    --bg: #151413; --panel: #1b1a18; --elev: #242220;
    --text: #efece7; --dim: #9b958c; --border: #2c2a26; --accent: #ff7a1a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
  }
  header {
    position: sticky; top: 0; z-index: 10;
    display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    background: color-mix(in oklab, var(--bg) 86%, transparent); backdrop-filter: blur(10px);
  }
  header h1 { font-size: 15px; margin: 0 8px 0 0; }
  header p { margin: 0; color: var(--dim); flex: 1 1 260px; min-width: 200px; }
  header a { color: var(--accent); text-decoration: none; }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  input[type=range] { width: 120px; accent-color: var(--accent); }
  .size-value { display: inline-block; width: 42px; color: var(--text); font-variant-numeric: tabular-nums; }
  .toggle { border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 999px; padding: 5px 11px; font-size: 12px; cursor: pointer; }
  .toggle[aria-pressed=true] { border-color: var(--accent); color: var(--accent); }
  main { padding: 18px 20px 90px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); margin: 22px 0 10px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .card {
    position: relative;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 12px 14px 10px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
    color: var(--text); cursor: pointer; transition: border-color 120ms, transform 120ms, opacity 120ms;
  }
  .card:hover { transform: translateY(-1px); }
  .card.dropped { opacity: 0.42; }
  .card.dropped .label { text-decoration: line-through; }
  .card.dropped::after {
    content: 'dropped'; position: absolute; top: 8px; right: 10px;
    font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim);
  }
  .pair { display: flex; gap: 10px; }
  .state { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .state-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); }
  .stage { display: grid; place-items: center; height: calc(var(--size) + 22px); width: calc(var(--size) + 22px); }
  .label { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dim); }
  .blob svg { display: block; width: var(--size); height: var(--size); overflow: visible; }
  .blob .body { transform-box: fill-box; transform-origin: center; }
  .blob .hop, .blob .flip { transform-box: view-box; transform-origin: 50% 50%; }
  .blob .pupil { transition: transform 90ms linear; }
  .blob.state-idle .hop { animation: breathe 4.2s ease-in-out infinite; }
  .blob.state-active .hop { animation: hop 0.9s cubic-bezier(0.4, 0, 0.5, 1) infinite; }
  @keyframes breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.03, 0.97); } }
  @keyframes hop {
    0%, 100% { transform: translateY(0) scale(1, 1); }
    10% { transform: translateY(2%) scale(1.12, 0.86); }
    42% { transform: translateY(-26%) scale(0.9, 1.14); }
    62% { transform: translateY(-26%) scale(0.92, 1.12); }
    82% { transform: translateY(0) scale(1.16, 0.82); }
    92% { transform: translateY(-5%) scale(0.97, 1.04); }
  }
  footer {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
    display: flex; align-items: center; gap: 12px;
    padding: 12px 20px; border-top: 1px solid var(--border);
    background: color-mix(in oklab, var(--bg) 90%, transparent); backdrop-filter: blur(10px);
  }
  footer .picks { flex: 1; min-width: 0; color: var(--dim); font-size: 12px; }
  footer button {
    border: 1px solid var(--border); background: var(--panel); color: var(--text);
    border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 12px;
  }
  footer button.primary { border-color: var(--accent); color: var(--accent); }
</style>
</head>
<body>
<header>
  <h1>Buddy shape keep/drop</h1>
  <p>All ${GROK_SHAPES.length} silhouettes at 55px, idle and active. Click a shape to <strong>drop</strong> it — everything not dropped is kept. Copy the kept names when you're done. <a href="/states">state review →</a></p>
  <div class="controls">
    <label>Size <input id="size" type="range" min="30" max="120" value="55" /> <span class="size-value" id="sizeValue">55px</span></label>
    <button class="toggle" id="dark" aria-pressed="false">Dark</button>
  </div>
</header>
<main>
  <h2>Hand-drawn · ${handDrawn.length}</h2>
  <div class="grid">${currentCards}</div>
  <h2>Generated · ${generated.length}</h2>
  <div class="grid">${candidateCards}</div>
  <h2>New ideas · Teddy · ${TEDDY_IDEAS.length}</h2>
  <div class="grid">${teddyCards}</div>
</main>
<footer>
  <span class="picks" id="picks"></span>
  <button class="primary" id="copy">Copy kept names</button>
  <button id="reset">Reset</button>
</footer>
<script>
  const root = document.documentElement;
  const body = document.body;
  const size = document.getElementById('size');
  const sizeValue = document.getElementById('sizeValue');
  size.addEventListener('input', () => {
    root.style.setProperty('--size', size.value + 'px');
    sizeValue.textContent = size.value + 'px';
  });
  const dark = document.getElementById('dark');
  dark.addEventListener('click', () => {
    const on = dark.getAttribute('aria-pressed') !== 'true';
    dark.setAttribute('aria-pressed', String(on));
    body.classList.toggle('dark', on);
  });
  const all = [...document.querySelectorAll('.card')].map((card) => card.dataset.name);
  const dropped = new Set();
  const picks = document.getElementById('picks');
  const render = () => {
    const kept = all.filter((name) => !dropped.has(name));
    picks.textContent = kept.length + ' kept · ' + dropped.size + ' dropped';
    return kept;
  };
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => {
      const name = card.dataset.name;
      if (dropped.has(name)) { dropped.delete(name); card.classList.remove('dropped'); }
      else { dropped.add(name); card.classList.add('dropped'); }
      render();
    });
  });
  document.getElementById('copy').addEventListener('click', async () => {
    const text = render().join(', ');
    try { await navigator.clipboard.writeText(text); picks.textContent = 'Copied: ' + text; }
    catch { picks.textContent = text; }
  });
  document.getElementById('reset').addEventListener('click', () => {
    dropped.clear();
    document.querySelectorAll('.card.dropped').forEach((card) => card.classList.remove('dropped'));
    render();
  });
  render();
</script>
</body>
</html>`;
