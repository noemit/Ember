# Ember

Tiny Electron client for OpenChamber. One window shows the most recent sessions across every
connected instance listed in `~/.config/openchamber/settings.json`.

## Commands

- `bun run dev` — build renderer + electron, then launch Electron.
- `bun run dev:web` — renderer only under Vite with a mock bridge (`src/dev/mockBridge.ts`) so the UI
  can be exercised in a plain browser. The mock loads automatically when `window.ember` is absent.
- `bun run typecheck` — both tsconfigs (renderer + electron).
- `bun run test` — Bun regression tests for API pagination/failures, transport security, and theme contrast.
- `bun run build` — typecheck, then build the production renderer to `dist/` and electron main/preload to `dist-electron/`.

## Layout

- `electron/` — main process (reads OpenChamber hosts, probes health, proxies API calls, stores
  Ember settings in `~/.config/ember/settings.json`) and the preload bridge. Opt-in remote access
  serves the app on the detected Tailscale IPv4 address at port `57821`; it requires a locally
  hashed password and uses an HttpOnly session cookie.
- `src/App.tsx` — owns all state: instances, per-instance sessions/states/models, selection.
  Sessions are keyed by `sessionKey()` (`instanceId::sessionId`) because ids repeat across instances.
- `src/components/ui/` — shadcn/ui primitives (Tailwind v4, `radix-ui`). Add more with
  `bunx --bun shadcn@latest add <name>`.
- `src/blob/` — session avatars. `Blob.tsx` switches between `GrokBlob` (flat), `GemBlob`
  (faceted) and `GlyphBlob` (hand-drawn icons, no eyes). `blob/seed.ts` resolves three identity
  channels: project/directory + instance picks colour, a scheduled-task binding (or session key)
  picks shape, and the session key picks tilt/motion. OpenChamber task bindings come from each
  project's scheduled-task endpoint and observed `lastSessionId` mappings are retained in Ember
  settings. Session/task/project overrides store only curated colour indexes and shape names.
  Project colours use a persisted 64-entry allocation queue, exhausting every colour before
  cycling; optional per-instance underlines use a separate 12-colour marker palette. `glyphs.ts`
  is generated from `~/Downloads/generate_icons.py` (curated subset; `{c}` = colour, `{id}` =
  per-instance id prefix, `#fff` accents → `var(--background)`). Glyph colours come from
  `--glyph-0..63`, which `applyTheme` sets after `blob/contrast.ts` nudges each palette colour's
  lightness to ≥3:1 against the theme's panel/elev/bg. `CritterBlob` (little
  flat monsters) composes independent slots from `critter.ts` — body × crown × side × tail × feet
  × eyes × mouth × marking × colour pair. Slot priority follows what survives at 30px: silhouette
  (aspect ratio / taper / bumps), then eye count, then top contour, then big accent fields.
  Guard rules in the component keep combos readable: protrusion budget (≤2 of crown/side/tail),
  big mouths only with calm eye pairs, accent budget (must appear once, patterns only on plain
  bodies), no flat-line mouths, never a bare body. Appendages are authored for the right side at
  the origin and mirrored. Colours are `--critter-N` / `-accent` / `-ink` (fill contrast-adjusted
  per theme, accent re-picked from a light/dark candidate, ink falls back to the pale accent on
  dark fills). State is carried by a ring/badge outside `.blob-body` (spinning dashes = active,
  pulsing ring + highlight dot = needs-input, red ring + dot + desaturated body = error) so it
  survives reduced-motion.
- `src/blob/dockIcon.ts` — rasterises the selected session's blob (via `renderToStaticMarkup`,
  with theme CSS vars inlined since an `<img>`-loaded SVG can't see them) onto a `--sidebar`
  squircle and sends the PNG over `window.ember.setDockIcon` → `app.dock.setIcon`. Driven by an
  effect in `App.tsx` keyed on selected session, its state, blob style and theme. The mock bridge
  sets the tab favicon instead. `blob/color.ts` exposes `blobColor(style, seed)` for UI that
  wants the blob's dominant colour (the transcript's activity dot uses it).
- `src/components/Transcript.tsx` — message list: text bubbles, expandable tool rows (input/
  output/diff), collapsed reasoning, file parts, permission + question cards, live activity line,
  pin-to-bottom scrolling (ResizeObserver + `scrollend`), and message jump/highlight support.
- `src/components/SessionContextPanel.tsx` — responsive notes/pins rail. Notes are keyed by session,
  debounced into Ember settings, and can be inserted into the composer; pin actions jump, reply, or
  unpin without changing OpenChamber data.
- `src/components/Markdown.tsx` — assistant prose via `react-markdown` + `remark-gfm` (no raw
  HTML). A small rehype plugin reuses `Linkify.tsx`'s tokenizer to link bare local paths; all
  anchors route through `window.ember.openExternal`.
- `src/themes.ts` — three neutral palettes (Stone, Clay, Graphite) mapped onto shadcn CSS
  variables; `applyTheme` toggles `.dark`. `--primary` is derived from the text colour so
  buttons stay neutral, while each palette's softer `userBubble` neighbour keeps chat calm. The
  bright colour is `--highlight` (Tailwind `highlight`), reserved for indicators: activity dot,
  focus ring, selection ticks, "Needs input", question cards, the wordmark. Permission cards keep
  semantic amber.

## Notes

- Vite config is `vite.config.mts` (ESM) because `package.json` has no `"type": "module"` — the
  electron build needs CommonJS.
- Animations: `motion` for layout/reorder, `tw-animate-css` for Radix enter/exit.
- Archiving is OpenCode-native: `PATCH /api/session/:id` with `{ time: { archived: ms | 0 } }`.
  Sessions load from `/api/experimental/session?archived=true` (plain `/api/session` ignores the
  archived filter) and are split client-side on a truthy `time.archived`, since restored sessions
  carry `archived: 0`.
- "Recent" models in the composer are derived from the instance's own sessions (`session.model`
  from the list endpoint, newest `time.updated` first) — nothing is stored on the Ember side.
- Permissions: `GET /api/permission` lists pending requests for all sessions on an instance;
  reply with `POST /api/permission/:id/reply?directory=…` `{ reply: once|always|reject }`
  (falls back to the legacy `/api/session/:sid/permissions/:id` on 404). Questions (the agent's
  `question` tool) work the same way: `GET /api/question`, `POST /api/question/:id/reply`
  `{ answers: string[][] }` (one array per question; option labels or a single custom string),
  `POST /api/question/:id/reject`. Sessions with a pending request of either kind are forced to
  the `needs-input` ball state — `/api/sessions/status` itself only reports idle/busy/retry.
- Prompt body: `{ parts: [{type:'file', mime, filename, url:<data URL>}..., {type:'text', text}],
  model?, agent? }`. Stop is `POST /api/session/:id/abort`.
