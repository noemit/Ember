/**
 * Review page for the chat header's thinking-display toggle. The shipped icon is the same lucide
 * brain with only fill / outline / dash to tell the three states apart, which reads as three
 * identical icons at 14px. This page compares alternatives at real size. Nothing here is imported
 * by the app.
 *
 *   bun run buddy-arena/server.ts  →  http://localhost:3004/thinking
 */

/** lucide's `brain` node (ISC). Kept verbatim so the base glyph is the shipped one. */
const BRAIN_PATHS = [
  'M12 18V5',
  'M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4',
  'M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5',
  'M17.997 5.125a4 4 0 0 1 2.526 5.77',
  'M18 18a4 4 0 0 0 2-7.464',
  'M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517',
  'M6 18a4 4 0 0 1-2-7.464',
  'M6.003 5.125a4 4 0 0 0-2.526 5.77',
];

const BRAIN = BRAIN_PATHS.map((d) => `<path d="${d}"/>`).join('');
/** Casing behind overlaid marks; matches the button surface so the mark reads as a clean cut. */
const CASING = 'var(--panel)';

const BAR = `<line x1="4.5" y1="12" x2="19.5" y2="12" stroke="currentColor" stroke-width="2.2"/>`;
const SLASH = `<line x1="3.5" y1="3.5" x2="20.5" y2="20.5" stroke="currentColor" stroke-width="2.2"/>`;
const CROSS = `<line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2.2"/><line x1="20" y1="4" x2="4" y2="20" stroke="currentColor" stroke-width="2.2"/>`;

const CASED_BAR = `<g stroke-width="5" stroke="${CASING}"><line x1="4.5" y1="12" x2="19.5" y2="12"/></g>${BAR}`;
const CASED_SLASH = `<g stroke-width="5" stroke="${CASING}"><line x1="3.5" y1="3.5" x2="20.5" y2="20.5"/></g>${SLASH}`;
const CASED_CROSS = `<g stroke-width="5" stroke="${CASING}"><line x1="4" y1="4" x2="20" y2="20"/><line x1="20" y1="4" x2="4" y2="20"/></g>${CROSS}`;

/** The brain inverted on a filled chip — reads as "on" at any size. */
const CHIP = `<rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="currentColor"/>${BRAIN_PATHS.map(
  (d) => `<path d="${d}" stroke="${CASING}"/>`
).join('')}`;

const icon = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

type Icons = { expanded: string; collapsed: string; hidden: string };
type Option = { id: string; name: string; desc: string; icons: Icons };

export const OPTIONS: Option[] = [
  {
    id: 'current',
    name: 'Current (shipped)',
    desc: 'Filled / outline / dashed — all the same brain, so they blur together.',
    icons: {
      expanded: `<g fill="currentColor">${BRAIN}</g>`,
      collapsed: BRAIN,
      hidden: `<g stroke-dasharray="2.5 2.5">${BRAIN}</g>`,
    },
  },
  {
    id: 'bar',
    name: 'A · Bar / slash',
    desc: 'Expanded is a plain brain; collapsed gets a bold bar; hidden gets a slash.',
    icons: {
      expanded: BRAIN,
      collapsed: `${BRAIN}${CASED_BAR}`,
      hidden: `${BRAIN}${CASED_SLASH}`,
    },
  },
  {
    id: 'chip',
    name: 'B · Chip / slash',
    desc: 'Expanded is the brain inverted on a filled chip (unmistakably "on"); collapsed is plain; hidden is slashed.',
    icons: {
      expanded: CHIP,
      collapsed: BRAIN,
      hidden: `${BRAIN}${CASED_SLASH}`,
    },
  },
  {
    id: 'hybrid',
    name: 'C · Chip / bar / slash',
    desc: 'Strongest separation: filled chip when expanded, bar when collapsed, slash when hidden.',
    icons: {
      expanded: CHIP,
      collapsed: `${BRAIN}${CASED_BAR}`,
      hidden: `${BRAIN}${CASED_SLASH}`,
    },
  },
  {
    id: 'bar-cross',
    name: 'D · Bar / cross',
    desc: 'Like A, but hidden uses an × instead of a slash.',
    icons: {
      expanded: BRAIN,
      collapsed: `${BRAIN}${CASED_BAR}`,
      hidden: `${BRAIN}${CASED_CROSS}`,
    },
  },
];

