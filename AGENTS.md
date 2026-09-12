# Ember

Tiny Electron client for OpenChamber. One window shows the most recent sessions across every
connected instance listed in `~/.config/openchamber/settings.json`.

## Commands

- `bun run dev` — build renderer + electron, then launch Electron.
- `bun run dev:web` — renderer only under Vite with a mock bridge (`src/dev/mockBridge.ts`) so the UI
  can be exercised in a plain browser. The mock loads automatically when `window.ember` is absent.
- `bun run typecheck` — both tsconfigs (renderer + electron).
- `bun run lint` — eslint (typescript-eslint + `react-hooks/rules-of-hooks` and `exhaustive-deps`).
  Every `eslint-disable` must carry a `-- reason`. The React Compiler rules are intentionally off.
- `bun run test` — Bun regression tests for API pagination/failures, transport security, and theme contrast.
- `bun run check` — typecheck + lint + test; run this before committing.
- `bun run build` — typecheck the renderer, build it to `dist/`, and emit electron main/preload to `dist-electron/`.
- `bun.lock` is intentionally untracked (`packageManager` pins the Bun version instead).

## Completion

- When a requested task is complete and its checks pass, commit the intended files and push `main`.
  If checks cannot run or need a live/manual pass, say so before pushing.

## Layout

- `electron/` — main process (reads OpenChamber hosts, probes health, proxies API calls, stores
  Ember settings in `~/.config/ember/settings.json`) and the preload bridge. OpenChamber's
  `settings.json` is consulted on every proxied request, so it's cached by mtime
  (`readOpenchamberSettings`). The settings contract (`EmberSettings`, `BlobStyle`,
  `InstanceDefaults`) lives once in `electron/transport.ts` and is imported by main and preload;
  the renderer keeps its own copy in `src/types.ts` because the two tsconfigs have separate roots
  and main parses persisted JSON into its trusted shapes at the boundary. Opt-in remote access
  serves the app on the detected Tailscale IPv4 address at port `57821`; it requires a locally
  hashed password and uses an HttpOnly session cookie.
- `src/App.tsx` — owns the data state: instances, per-instance sessions/states/models/queues,
  selection, pollers, and the send/reload/archive/permission handlers. Sessions are keyed by
  `sessionKey()` (`instanceId::sessionId`) because ids repeat across instances. A bounded in-memory
  message cache (`MESSAGE_CACHE_LIMIT`, ≥ `PREVIEW_COUNT`) is warmed by sidebar preview loads;
  transcript state is keyed by session so switching renders the cached transcript before the first
  paint while the fresh fetch runs. Session polls merge per id with the newer `updated` winning
  (`mergePolledSessions`), and an optimistic user bubble keeps its id registered until a poll shows
  the server's copy (`releaseReconciledOptimistic`), so neither can flicker out.
- `src/hooks/` — concerns pulled out of App: `useFeedback` (error banner + retry, notice toast,
  live-region announcements), `useEmberSettings` (optimistic writes to main with revision guarding),
  `useMessageQueue` (the server-owned queue handlers, see Notes), `usePoll` (run-then-wait loop
  with a variable interval).
