/**
 * Eye-stretch review for the Buddy hop. The shipped busy hop squashes and stretches the whole hop
 * group (body + eyes together). This page counter-scales the eyes by a tunable factor so they
 * deform less while the body keeps its squash-and-stretch. Nothing here is imported by the app.
 *
 *   bun run buddy-arena/server.ts  →  http://localhost:3004/hop
 */
import { GROK_COLORS, GROK_SHAPES } from '../src/blob/grok';

const SHAPE = GROK_SHAPES.find((shape) => shape.name === 'jelly') ?? GROK_SHAPES[0];
const COLOR = GROK_COLORS.find((color) => color.name === 'violet') ?? GROK_COLORS[0];

/** The shipped `blob-hop` keyframes, as (scaleX, scaleY) per stop. */
const HOP_FRAMES: Array<{ stop: string; sx: number; sy: number }> = [
  { stop: '0%, 100%', sx: 1, sy: 1 },
  { stop: '10%', sx: 1.12, sy: 0.86 },
  { stop: '42%', sx: 0.9, sy: 1.14 },
  { stop: '62%', sx: 0.92, sy: 1.12 },
  { stop: '82%', sx: 1.16, sy: 0.82 },
  { stop: '92%', sx: 0.97, sy: 1.04 },
];

/**
 * Counter-scale the eyes so they deform `factor` less than the body. `factor` 0 keeps the shipped
 * look (eyes stretch with the body); 1 fully cancels the hop's scale so the eyes stay rigid.
 */
const counterKeyframes = (name: string, factor: number): string =>
  `@keyframes ${name} { ${HOP_FRAMES.map(({ stop, sx, sy }) => {
    const cx = 1 + factor * (1 / sx - 1);
    const cy = 1 + factor * (1 / sy - 1);
    return `${stop} { transform: scale(${cx.toFixed(4)}, ${cy.toFixed(4)}); }`;
  }).join(' ')} }`;

const animationName = (factor: number): string => `eyes-${Math.round(factor * 100)}`;

const eye = (x: number): string =>
  `<g transform="translate(${x} ${SHAPE.eyeY}) scale(${SHAPE.eyeScale})"><ellipse rx="12" ry="13.5" fill="#ffffff" /><circle r="6.5" fill="${COLOR.ink}" /><circle cx="-2.2" cy="-2.4" r="2" fill="#ffffff" /></g>`;

const blob = (animation: string): string => `
  <div class="blob">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g class="hop">
        <g class="body"><path d="${SHAPE.path}" fill="${COLOR.fill}" /></g>
        <g class="eyes" style="animation-name: ${animation}">${eye(SHAPE.eyeX - SHAPE.eyeGap)}${eye(SHAPE.eyeX + SHAPE.eyeGap)}</g>
      </g>
    </svg>
  </div>`;

const FACTORS = [
  { value: 0, label: 'Current', desc: 'Eyes squash and stretch with the body — what ships today.' },
  { value: 0.5, label: 'Half', desc: 'Eyes deform half as much.' },
  { value: 0.75, label: 'Most', desc: 'Eyes mostly keep their shape.' },
  { value: 1, label: 'Rigid', desc: 'Eyes fully counter-scale; the body still squashes.' },
];

const card = (factor: number, label: string, desc: string): string => `
  <div class="card">
    <div class="stage">${blob(animationName(factor))}</div>
    <span class="label">${label} · ${Math.round(factor * 100)}%</span>
    <span class="desc">${desc}</span>
  </div>`;

