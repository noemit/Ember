import { GROK_COLORS, GROK_SHAPES, type GrokShape } from '../src/blob/grok';

type EyeStyle = 'normal' | 'wide' | 'x' | 'dizzy' | 'sad' | 'up' | 'roam';
type OverlayStyle =
  | 'none'
  | 'orbit'
  | 'pulse'
  | 'dashed'
  | 'dashedSoft'
  | 'dashedArc'
  | 'dottedRing'
  | 'dashedDouble'
  | 'glow'
  | 'exclaim'
  | 'errorBadge'
  | 'question'
  | 'lock'
  | 'dots'
  | 'sparkle'
  | 'bubble'
  | 'crack'
  | 'tear'
  | 'halo';
type MotionStyle = 'none' | 'breathe' | 'bounce' | 'hopflip' | 'wobble' | 'shake' | 'tilt';

export type StateDesign = {
  id: string;
  state: 'busy' | 'thinking' | 'input' | 'question' | 'error';
  name: string;
  description: string;
  eyes: EyeStyle;
  overlay: OverlayStyle;
  motion: MotionStyle;
  accent: 'highlight' | 'warning' | 'danger';
};

export const STATE_DESIGNS: StateDesign[] = [
  // Busy — the agent is working (tools running). Baseline to compare thinking against.
  { id: 'b-hop', state: 'busy', name: 'Hop + flip (current)', description: 'The shipped busy state: hops with an occasional somersault.', eyes: 'normal', overlay: 'none', motion: 'hopflip', accent: 'highlight' },
  { id: 'b-hop-only', state: 'busy', name: 'Hop only', description: 'Steady hops, no somersault.', eyes: 'normal', overlay: 'none', motion: 'bounce', accent: 'highlight' },
  { id: 'b-breathe', state: 'busy', name: 'Calm breathe', description: 'A quieter working pulse.', eyes: 'normal', overlay: 'none', motion: 'breathe', accent: 'highlight' },
  { id: 'b-pulse', state: 'busy', name: 'Pulse ring', description: 'A working pulse around the body.', eyes: 'normal', overlay: 'pulse', motion: 'hopflip', accent: 'highlight' },

  // Thinking — model reasoning, distinct from tool work.
  { id: 't-dots', state: 'thinking', name: 'Dots', description: 'Three thought dots rise and fade above the head.', eyes: 'normal', overlay: 'dots', motion: 'breathe', accent: 'highlight' },
  { id: 't-lookup', state: 'thinking', name: 'Looking up', description: 'Pupils drift up while the dots pulse.', eyes: 'up', overlay: 'dots', motion: 'breathe', accent: 'highlight' },
  { id: 't-roam', state: 'thinking', name: 'Looking around', description: 'Pupils wander in different directions as the dots pulse.', eyes: 'roam', overlay: 'dots', motion: 'breathe', accent: 'highlight' },
  { id: 't-sparkle', state: 'thinking', name: 'Sparkle', description: 'A twinkle at the shoulder, like an idea forming.', eyes: 'normal', overlay: 'sparkle', motion: 'breathe', accent: 'highlight' },
  { id: 't-dashed', state: 'thinking', name: 'Dashed ring', description: 'A turning dashed ring reads as "processing".', eyes: 'normal', overlay: 'dashed', motion: 'breathe', accent: 'highlight' },
  { id: 't-dashed-soft', state: 'thinking', name: 'Dashed · soft', description: 'A faint, slow dashed ring — barely there.', eyes: 'normal', overlay: 'dashedSoft', motion: 'breathe', accent: 'highlight' },
  { id: 't-dashed-arc', state: 'thinking', name: 'Dashed · arc', description: 'A single soft arc, loading-style.', eyes: 'normal', overlay: 'dashedArc', motion: 'breathe', accent: 'highlight' },
  { id: 't-dotted', state: 'thinking', name: 'Dotted ring', description: 'A ring of soft dots.', eyes: 'normal', overlay: 'dottedRing', motion: 'breathe', accent: 'highlight' },
  { id: 't-dashed-double', state: 'thinking', name: 'Dashed · double', description: 'Two faint rings turning opposite ways.', eyes: 'normal', overlay: 'dashedDouble', motion: 'breathe', accent: 'highlight' },
  { id: 't-glow', state: 'thinking', name: 'Glow', description: 'A soft pulsing aura behind the body.', eyes: 'normal', overlay: 'glow', motion: 'none', accent: 'highlight' },
  { id: 't-bubble', state: 'thinking', name: 'Thought bubble', description: 'A literal bubble with an ellipsis.', eyes: 'normal', overlay: 'bubble', motion: 'breathe', accent: 'highlight' },

  // Input — a pending permission/approval.
  { id: 'i-orbit', state: 'input', name: 'Orbit', description: 'The current tilted orbit marker.', eyes: 'normal', overlay: 'orbit', motion: 'none', accent: 'warning' },
  { id: 'i-exclaim', state: 'input', name: 'Alert badge', description: 'An amber "!" badge plus a nervous wobble.', eyes: 'normal', overlay: 'exclaim', motion: 'wobble', accent: 'warning' },
  { id: 'i-lock', state: 'input', name: 'Lock badge', description: 'A padlock badge for a permission request.', eyes: 'normal', overlay: 'lock', motion: 'wobble', accent: 'warning' },
  { id: 'i-pulse', state: 'input', name: 'Pulse ring', description: 'A ring pulses outward until you answer.', eyes: 'normal', overlay: 'pulse', motion: 'none', accent: 'warning' },
  { id: 'i-halo', state: 'input', name: 'Halo', description: 'A glowing ring hovers overhead.', eyes: 'normal', overlay: 'halo', motion: 'breathe', accent: 'warning' },

  // Question — the agent asking something.
  { id: 'q-badge', state: 'question', name: 'Question badge', description: 'A "?" badge with a gentle wobble.', eyes: 'normal', overlay: 'question', motion: 'wobble', accent: 'highlight' },
  { id: 'q-orbit', state: 'question', name: 'Orbit', description: 'The current orbit, tinted for a question.', eyes: 'normal', overlay: 'orbit', motion: 'none', accent: 'highlight' },
  { id: 'q-bubble', state: 'question', name: 'Speech bubble', description: 'A speech bubble with a "?" above.', eyes: 'normal', overlay: 'bubble', motion: 'breathe', accent: 'highlight' },
  { id: 'q-tilt', state: 'question', name: 'Head tilt', description: 'A quizzical tilt under the "?" badge.', eyes: 'normal', overlay: 'question', motion: 'tilt', accent: 'highlight' },
  { id: 'q-worried', state: 'question', name: 'Worried', description: 'Raised brows asking for an answer.', eyes: 'sad', overlay: 'question', motion: 'breathe', accent: 'highlight' },

  // Error — the last turn failed.
  { id: 'e-x', state: 'error', name: 'X eyes', description: 'The current crossed eyes and shake.', eyes: 'x', overlay: 'none', motion: 'shake', accent: 'danger' },
  { id: 'e-dizzy', state: 'error', name: 'Dizzy', description: 'Spiral eyes and a woozy wobble.', eyes: 'dizzy', overlay: 'none', motion: 'wobble', accent: 'danger' },
  { id: 'e-sad', state: 'error', name: 'Sad + tear', description: 'Drooping brows and a single tear.', eyes: 'sad', overlay: 'tear', motion: 'breathe', accent: 'danger' },
  { id: 'e-badge', state: 'error', name: 'Warning triangle', description: 'A red triangle badge — distinct from the round input alert.', eyes: 'normal', overlay: 'errorBadge', motion: 'shake', accent: 'danger' },
  { id: 'e-crack', state: 'error', name: 'Cracked', description: 'X eyes with a crack across the body.', eyes: 'x', overlay: 'crack', motion: 'shake', accent: 'danger' },
];

