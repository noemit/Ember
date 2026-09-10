/**
 * Review page for the Buddy busy hop.
 *
 *   /hop  →  eye counter-stretch (how much the eyes deform during the hop) and hop cadence
 *            (how often the blob hops, and whether it rests between hops).
 *
 * The shipped hop squashes and stretches the whole hop group, so the eyes deform with the body.
 * `EYE_FACTOR` counter-scales them back; the cadence variants add rests and a small second hop.
 * Nothing here is imported by the app.
 *
 *   bun run buddy-arena/server.ts  →  http://localhost:3004/hop
 */
import { GROK_COLORS, GROK_SHAPES } from '../src/blob/grok';

const SHAPE = GROK_SHAPES.find((shape) => shape.name === 'jelly') ?? GROK_SHAPES[0];
const COLOR = GROK_COLORS.find((color) => color.name === 'violet') ?? GROK_COLORS[0];

/** One hop keyframe: translateY plus the squash/stretch scale. */
type Frame = { stop: string; ty: string; sx: number; sy: number };

/** The shipped `blob-hop` keyframes. */
const SHIPPED: Frame[] = [
  { stop: '0%, 100%', ty: '0', sx: 1, sy: 1 },
  { stop: '10%', ty: '2%', sx: 1.12, sy: 0.86 },
  { stop: '42%', ty: '-26%', sx: 0.9, sy: 1.14 },
  { stop: '62%', ty: '-26%', sx: 0.92, sy: 1.12 },
  { stop: '82%', ty: '0', sx: 1.16, sy: 0.82 },
  { stop: '92%', ty: '-5%', sx: 0.97, sy: 1.04 },
];

type Variant = { id: string; name: string; desc: string; duration: number; frames: Frame[] };

const CADENCE: Variant[] = [
  {
    id: 'shipped',
    name: 'Shipped',
    desc: 'A hop every 0.9s with no rest — the current busy loop.',
    duration: 0.9,
    frames: SHIPPED,
  },
  {
    id: 'pause',
    name: 'Pause after hop',
    desc: 'One hop, then roughly 40% of the cycle at rest.',
    duration: 1.7,
    frames: [
      { stop: '0%', ty: '0', sx: 1, sy: 1 },
      { stop: '6%', ty: '2%', sx: 1.12, sy: 0.86 },
      { stop: '24%', ty: '-25%', sx: 0.9, sy: 1.14 },
      { stop: '36%', ty: '-25%', sx: 0.92, sy: 1.12 },
      { stop: '48%', ty: '0', sx: 1.15, sy: 0.83 },
      { stop: '54%', ty: '-4%', sx: 0.98, sy: 1.03 },
      { stop: '62%, 100%', ty: '0', sx: 1, sy: 1 },
    ],
  },
  {
    id: 'double',
    name: 'Big + small hop',
    desc: 'A big hop, a little one, then a rest.',
    duration: 2.2,
    frames: [
      { stop: '0%', ty: '0', sx: 1, sy: 1 },
      { stop: '5%', ty: '2%', sx: 1.1, sy: 0.88 },
      { stop: '16%', ty: '-24%', sx: 0.9, sy: 1.14 },
      { stop: '24%', ty: '-24%', sx: 0.92, sy: 1.12 },
      { stop: '32%', ty: '0', sx: 1.14, sy: 0.84 },
      { stop: '38%', ty: '-10%', sx: 0.94, sy: 1.08 },
      { stop: '45%', ty: '0', sx: 1.08, sy: 0.9 },
      { stop: '52%', ty: '-3%', sx: 0.99, sy: 1.02 },
      { stop: '60%, 100%', ty: '0', sx: 1, sy: 1 },
    ],
  },
  {
    id: 'gentle',
    name: 'Gentle single',
    desc: 'A slower, lower hop (1.5s) with no hold.',
    duration: 1.5,
    frames: [
      { stop: '0%', ty: '0', sx: 1, sy: 1 },
      { stop: '10%', ty: '2%', sx: 1.1, sy: 0.88 },
      { stop: '40%', ty: '-18%', sx: 0.92, sy: 1.1 },
      { stop: '60%', ty: '-18%', sx: 0.94, sy: 1.08 },
      { stop: '82%', ty: '0', sx: 1.12, sy: 0.86 },
      { stop: '92%', ty: '-4%', sx: 0.98, sy: 1.03 },
      { stop: '100%', ty: '0', sx: 1, sy: 1 },
    ],
  },
  {
    id: 'small',
    name: 'Small hop only',
    desc: 'A subtler hop with a pause — barely a bounce.',
    duration: 1.2,
    frames: [
      { stop: '0%', ty: '0', sx: 1, sy: 1 },
      { stop: '8%', ty: '1%', sx: 1.06, sy: 0.94 },
      { stop: '30%', ty: '-12%', sx: 0.96, sy: 1.06 },
      { stop: '45%', ty: '0', sx: 1.07, sy: 0.93 },
      { stop: '52%', ty: '-3%', sx: 0.99, sy: 1.02 },
      { stop: '60%, 100%', ty: '0', sx: 1, sy: 1 },
    ],
  },
];