- `src/lib/` — `useStableCallback` (pin a prop's identity for `React.memo` children),
  `messageSignature` (digest-based change detection for polls), `invalidation` (event → resource
  mapping and the coalescing `InvalidationQueue`), `clipboard`.
- `electron/eventStream.ts` — SSE client for the two per-instance streams (see Data freshness).
  It parses frames, keeps only `{ instanceId, type, sessionId?, directory? }`, and reconnects with
  jittered backoff; main fans hints out to windows (`ember:event`) and to `/remote/events`.
- `src/components/ChatView.tsx` — the transcript shell and composer. Text, model, reasoning variant,
  attachments, and reply context are kept per session; the one-line textarea grows to a
  capped height and failed sends restore the draft. Draft text and model choices persist
  across restarts (including choice-only drafts), while attachments and reply context stay in memory.
  `ProjectPicker.tsx` and `QueuedMessageList.tsx` are lazy children; the queue list is keyed by
  session so its per-item UI resets on switch. A new agent is a *draft*, not a dialog: with
  `newSessionInstanceId` set and no session selected, the composer is live under key
  `new::<instanceId>` with an instance/project/folder row above it, and the first send calls
  `onCreateAndSend` (create session → send). Folder, model/variant and YOLO are prefilled from
  `src/lib/newSessionDefaults.ts` (saved default → last-used on that instance → last-opened
  project / server default) until the user edits them; switching instance re-seeds. The header's
  wrench toggle flips the global `hideToolCalls` setting, which drops tool-call rows from every
  transcript, and a cyclical thinking button cycles `reasoningDisplay` (expanded → collapsed →
  hidden) using `ThinkingIcon` — one brain, with a bar for collapsed and a slash for hidden, cut out
  of the glyph with a background-coloured casing (reviewed in `buddy-arena/`, `/thinking`). Pressing
  Up on an empty composer recalls the last message the user sent, Alt/Option+Enter skips the
  busy-session queue and sends now, and Cmd/Ctrl+Enter saves the draft as a note. A context-usage
  ring (`ContextMeter.tsx`) shows the last turn's tokens against the selected model's window and
  compacts the session on click (`POST /api/session/:id/compact`, the instance's summarize). A fork
  button beside it starts a new session seeded with a handoff summary and leaves the current one
  untouched (`POST /api/openchamber/sessions/:id/fork`). The
  same two display settings are also editable from the top bar's View options dialog
  (`ViewOptionsDialog.tsx`).
- `src/components/LeftRail.tsx` — session list. Rows are a memoized `SessionRow`; the timestamp is
  a self-ticking `RelativeTime`. Archive/restore is decided per row from `session.archived`, not the
  view toggle, because the selected session is pinned into the list even when filters hide it.
- `src/components/CommandPalette.tsx` — `Cmd/Ctrl+K` session/note search plus new-agent commands.
- `src/components/ui/` — shadcn/ui primitives (Tailwind v4, `radix-ui`). Add more with
  `bunx --bun shadcn@latest add <name>`.
- `src/blob/` — session avatars. `Blob.tsx` switches between `GrokBlob` ("Buddy", flat) and
  `GlyphBlob` (hand-drawn icons, no eyes); Gem and Critter were removed, and stored settings that
  still name them fall back to the default. Renderers memoize on the `identity` object, so App
  hands back the previous reference when nothing changed. Grok pupils track the cursor only while
  it's within `NEAR_RADIUS` (`usePupilTracking.ts`), and active Grok blobs do squash-and-stretch
  hops with a per-blob occasional somersault (`blob-hop`/`blob-flip` in `blob.css`); the eyes
  counter-scale 75% of the hop so they mostly keep their shape (`blob-hop-eyes`). Visuals key off
  a `BallMood` (`blob/mood.ts`): `busy` = hop+flip, `thinking` = breathe + a soft arc, `input` =
  wobble + padlock badge, `question` = tilt + "?" badge, `error` = wobble + warning triangle. App
  derives the mood from the ball state plus the prompt kind (permission vs question) and whether the
  last assistant turn is reasoning (`isThinkingMessages`). `grok.ts` holds
  the 16 hand-drawn silhouettes (the original 8 plus teddy, sprout, puff, cat, ghost, cloud, egg and
  mushroom) plus 11 generated ones (radial harmonics + top/bottom squash, reviewed
  in `buddy-arena/`; `bun run buddy-arena`). `blob/seed.ts`
  resolves three identity channels: project/directory + instance picks colour, a scheduled-task
  binding (or session key) picks shape, and the session key picks tilt/motion. OpenChamber task
  bindings come from each project's scheduled-task endpoint and observed `lastSessionId` mappings
  are retained in Ember settings. The appearance picker scopes overrides per session/task/project
  and stores only curated colour indexes and shape names; the project/folder scope comes first and
  is its default, so customising from a session row shares the look across that project.
  Project/directory colours use a persisted 22-entry allocation queue (directory-only "projects"
  included, so distinct directories never collide on a hash), exhausting every colour before cycling;
  the queue is pruned to the sessions currently on screen (plus the selected one), so it doesn't grow
  forever. Optional per-instance underlines use a separate 12-colour marker palette.
  `glyphs.ts` is generated from `~/Downloads/generate_icons.py` (curated subset; `{c}` = colour,
  `{id}` = per-instance id prefix, `#fff` accents → `var(--background)`). Glyph colours are chosen in
  OKLCH by farthest-point sampling so the 22 base entries keep a minimum OKLab distance (no HSL
  near-duplicate greens/blues). Two extra are sampled and the closest violet/magenta pair dropped, so
  the picker doesn't read as four purples and four pinks; then sorted by hue so it reads as a
  rainbow. `applyTheme` emits `--glyph-0..21` after `blob/contrast.ts` adjusts the
  whole palette together — clamping each colour to ≥3:1 against the theme's panel/elev/bg while pushing
  close pairs apart, rather than per-colour clamping that collapses them onto one lightness.
- `src/blob/dockIcon.ts` — rasterises the selected session's blob (via `renderToStaticMarkup`,
  with theme CSS vars inlined since an `<img>`-loaded SVG can't see them) onto a `--sidebar`
  squircle and sends the PNG over `window.ember.setDockIcon` → `app.dock.setIcon`. Driven by an
  effect in `App.tsx` keyed on selected session, its state, blob style and theme. The mock bridge
  sets the tab favicon instead. `blob/color.ts` exposes `blobColor(style, seed)` for UI that
  wants the blob's dominant colour (the transcript's activity dot uses it).
- `src/components/Transcript.tsx` — message list: text bubbles, expandable tool rows (input/
  output/diff), collapsed reasoning, file parts, permission + question cards, model-named live
  activity line (suppressed until initial history resolves), pin-to-bottom scrolling (ResizeObserver +
  `scrollend`), and message jump/highlight support. The session blob lives here rather than in the
  chat header: while a turn is pending it rides the activity line below the last message, and once
  the turn is done it tucks in beside the last assistant message.
- `src/components/SessionNotes.tsx` — notes parked from the composer, listed above it like the
  queue but never dispatched on their own. The composer's save-as-note button (next to send) stores
  the text in Ember settings keyed by session; each row can send as-is, bring the text back into the
  composer (which consumes the note), or delete it. Both cards keep a static icon and count in their
  left rail and reveal a minimize badge at the upper-right on hover. When minimized, their clickable
  icon and count move beside the composer's attachment button to restore the card. Rows carry no
  status dot — only a spinner while one is busy — and the open state is held in `ChatView` so it
  survives session switches. A queued message
  can also be "parked": removed from the server queue and saved as a note.
  `PinnedMessagesDialog.tsx` shows the selected session's pinned messages in a modal, opened from
  the pin chip in the chat header; its Jump/Reply/Unpin actions reuse the transcript handlers and
  change no OpenChamber data.
- `src/components/Markdown.tsx` — assistant prose via `react-markdown` + `remark-gfm` (no raw
  HTML). A small rehype plugin reuses `Linkify.tsx`'s tokenizer to link bare local paths; all
  anchors route through `window.ember.openExternal`.
- `src/themes.ts` — three neutral palettes (Stone, Clay, Graphite) mapped onto shadcn CSS
  variables; `applyTheme` toggles `.dark`. `--primary` is derived from the text colour so
  buttons stay neutral, while each palette's softer `userBubble` neighbour keeps chat calm. The
  bright colour is `--highlight` (Tailwind `highlight`), reserved for indicators: activity dot,
  focus ring, selection ticks, "Needs input", question cards, the wordmark. Permission cards keep
  semantic amber.

## Data freshness

Events drive invalidation; REST stays the source of truth. Nothing in the UI is ever built
from an event payload.

- Main subscribes each attachable instance to OpenCode's `/api/global/event` (sessions,
  messages, status, permissions, questions; frames are `{ directory, payload: { type,
  properties } }`) and OpenChamber's `/api/notifications/stream` (`openchamber:*` — auto-accept
  policy, scheduled tasks; frames are `{ type, properties }`). Payload bodies are dropped in main.