const SHAPE: GrokShape = GROK_SHAPES.find((shape) => shape.name === 'jelly') ?? GROK_SHAPES[0];
const COLOR = GROK_COLORS.find((color) => color.name === 'violet') ?? GROK_COLORS[0];

const renderEye = (design: StateDesign, x: number): string => {
  const inner = (() => {
    switch (design.eyes) {
      case 'x':
        return `<g stroke="${COLOR.ink}" stroke-width="3" stroke-linecap="round"><line x1="-5.5" y1="-5.5" x2="5.5" y2="5.5" /><line x1="-5.5" y1="5.5" x2="5.5" y2="-5.5" /></g>`;
      case 'dizzy':
        return `<g fill="none" stroke="${COLOR.ink}" stroke-width="2.4"><circle r="6" /><circle r="2.6" /></g>`;
      case 'wide':
        return `<ellipse rx="13.5" ry="15" fill="#ffffff" /><circle cy="-0.5" r="4.6" fill="${COLOR.ink}" /><circle cx="-1.6" cy="-2.2" r="1.5" fill="#ffffff" />`;
      case 'sad':
        return `<ellipse rx="12" ry="13.5" fill="#ffffff" /><circle r="6.5" fill="${COLOR.ink}" /><circle cx="-2.2" cy="-2.4" r="2" fill="#ffffff" /><line x1="-7" y1="-18" x2="5" y2="-14" stroke="${COLOR.ink}" stroke-width="2.4" stroke-linecap="round" />`;
      case 'up':
        return `<ellipse rx="12" ry="13.5" fill="#ffffff" /><g transform="translate(0 -3.4)"><circle r="6.5" fill="${COLOR.ink}" /><circle cx="-2.2" cy="-2.4" r="2" fill="#ffffff" /></g>`;
      case 'roam':
        return `<ellipse rx="12" ry="13.5" fill="#ffffff" /><g class="ov-roam"><circle r="6.5" fill="${COLOR.ink}" /><circle cx="-2.2" cy="-2.4" r="2" fill="#ffffff" /></g>`;
      default:
        return `<ellipse rx="12" ry="13.5" fill="#ffffff" /><circle r="6.5" fill="${COLOR.ink}" /><circle cx="-2.2" cy="-2.4" r="2" fill="#ffffff" />`;
    }
  })();
  return `<g transform="translate(${x} 0)">${inner}</g>`;
};