/** The chosen eye counter-stretch: 75% of the inverse of each hop scale. */
const EYE_FACTOR = 0.75;
const EYE_FACTORS = [0, 0.5, 0.75, 1];

const hopKeyframes = (name: string, frames: Frame[]): string =>
  `@keyframes ${name} { ${frames
    .map((frame) => `${frame.stop} { transform: translateY(${frame.ty}) scale(${frame.sx}, ${frame.sy}); }`)
    .join(' ')} }`;

const eyeKeyframes = (name: string, frames: Frame[], factor: number): string =>
  `@keyframes ${name} { ${frames
    .map((frame) => {
      const cx = 1 + factor * (1 / frame.sx - 1);
      const cy = 1 + factor * (1 / frame.sy - 1);
      return `${frame.stop} { transform: scale(${cx.toFixed(4)}, ${cy.toFixed(4)}); }`;
    })
    .join(' ')} }`;

const eye = (x: number): string =>
  `<g transform="translate(${x} ${SHAPE.eyeY}) scale(${SHAPE.eyeScale})"><ellipse rx="12" ry="13.5" fill="#ffffff" /><circle r="6.5" fill="${COLOR.ink}" /><circle cx="-2.2" cy="-2.4" r="2" fill="#ffffff" /></g>`;

const blob = (hopName: string, eyeName: string, duration: number): string => `
  <div class="blob" style="--dur: ${duration}s">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g class="hop" style="animation-name: ${hopName}">
        <g class="body"><path d="${SHAPE.path}" fill="${COLOR.fill}" /></g>
        <g class="eyes" style="animation-name: ${eyeName}">${eye(SHAPE.eyeX - SHAPE.eyeGap)}${eye(SHAPE.eyeX + SHAPE.eyeGap)}</g>
      </g>
    </svg>
  </div>`;

const factorCard = (factor: number, label: string, desc: string): string => `
  <div class="card">
    <div class="stage">${blob('hop-shipped', `eyes-${Math.round(factor * 100)}`, 0.9)}</div>
    <span class="label">${label} · ${Math.round(factor * 100)}%</span>
    <span class="desc">${desc}</span>
  </div>`;

const cadenceCard = (variant: Variant): string => `
  <div class="card">
    <div class="stage">${blob(`hop-${variant.id}`, `eye-${variant.id}`, variant.duration)}</div>
    <span class="label">${variant.name} · ${variant.duration}s</span>
    <span class="desc">${variant.desc}</span>
  </div>`;

const keyframeCss = [
  hopKeyframes('hop-shipped', SHIPPED),
  ...EYE_FACTORS.map((factor) => eyeKeyframes(`eyes-${Math.round(factor * 100)}`, SHIPPED, factor)),
  ...CADENCE.map((variant) => hopKeyframes(`hop-${variant.id}`, variant.frames)),
  ...CADENCE.map((variant) => eyeKeyframes(`eye-${variant.id}`, variant.frames, EYE_FACTOR)),
].join('\n  ');