export const HOP_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Buddy hop · eye stretch</title>
<style>
  :root {
    --size: 96px;
    --bg: #e2e2df; --panel: #d9d9d5; --elev: #d0d0cb;
    --text: #232322; --dim: #50504d; --border: #c4c4be;
    --highlight: #2f6fdc; --warning: #b06a00; --danger: #c0392b;
  }
  body.dark {
    --bg: #151413; --panel: #1b1a18; --elev: #242220;
    --text: #efece7; --dim: #9b958c; --border: #2c2a26;
    --highlight: #4cc2ff; --warning: #f0b36b; --danger: #ff6b6b;
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
  header a { color: var(--highlight); text-decoration: none; }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  input[type=range] { width: 140px; accent-color: var(--highlight); }
  .size-value { display: inline-block; width: 42px; color: var(--text); font-variant-numeric: tabular-nums; }
  .toggle { border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 999px; padding: 5px 11px; font-size: 12px; cursor: pointer; }
  .toggle[aria-pressed=true] { border-color: var(--highlight); color: var(--highlight); }
  main { padding: 18px 20px 90px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); margin: 0 0 4px; }
  .blurb { color: var(--dim); margin: 0 0 12px; font-size: 12px; max-width: 640px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .card {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    width: 190px; padding: 16px 12px 12px; text-align: center;
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
    color: var(--text);
  }
  .stage { display: grid; place-items: center; height: calc(var(--size) + 34px); }
  .label { font-weight: 600; font-size: 12.5px; }
  .desc { color: var(--dim); font-size: 11px; line-height: 1.35; }
  .tune input[type=range] { width: 100%; }
  .blob svg { display: block; width: var(--size); height: var(--size); overflow: visible; }
  /* The shipped hop: squash/stretch around the viewBox centre. */
  .blob .hop {
    transform-box: view-box; transform-origin: 50% 50%;
    animation: hop 0.9s cubic-bezier(0.4, 0, 0.5, 1) infinite;
  }
  /* Eyes counter-scale around their own centre; per-blob animation-name comes from the markup. */
  .blob .eyes {
    transform-box: fill-box; transform-origin: center;
    animation-duration: 0.9s;
    animation-timing-function: cubic-bezier(0.4, 0, 0.5, 1);
    animation-iteration-count: infinite;
  }
  /* 42% of 0.9s = the peak vertical stretch (scale 0.9, 1.14). */
  body.frozen .hop, body.frozen .eyes { animation-play-state: paused; animation-delay: -0.378s; }
  @keyframes hop {
    0%, 100% { transform: translateY(0) scale(1, 1); }
    10% { transform: translateY(2%) scale(1.12, 0.86); }
    42% { transform: translateY(-26%) scale(0.9, 1.14); }
    62% { transform: translateY(-26%) scale(0.92, 1.12); }
    82% { transform: translateY(0) scale(1.16, 0.82); }
    92% { transform: translateY(-5%) scale(0.97, 1.04); }
  }
  ${FACTORS.map((factor) => counterKeyframes(animationName(factor.value), factor.value)).join('\n  ')}
</style>
</head>
<body>
<header>
  <h1>Buddy hop · eye stretch</h1>
  <p>The hop squashes the whole group, so the eyes deform with the body. These counter-scale the eyes by a factor — 0% is what ships, 100% keeps them rigid. <a href="/">← shape review</a></p>
  <div class="controls">
    <label>Size <input id="size" type="range" min="56" max="150" value="96" /> <span class="size-value" id="sizeValue">96px</span></label>
    <button class="toggle" id="freeze" aria-pressed="false">Freeze at peak</button>
    <button class="toggle" id="dark" aria-pressed="false">Dark</button>
  </div>
</header>
<main>
  <h2>Counter-stretch</h2>
  <p class="blurb">Compare live, then hit “Freeze at peak” to inspect the exact stretched frame side by side. The tuned value is the one I'd hard-code.</p>
  <div class="grid">
    ${FACTORS.map((factor) => card(factor.value, factor.label, factor.desc)).join('\n    ')}
    <div class="card tune">
      <div class="stage">${blob('eyes-tune')}</div>
      <span class="label">Tune</span>
      <input id="tune" type="range" min="0" max="100" value="50" />
      <span class="desc"><strong id="tuneValue">50%</strong> counter-stretch</span>
    </div>
  </div>
</main>
<style id="tuneStyle"></style>
<script>
  var HOP_FRAMES = ${JSON.stringify(HOP_FRAMES)};
  var root = document.documentElement;
  var body = document.body;

  var size = document.getElementById('size');
  var sizeValue = document.getElementById('sizeValue');
  size.addEventListener('input', function () {
    root.style.setProperty('--size', size.value + 'px');
    sizeValue.textContent = size.value + 'px';
  });

  var dark = document.getElementById('dark');
  dark.addEventListener('click', function () {
    var on = dark.getAttribute('aria-pressed') !== 'true';
    dark.setAttribute('aria-pressed', String(on));
    body.classList.toggle('dark', on);
  });

  var freeze = document.getElementById('freeze');
  freeze.addEventListener('click', function () {
    var on = freeze.getAttribute('aria-pressed') !== 'true';
    freeze.setAttribute('aria-pressed', String(on));
    body.classList.toggle('frozen', on);
  });

  function counterKeyframes(name, factor) {
    var stops = HOP_FRAMES.map(function (frame) {
      var cx = 1 + factor * (1 / frame.sx - 1);
      var cy = 1 + factor * (1 / frame.sy - 1);
      return frame.stop + ' { transform: scale(' + cx.toFixed(4) + ', ' + cy.toFixed(4) + '); }';
    }).join(' ');
    return '@keyframes ' + name + ' { ' + stops + ' }';
  }

  var tuneStyle = document.getElementById('tuneStyle');
  var tune = document.getElementById('tune');
  var tuneValue = document.getElementById('tuneValue');
  function updateTune() {
    var factor = Number(tune.value) / 100;
    tuneValue.textContent = Math.round(factor * 100) + '%';
    tuneStyle.textContent = counterKeyframes('eyes-tune', factor);
  }
  tune.addEventListener('input', updateTune);
  updateTune();
</script>
</body>
</html>
`;