const roundBadge = (glyph: string): string => `
  <g class="ov-badge">
    <circle cx="79" cy="21" r="13" fill="var(--accent)" stroke="var(--bg)" stroke-width="2.5" />
    <text x="79" y="27" text-anchor="middle" font-size="17" font-weight="700" fill="#ffffff">${glyph}</text>
  </g>`;

const renderOverlay = (design: StateDesign): { back: string; front: string } => {
  const a = 'var(--accent)';
  switch (design.overlay) {
    case 'orbit':
      return {
        back: '',
        front: `<g transform="rotate(-18 50 50)"><ellipse cx="50" cy="50" rx="56" ry="22" fill="none" stroke="${a}" stroke-width="3.5" opacity="0.85" /><circle cx="106" cy="50" r="4.5" fill="${a}" /></g>`,
      };
    case 'pulse':
      return { back: `<circle class="ov-pulse" cx="50" cy="50" r="44" fill="none" stroke="${a}" stroke-width="3" />`, front: '' };
    case 'dashed':
      return { back: '', front: `<circle class="ov-spin" cx="50" cy="50" r="48" fill="none" stroke="${a}" stroke-width="3" stroke-dasharray="6 11" stroke-linecap="round" />` };
    case 'dashedSoft':
      return { back: '', front: `<circle class="ov-spin-slow" cx="50" cy="50" r="50" fill="none" stroke="${a}" stroke-width="2" stroke-dasharray="2 15" stroke-linecap="round" opacity="0.55" />` };
    case 'dashedArc':
      return { back: '', front: `<circle class="ov-spin" cx="50" cy="50" r="48" fill="none" stroke="${a}" stroke-width="3" stroke-dasharray="64 238" stroke-linecap="round" opacity="0.9" />` };
    case 'dottedRing':
      return { back: '', front: `<circle class="ov-spin-slow" cx="50" cy="50" r="50" fill="none" stroke="${a}" stroke-width="2.6" stroke-dasharray="0.5 9" stroke-linecap="round" opacity="0.6" />` };
    case 'dashedDouble':
      return {
        back: '',
        front: `<circle class="ov-spin-slow" cx="50" cy="50" r="54" fill="none" stroke="${a}" stroke-width="1.6" stroke-dasharray="1 10" stroke-linecap="round" opacity="0.5" /><circle class="ov-spin-rev" cx="50" cy="50" r="45" fill="none" stroke="${a}" stroke-width="2.4" stroke-dasharray="10 16" stroke-linecap="round" opacity="0.6" />`,
      };
    case 'glow':
      return { back: `<circle class="ov-glow" cx="50" cy="50" r="42" fill="${a}" opacity="0.28" />`, front: '' };
    case 'exclaim':
      return { back: '', front: roundBadge('!') };
    case 'question':
      return { back: '', front: roundBadge('?') };
    case 'errorBadge':
      return {
        back: '',
        front: `
        <g class="ov-badge">
          <path d="M79 7 L93 32 H65 Z" fill="${a}" stroke="var(--bg)" stroke-width="2.5" stroke-linejoin="round" />
          <text x="79" y="28" text-anchor="middle" font-size="15" font-weight="700" fill="#ffffff">!</text>
        </g>`,
      };
    case 'lock':
      return {
        back: '',
        front: `
        <g class="ov-badge">
          <circle cx="79" cy="21" r="13" fill="${a}" stroke="var(--bg)" stroke-width="2.5" />
          <rect x="73.5" y="19.5" width="11" height="8.5" rx="1.8" fill="none" stroke="#ffffff" stroke-width="2" />
          <path d="M75.5 19.5 v-1.5 a3.5 3.5 0 0 1 7 0 V19.5" fill="none" stroke="#ffffff" stroke-width="2" />
        </g>`,
      };
    case 'dots':
      return {
        back: '',
        front: `
        <g class="ov-dots" fill="${a}">
          <circle class="d1" cx="36" cy="16" r="4" />
          <circle class="d2" cx="50" cy="11" r="4" />
          <circle class="d3" cx="64" cy="16" r="4" />
        </g>`,
      };
    case 'sparkle':
      return { back: '', front: `<path class="ov-sparkle" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" fill="${a}" transform="translate(78 22)" />` };
    case 'bubble':
      return {
        back: '',
        front: `
        <g class="ov-bubble">
          <rect x="58" y="2" width="38" height="22" rx="9" fill="var(--panel)" stroke="${a}" stroke-width="2" />
          <path d="M66 24 L62 31 L74 24 Z" fill="var(--panel)" stroke="${a}" stroke-width="2" />
          <circle cx="70" cy="13" r="2.3" fill="${a}" /><circle cx="77" cy="13" r="2.3" fill="${a}" /><circle cx="84" cy="13" r="2.3" fill="${a}" />
        </g>`,
      };
    case 'crack':
      return { back: '', front: `<path d="M40 14 L48 38 L38 50 L52 78 L46 84" fill="none" stroke="var(--bg)" stroke-width="2.6" stroke-linejoin="round" opacity="0.85" />` };
    case 'tear':
      return { back: '', front: `<path class="ov-tear" d="M0 0 C 4.5 6 6 9 0 11 C -6 9 -4.5 6 0 0 Z" fill="#7cc4ff" transform="translate(37 66)" />` };
    case 'halo':
      return { back: '', front: `<ellipse class="ov-halo" cx="50" cy="12" rx="19" ry="5.5" fill="none" stroke="${a}" stroke-width="4" />` };
    default:
      return { back: '', front: '' };
  }
};