- The renderer maps a hint to REST resources in `lib/invalidation.ts` (`session.status` →
  states; `message.*` → the open transcript if it's that session, else the session list;
  `permission.*`/`question.*` → their list plus states; and so on) and pushes them through an
  `InvalidationQueue` that coalesces bursts to one refetch per resource per ~250ms — a streaming
  turn emits a `message.part.updated` per token. One "refresher" per resource in `App.tsx`
  (`refreshSessions`, `refreshStates`, `refreshMessages`, …) does the fetch and merges into state;
  timers call the same functions.
- Polling is the safety net, per instance: while an instance's OpenCode stream is live it polls
  slowly (states 30s, sessions 60s, open transcript 20s, scheduled tasks 5min); without a stream
  it polls fast (3s / 10s / 3s / 30s). A stream (re)connecting triggers a catch-up refetch of
  everything for that instance, since hints were missed while it was down. The instance menu shows
  `live` vs `polling`.
- Bridges without `onEvent` (an older remote server) simply stay on the fast cadence. The mock
  emits synthetic hints for `local` only, so both paths get exercised in `dev:web`.

## Notes

- Vite config is `vite.config.mts` (ESM) because `package.json` has no `"type": "module"` — the
  electron build needs CommonJS.
- Animations: `motion` for layout/reorder, `tw-animate-css` for Radix enter/exit.
- Archiving is OpenCode-native: `PATCH /api/session/:id` with `{ time: { archived: ms | 0 } }`.
  Sessions load from `/api/experimental/session?archived=true` (plain `/api/session` ignores the
  archived filter) and are split client-side on a truthy `time.archived`, since restored sessions
  carry `archived: 0`. Archiving offers undo through the local notice toast.
