import { GROK_COLORS, GROK_SHAPES, type GrokShape } from '../src/blob/grok';

const TILTS = [-4, 3, -2, 5, -3, 2, -5, 4];

const renderBlob = (shape: GrokShape, colorIndex: number, tilt: number): string => {
  const color = GROK_COLORS[colorIndex % GROK_COLORS.length];
  const eye = (x: number) => `
        <g transform="translate(${x} ${shape.eyeY}) scale(${shape.eyeScale})">
          <ellipse rx="12" ry="13.5" fill="#ffffff" />
          <g class="pupil"><circle r="6.5" fill="${color.ink}" /><circle cx="-2.2" cy="-2.4" r="2" fill="#ffffff" /></g>
        </g>`;
  return `
  <div class="blob" style="--fill:${color.fill};--ink:${color.ink}">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g class="hop">
        <g transform="rotate(${tilt} 50 50)">
          <g class="body"><path d="${shape.path}" fill="var(--fill)" /></g>
          <g class="eyes">${eye(shape.eyeX - shape.eyeGap)}${eye(shape.eyeX + shape.eyeGap)}</g>
        </g>
      </g>
    </svg>
  </div>`;
};

const card = (shape: GrokShape, colorIndex: number, tilt: number, group: string): string => `
  <button class="card" type="button" data-name="${shape.name}" data-group="${group}">
    <div class="stage">${renderBlob(shape, colorIndex, tilt)}</div>
    <span class="label">${shape.name}</span>
  </button>`;

const handDrawn = GROK_SHAPES.filter((shape) => !/^c\d\d$/.test(shape.name));
const generated = GROK_SHAPES.filter((shape) => /^c\d\d$/.test(shape.name));
const currentCards = handDrawn.map((shape, index) => card(shape, index, TILTS[index % TILTS.length], 'current')).join('');
const candidateCards = generated.map((shape, index) =>
  card(shape, index + handDrawn.length, TILTS[(index + 3) % TILTS.length], 'proposed')
).join('');

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Buddy shape review</title>
<style>
  :root {
    --size: 76px;
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
    background: color-mix(in oklab, var(--bg) 86%, transparent);
    backdrop-filter: blur(10px);
  }
  header h1 { font-size: 15px; margin: 0 8px 0 0; letter-spacing: 0.01em; }
  header p { margin: 0; color: var(--dim); flex: 1 1 260px; min-width: 200px; }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  .controls label { display: inline-flex; align-items: center; gap: 6px; color: var(--dim); }
  input[type=range] { width: 130px; accent-color: var(--accent); }
  .toggle {
    display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
    border: 1px solid var(--border); background: var(--panel); color: var(--text);
    border-radius: 999px; padding: 5px 11px; font-size: 12px;
  }
  .toggle[aria-pressed=true] { border-color: var(--accent); color: var(--accent); }
  main { padding: 18px 20px 90px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); margin: 22px 0 10px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .card {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    width: calc(var(--size) + 56px); padding: 14px 10px 10px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
    color: var(--text); cursor: pointer; transition: border-color 120ms, transform 120ms, background 120ms;
  }
  .card:hover { transform: translateY(-1px); }
  .card.picked { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 30%, transparent); }
  .stage { display: grid; place-items: center; height: calc(var(--size) + 8px); }
  .label { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--dim); }
  .card.picked .label { color: var(--accent); }
  .blob svg { display: block; width: var(--size); height: var(--size); overflow: visible; }
  .blob .body { transform-box: view-box; transform-origin: 50% 50%; }
  .blob .hop { transform-box: view-box; transform-origin: 50% 50%; }
  .blob .pupil { transition: transform 90ms linear; }
  body.animate .blob .hop { animation: breathe 4.2s ease-in-out infinite; }
  body.hop .blob .hop { animation: hop 0.9s cubic-bezier(0.4, 0, 0.5, 1) infinite; }
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
  footer .picks { flex: 1; min-width: 0; color: var(--dim); font-family: ui-monospace, monospace; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  footer button {
    border: 1px solid var(--border); background: var(--panel); color: var(--text);
    border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 12px;
  }
  footer button.primary { border-color: var(--accent); color: var(--accent); }
</style>
</head>
<body class="animate">
<header>
  <h1>Buddy shape review</h1>
  <p>Every shipped silhouette. <strong>Hand-drawn</strong> are the originals; <strong>Generated</strong> are radial-harmonic blobs. Resize and toggle hops to see how they hold up small. <a href="/states" style="color:var(--accent)">state review →</a></p>
  <div class="controls">
    <label>Size <input id="size" type="range" min="24" max="120" value="76" /></label>
    <button class="toggle" id="animate" aria-pressed="true">Breathe</button>
    <button class="toggle" id="hop" aria-pressed="false">Hops</button>
    <button class="toggle" id="dark" aria-pressed="false">Dark</button>
  </div>
</header>
<main>
  <h2>Hand-drawn · ${handDrawn.length}</h2>
  <div class="grid">${currentCards}</div>
  <h2>Generated · ${generated.length}</h2>
  <div class="grid">${candidateCards}</div>
</main>
<footer>
  <span class="picks" id="picks">No shapes picked yet.</span>
  <button id="copy">Copy names</button>
  <button id="clear">Clear</button>
</footer>
<script>
  const root = document.documentElement;
  const body = document.body;
  const size = document.getElementById('size');
  size.addEventListener('input', () => root.style.setProperty('--size', size.value + 'px'));
  const bindToggle = (id, cls) => {
    const el = document.getElementById(id);
    el.addEventListener('click', () => {
      const on = el.getAttribute('aria-pressed') !== 'true';
      el.setAttribute('aria-pressed', String(on));
      body.classList.toggle(cls, on);
    });
  };
  bindToggle('animate', 'animate');
  bindToggle('hop', 'hop');
  bindToggle('dark', 'dark');
  const picked = new Set();
  const picks = document.getElementById('picks');
  const renderPicks = () => {
    picks.textContent = picked.size ? [...picked].join(', ') : 'No shapes picked yet.';
  };
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => {
      const name = card.dataset.name;
      if (picked.has(name)) { picked.delete(name); card.classList.remove('picked'); }
      else { picked.add(name); card.classList.add('picked'); }
      renderPicks();
    });
  });
  document.getElementById('copy').addEventListener('click', async () => {
    const text = [...picked].join(', ');
    try { await navigator.clipboard.writeText(text); picks.textContent = 'Copied: ' + text; }
    catch { picks.textContent = text; }
  });
  document.getElementById('clear').addEventListener('click', () => {
    picked.clear();
    document.querySelectorAll('.card.picked').forEach((card) => card.classList.remove('picked'));
    renderPicks();
  });
</script>
</body>
</html>`;