const renderBlob = (design: StateDesign): string => {
  const overlay = renderOverlay(design);
  return `
  <div class="blob motion-${design.motion}" style="--accent:var(--${design.accent})">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g class="overlay-back">${overlay.back}</g>
      <g class="hop">
        <g class="flip">
          <g transform="rotate(3 50 50)">
            <g class="body"><path d="${SHAPE.path}" fill="${COLOR.fill}" /></g>
            <g class="eyes" transform="translate(0 ${SHAPE.eyeY}) scale(${SHAPE.eyeScale})">
              ${renderEye(design, SHAPE.eyeX - SHAPE.eyeGap)}${renderEye(design, SHAPE.eyeX + SHAPE.eyeGap)}
            </g>
          </g>
        </g>
      </g>
      <g class="overlay-front">${overlay.front}</g>
    </svg>
  </div>`;
};

const card = (design: StateDesign): string => `
  <button class="card" type="button" data-name="${design.id}">
    <div class="stage">${renderBlob(design)}</div>
    <span class="label">${design.name}</span>
    <span class="desc">${design.description}</span>
  </button>`;

const section = (state: StateDesign['state'], title: string, blurb: string): string => {
  const designs = STATE_DESIGNS.filter((design) => design.state === state);
  return `<section><h2>${title}</h2><p class="blurb">${blurb}</p><div class="grid">${designs.map(card).join('')}</div></section>`;
};