export const HOP_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Buddy hop review</title>
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
  header p { margin: 0; color: var(--dim); flex: 1 1 280px; min-width: 220px; }
  header a { color: var(--highlight); text-decoration: none; }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  input[type=range] { width: 130px; accent-color: var(--highlight); }
  .size-value { display: inline-block; width: 42px; color: var(--text); font-variant-numeric: tabular-nums; }
  .toggle { border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 999px; padding: 5px 11px; font-size: 12px; cursor: pointer; }
  .toggle[aria-pressed=true] { border-color: var(--highlight); color: var(--highlight); }
  main { padding: 18px 20px 90px; }
  section { margin-bottom: 26px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); margin: 0 0 4px; }
  .blurb { color: var(--dim); margin: 0 0 12px; font-size: 12px; max-width: 720px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .card {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    width: 200px; padding: 16px 12px 12px; text-align: center;
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
    color: var(--text);
  }
  .stage { display: grid; place-items: center; height: calc(var(--size) + 36px); }
  .label { font-weight: 600; font-size: 12.5px; }
  .desc { color: var(--dim); font-size: 11px; line-height: 1.35; }
  .tune input[type=range] { width: 100%; }
  .blob svg { display: block; width: var(--size); height: var(--size); overflow: visible; }
  /* The hop squashes/stretches around the viewBox centre; the eyes counter-scale around their own. */
  .blob .hop {
    transform-box: view-box; transform-origin: 50% 50%;
    animation-duration: var(--dur, 0.9s);
    animation-timing-function: cubic-bezier(0.4, 0, 0.5, 1);
    animation-iteration-count: infinite;
  }
  .blob .eyes {
    transform-box: fill-box; transform-origin: center;
    animation-duration: var(--dur, 0.9s);
    animation-timing-function: cubic-bezier(0.4, 0, 0.5, 1);
    animation-iteration-count: infinite;
  }
  /* 42% of 0.9s = the shipped hop's peak vertical stretch. */
  body.frozen .eye-stretch .hop, body.frozen .eye-stretch .eyes { animation-play-state: paused; animation-delay: -0.378s; }
  /* Slow everything down 3x to inspect the shape of a hop. */
  body.slow .hop, body.slow .eyes { animation-duration: calc(var(--dur, 0.9s) * 3); }
  ${keyframeCss}
</style>
</head>
<body>
<header>
  <h1>Buddy hop review</h1>
  <p>Top: how much the eyes counter-stretch (75% is the current pick). Bottom: hop cadence — how often it hops and whether it rests. <a href="/">← shape review</a></p>
  <div class="controls">
    <label>Size <input id="size" type="range" min="56" max="150" value="96" /> <span class="size-value" id="sizeValue">96px</span></label>
    <button class="toggle" id="slow" aria-pressed="false">Slow-mo 0.3×</button>
    <button class="toggle" id="freeze" aria-pressed="false">Freeze peak</button>
    <button class="toggle" id="dark" aria-pressed="false">Dark</button>
  </div>
</header>
<main>
  <section>
    <h2>Eye counter-stretch</h2>
    <p class="blurb">The eyes deform less as the factor rises. “Freeze peak” parks these at the shipped hop's most stretched frame for a static look.</p>
    <div class="grid eye-stretch">
      ${factorCard(0, 'Current', 'Eyes stretch with the body.')}
      ${factorCard(0.5, 'Half', 'Eyes deform half as much.')}
      ${factorCard(0.75, 'Most', 'The pick — eyes mostly keep their shape.')}
      ${factorCard(1, 'Rigid', 'Eyes fully counter-scale.')}
      <div class="card tune">
        <div class="stage">${blob('hop-shipped', 'eyes-tune', 0.9)}</div>
        <span class="label">Tune</span>
        <input id="tune" type="range" min="0" max="100" value="75" />
        <span class="desc"><strong id="tuneValue">75%</strong> counter-stretch</span>
      </div>
    </div>
  </section>

  <section>
    <h2>Hop cadence</h2>
    <p class="blurb">All at the 75% eyes. Longer cycles and rest holds calm the loop; “Big + small hop” adds a little second bounce. Use Slow-mo to see the timing clearly.</p>
    <div class="grid">
      ${CADENCE.map(cadenceCard).join('\n      ')}
    </div>
  </section>
</main>
<style id="tuneStyle"></style>
<script>
  var SHIPPED = ${JSON.stringify(SHIPPED)};
  var root = document.documentElement;
  var body = document.body;

  var size = document.getElementById('size');
  var sizeValue = document.getElementById('sizeValue');
  size.addEventListener('input', function () {
    root.style.setProperty('--size', size.value + 'px');
    sizeValue.textContent = size.value + 'px';
  });

  function toggle(id, cls) {
    var el = document.getElementById(id);
    el.addEventListener('click', function () {
      var on = el.getAttribute('aria-pressed') !== 'true';
      el.setAttribute('aria-pressed', String(on));
      if (cls) body.classList.toggle(cls, on);
      else body.classList.toggle(id, on);
    });
  }
  toggle('slow');
  toggle('freeze');
  toggle('dark', 'dark');

  function eyeKeyframes(name, factor) {
    var stops = SHIPPED.map(function (frame) {
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
    tuneStyle.textContent = eyeKeyframes('eyes-tune', factor);
  }
  tune.addEventListener('input', updateTune);
  updateTune();
</script>
</body>
</html>
`;