- Busy-session queueing uses OpenChamber's server-owned queue: `GET /api/message-queue`, enqueue with
  `POST /api/message-queue/sessions/:id/items` `{ directory, item }`, remove with
  `DELETE /api/message-queue/sessions/:id/items/:itemId`, reorder with
  `PUT /api/message-queue/sessions/:id/order` `{ itemIds }`, and take the full payload for immediate
  steering with `POST /api/message-queue/sessions/:id/items/:itemId/take`. Queue items require a
  concrete `sendConfig` (`providerID`, `modelID`, optional `agent`/`variant`); Ember resolves the
  instance default before queueing. Each row shows its assigned model/variant and can change it by
  taking the full item, re-enqueueing with the new `sendConfig`, then restoring its order. The
  server dispatches items once the session is idle, while Ember's per-item send-now action takes
  the item and sends it directly so it can steer the active turn. Enqueueing is optimistic: the row
  appears at once with a loader (`pending`), a failed enqueue keeps it with the error plus
  Retry/Cancel, and `mergePolledQueues` folds those local rows back into each polled snapshot.
- "Recent" models in the composer are derived from the instance's own sessions (`session.model`
  from the list endpoint, newest `time.updated` first) — nothing is stored on the Ember side.
- Permissions: `GET /api/permission` lists pending requests; Ember merges the global response with
  directory-scoped responses for the selected session because OpenCode scopes pending requests by
  project. It also keeps fetching every directory that already holds a pending prompt, so browsing
  away from a session doesn't drop its request. Reply with `POST /api/permission/:id/reply?directory=…` `{ reply: once|always|reject }`
  (falls back to the legacy `/api/session/:sid/permissions/:id` on 404). Questions (the agent's
  `question` tool) work the same way: `GET /api/question`, `POST /api/question/:id/reply`
  `{ answers: string[][] }` (one array per question; option labels or a single custom string),
  `POST /api/question/:id/reject`. Sessions with a pending request of either kind are forced to
  the `needs-input` ball state — `/api/sessions/status` itself only reports idle/busy/retry.
- Ball states: `/api/sessions/status` never says "error", so `error` is derived from the
  transcript: an idle session whose last message is an assistant turn with `error` set (and not
  `aborted`, i.e. a user stop) is failed. That's tracked in `failedKeys`, updated wherever
  messages enter the cache, so it covers the open session and the previewed ones. Priority is
  needs-input > active > error > idle. `needs-input` draws an orbiting ring (`blob/OrbitRing.tsx`,
  offset-path + opacity only; the marker passes behind the body via a back/front split).
- YOLO mode (`bypass` in the settings schema, kept for compatibility) is OpenChamber's server-side
  permission auto-accept: `GET /api/permission-auto-accept` → `{ sessions: { id: bool } }`,
  `PUT /api/permission-auto-accept/sessions/:id` `{ enabled, directory }`. The server answers
  prompts itself, so it works while Ember is closed and matches what OpenChamber shows as
  "Permission auto-accept". The policy is polled with the 10s session poll. Instances that 404 the
  route are marked unsupported and fall back to a local override plus Ember auto-replying `once`
  while the session is selected; with server support that client loop is skipped to avoid racing.
- Prompt body: `{ parts: [{type:'file', mime, filename, url:<data URL>}..., {type:'text', text}],
  model?, agent?, variant? }`. Stop is `POST /api/session/:id/abort`.