export const STATES_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Buddy state review</title>
<style>
  :root {
    --size: 92px;
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
  input[type=range] { width: 120px; accent-color: var(--highlight); }
  .toggle { border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 999px; padding: 5px 11px; font-size: 12px; cursor: pointer; }
  .toggle[aria-pressed=true] { border-color: var(--highlight); color: var(--highlight); }
  main { padding: 18px 20px 90px; }
  section { margin-bottom: 26px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); margin: 0 0 4px; }
  .blurb { color: var(--dim); margin: 0 0 12px; font-size: 12px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .card {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    width: 176px; padding: 16px 12px 12px; text-align: center;
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
    color: var(--text); cursor: pointer; transition: border-color 120ms, transform 120ms;
  }
  .card:hover { transform: translateY(-1px); }
  .card.picked { border-color: var(--highlight); box-shadow: 0 0 0 3px color-mix(in oklab, var(--highlight) 30%, transparent); }
  .stage { display: grid; place-items: center; height: calc(var(--size) + 14px); }
  .label { font-weight: 600; font-size: 12.5px; }
  .desc { color: var(--dim); font-size: 11px; line-height: 1.35; }
  .blob svg { display: block; width: var(--size); height: var(--size); overflow: visible; transform-origin: 50% 50%; }
  .blob .hop, .blob .flip { transform-box: view-box; transform-origin: 50% 50%; }
  .blob .overlay-back, .blob .overlay-front { pointer-events: none; }
  .motion-breathe .hop { animation: breathe 3.2s ease-in-out infinite; }
  .motion-bounce .hop { animation: bounce 0.9s cubic-bezier(0.4, 0, 0.5, 1) infinite; }
  .motion-hopflip .hop { animation: bounce 0.9s cubic-bezier(0.4, 0, 0.5, 1) infinite; }
  .motion-hopflip .flip { animation: flip 4s cubic-bezier(0.62, 0, 0.38, 1) infinite; }
  .motion-wobble svg { animation: wobble 1.6s ease-in-out infinite; }
  .motion-shake svg { animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite; }
  .motion-tilt svg { animation: tilt 2.6s ease-in-out infinite; }
  .ov-spin { transform-box: view-box; transform-origin: 50% 50%; animation: spin 4s linear infinite; }
  .ov-spin-slow { transform-box: view-box; transform-origin: 50% 50%; animation: spin 9s linear infinite; }
  .ov-spin-rev { transform-box: view-box; transform-origin: 50% 50%; animation: spinRev 7s linear infinite; }
  .ov-pulse { transform-box: view-box; transform-origin: 50% 50%; animation: pulse 1.8s ease-out infinite; }
  .ov-glow { transform-box: view-box; transform-origin: 50% 50%; filter: blur(6px); animation: glow 2.4s ease-in-out infinite; }
  .ov-halo { animation: halo 2.2s ease-in-out infinite; }
  .ov-sparkle { transform-box: view-box; transform-origin: 78px 22px; animation: twinkle 1.8s ease-in-out infinite; }
  .ov-dots circle { animation: dot 1.4s ease-in-out infinite; }
  .ov-dots .d2 { animation-delay: 0.2s; }
  .ov-dots .d3 { animation-delay: 0.4s; }
  .ov-roam { animation: roam 3.6s ease-in-out infinite; }
  .ov-tear { animation: tear 2s ease-in infinite; }
  .ov-bubble { animation: bob 2.6s ease-in-out infinite; transform-box: view-box; transform-origin: 77px 13px; }
  @keyframes breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.04, 0.96); } }
  @keyframes bounce { 0%, 100% { transform: translateY(0) scale(1, 1); } 40% { transform: translateY(-20%) scale(0.94, 1.1); } 75% { transform: translateY(0) scale(1.08, 0.9); } }
  @keyframes flip { 0%, 74% { transform: rotate(0deg); } 88% { transform: rotate(360deg); } 100% { transform: rotate(360deg); } }
  @keyframes wobble { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-5deg); } 75% { transform: rotate(5deg); } }
  @keyframes shake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); } 30%, 50%, 70% { transform: translateX(-3px); } 40%, 60% { transform: translateX(3px); } }
  @keyframes tilt { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(5deg); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes spinRev { to { transform: rotate(-360deg); } }
  @keyframes pulse { 0% { transform: scale(0.82); opacity: 0.85; } 100% { transform: scale(1.22); opacity: 0; } }
  @keyframes glow { 0%, 100% { transform: scale(0.94); opacity: 0.18; } 50% { transform: scale(1.06); opacity: 0.34; } }
  @keyframes halo { 0%, 100% { transform: translateY(0); opacity: 0.85; } 50% { transform: translateY(-3px); opacity: 1; } }
  @keyframes twinkle { 0%, 100% { transform: scale(0.7); opacity: 0.5; } 50% { transform: scale(1.15); opacity: 1; } }
  @keyframes dot { 0%, 100% { transform: translateY(0); opacity: 0.45; } 50% { transform: translateY(-4px); opacity: 1; } }
  @keyframes roam {
    0%, 100% { transform: translate(0, -3); }
    15% { transform: translate(-4, -2); }
    32% { transform: translate(4, -2); }
    50% { transform: translate(0, 1); }
    68% { transform: translate(-4, 1); }
    85% { transform: translate(4, -1); }
  }
  @keyframes tear { 0% { transform: translateY(0); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(10px); opacity: 0; } }
  @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
  footer {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
    display: flex; align-items: center; gap: 12px; padding: 12px 20px;
    border-top: 1px solid var(--border); background: color-mix(in oklab, var(--bg) 90%, transparent); backdrop-filter: blur(10px);
  }
  footer .picks { flex: 1; min-width: 0; color: var(--dim); font-family: ui-monospace, monospace; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  footer button { border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>Buddy state review</h1>
  <p>Alternatives for the blob's state visuals. Click to shortlist. <a href="/">← shape review</a></p>
  <div class="controls">
    <label>Size <input id="size" type="range" min="48" max="140" value="92" /></label>
    <button class="toggle" id="dark" aria-pressed="false">Dark</button>
  </div>
</header>
<main>
  ${section('busy', 'Busy', 'The agent is working (tools running) — the baseline the thinking designs should be distinct from.')}
  ${section('thinking', 'Thinking', 'The model is reasoning. Includes soft dashed-ring variants and a "looking around" state.')}
  ${section('input', 'Input · permission', 'The agent is blocked on an approval.')}
  ${section('question', 'Question', 'The agent is asking you something.')}
  ${section('error', 'Error', 'The last turn failed.')}
</main>
<footer>
  <span class="picks" id="picks">No designs picked yet.</span>
  <button id="copy">Copy names</button>
  <button id="clear">Clear</button>
</footer>
<script>
  const root = document.documentElement;
  const body = document.body;
  const size = document.getElementById('size');
  size.addEventListener('input', () => root.style.setProperty('--size', size.value + 'px'));
  const dark = document.getElementById('dark');
  dark.addEventListener('click', () => {
    const on = dark.getAttribute('aria-pressed') !== 'true';
    dark.setAttribute('aria-pressed', String(on));
    body.classList.toggle('dark', on);
  });
  const picked = new Set();
  const picks = document.getElementById('picks');
  const render = () => { picks.textContent = picked.size ? [...picked].join(', ') : 'No designs picked yet.'; };
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => {
      const name = card.dataset.name;
      if (picked.has(name)) { picked.delete(name); card.classList.remove('picked'); }
      else { picked.add(name); card.classList.add('picked'); }
      render();
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
    render();
  });
</script>
</body>
</html>`;