const STATE_LABELS: Array<keyof Icons> = ['expanded', 'collapsed', 'hidden'];
const STATE_TITLES: Record<keyof Icons, string> = {
  expanded: 'Expanded',
  collapsed: 'Collapsed',
  hidden: 'Hidden',
};

const card = (option: Option, state: keyof Icons): string => `
  <div class="card">
    <div class="btn-row">
      <span class="btn" title="${STATE_TITLES[state]}">${icon(option.icons[state])}</span>
      <span class="btn big" title="${STATE_TITLES[state]}">${icon(option.icons[state])}</span>
    </div>
    <span class="label">${STATE_TITLES[state]}</span>
  </div>`;

const section = (option: Option): string => `
  <section>
    <h2>${option.name}</h2>
    <p class="blurb">${option.desc}</p>
    <div class="grid">${STATE_LABELS.map((state) => card(option, state)).join('')}</div>
  </section>`;

export const THINKING_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Thinking toggle review</title>
<style>
  :root {
    --icon-size: 14px;
    --bg: #e2e2df; --panel: #d9d9d5; --elev: #d0d0cb;
    --text: #232322; --dim: #50504d; --border: #c4c4be;
    --highlight: #2f6fdc;
  }
  body.dark {
    --bg: #151413; --panel: #1b1a18; --elev: #242220;
    --text: #efece7; --dim: #9b958c; --border: #2c2a26;
    --highlight: #4cc2ff;
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
  input[type=range] { width: 150px; accent-color: var(--highlight); }
  .size-value { display: inline-block; width: 46px; color: var(--text); font-variant-numeric: tabular-nums; }
  .toggle { border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 999px; padding: 5px 11px; font-size: 12px; cursor: pointer; }
  .toggle[aria-pressed=true] { border-color: var(--highlight); color: var(--highlight); }
  main { padding: 18px 20px 80px; }
  section { margin-bottom: 24px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); margin: 0 0 4px; }
  .blurb { color: var(--dim); margin: 0 0 12px; font-size: 12px; max-width: 720px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .card {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    width: 190px; padding: 16px 12px 12px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
  }
  .btn-row { display: flex; align-items: center; gap: 14px; height: 44px; }
  /* Mirrors the real header button: outline variant, h-7, px-2, rounded-md. */
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    height: 28px; padding: 0 8px; font-size: var(--icon-size); line-height: 1;
    background: var(--panel); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px;
  }
  .btn.big { height: 40px; padding: 0 12px; font-size: 28px; }
  .label { font-weight: 600; font-size: 12.5px; }
  .context { display: flex; align-items: center; gap: 6px; padding: 10px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; width: fit-content; }
</style>
</head>
<body>
<header>
  <h1>Thinking toggle</h1>
  <p>The header button cycles thinking display: expanded → collapsed → hidden. Same brain in all three today, told apart only by fill/outline/dash. Compare alternatives below at the real 14px. <a href="/">← shape review</a></p>
  <div class="controls">
    <label>Icon size <input id="size" type="range" min="12" max="32" value="14" /> <span class="size-value" id="sizeValue">14px</span></label>
    <button class="toggle" id="dark" aria-pressed="false">Dark</button>
  </div>
</header>
<main>
  ${OPTIONS.map(section).join('\n  ')}
  <section>
    <h2>In context (14px)</h2>
    <p class="blurb">How each option's three states sit next to the tool-call wrench in the header row.</p>
    ${OPTIONS.map((option) => `
      <div class="context" style="margin-bottom:8px">
        ${STATE_LABELS.map((state) => `<span class="btn" title="${option.name} · ${STATE_TITLES[state]}">${icon(option.icons[state])}</span>`).join('')}
        <span style="width:8px"></span>
        <span class="btn" title="Tool calls">${icon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>')}</span>
      </div>`).join('')}
  </section>
</main>
<script>
  var root = document.documentElement;
  var size = document.getElementById('size');
  var sizeValue = document.getElementById('sizeValue');
  size.addEventListener('input', function () {
    root.style.setProperty('--icon-size', size.value + 'px');
    sizeValue.textContent = size.value + 'px';
  });
  var dark = document.getElementById('dark');
  dark.addEventListener('click', function () {
    var on = dark.getAttribute('aria-pressed') !== 'true';
    dark.setAttribute('aria-pressed', String(on));
    document.body.classList.toggle('dark', on);
  });
</script>
</body>
</html>
`;
