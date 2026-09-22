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
  message cache (`MESSAGE_CACHE_LIMIT`, the open-session cap plus a small margin) holds full
  transcripts; sidebar previews warm only the compact summary map (`summaries`), never the cache.
  Transcript state is keyed by session so switching renders the cached transcript before the first
  paint while the fresh fetch runs, and it is pruned to the open sessions plus whatever the cache
  still holds, so it can't grow with every session ever shown. Session polls merge per id with the
  newer `updated` winning
  (`mergePolledSessions`), and an optimistic user bubble keeps its id registered until a poll shows
  the server's copy (`releaseReconciledOptimistic`), so neither can flicker out. The workspace is
  `openSessions` (ordered keys) plus `activeSession`; `selected` is derived from `activeSession`, and
  a per-key `transcripts` map backs every open column. A `ResizeObserver` measures the column area
  and `visibleColumns` (in `src/lib/workspace.ts`) decides how many open sessions render side by side
  (`MIN_COLUMN_WIDTH` 420); the active session is swapped into view when it would otherwise overflow.
  `Cmd/Ctrl+1–9` activates that slot in `openSessions` (restoring it if minimized, and leaving the
  new-agent draft).
  The transcript poll and `isLoaded` predicate cover the visible columns. Open/minimized keys are
  persisted in Ember settings and pruned when their instance or session is archived/gone
  (`pruneWorkspace`). The rail lists active sessions only; archived ones are collected into
  `archivedSessions` behind the rail's archive screen, and a project's `+` seeds the new-agent
  draft with `newSessionDirectory`. Ember keeps one project in the workspace at a time: `openProject`
  opens exactly the sessions its card showed (most recent as columns, the rest as tabs, so
  out-of-window/archived sessions in the same folder don't leak in) and `openSession` replaces the
  group when the session belongs to a different project, so two projects' columns never mix by
  default.
- `src/hooks/` — concerns pulled out of App: `useFeedback` (error banner + retry, notice toast,
  live-region announcements), `useEmberSettings` (optimistic writes to main with revision guarding),
  `useMessageQueue` (the server-owned queue handlers, see Notes; every handler takes an explicit
  `QueueTarget` so one hook instance serves all columns), `usePoll` (run-then-wait loop with a
  variable interval).
- `src/lib/` — `useStableCallback` (pin a prop's identity for `React.memo` children),
  `messageSignature` (digest-based change detection for polls), `invalidation` (event → resource
  mapping and the coalescing `InvalidationQueue`), `projectGroups` (`buildRailEntries` grouping +
  `blobStripLayout`), `bulkArchive` (bulk-archive target selection), `workspace`, `clipboard`.
- `electron/eventStream.ts` — SSE client for the two per-instance streams (see Data freshness).
  It parses frames, keeps only `{ instanceId, type, sessionId?, directory? }`, and reconnects with
  jittered backoff; main fans hints out to windows (`ember:event`) and to `/remote/events`.
  Each subscription has a connect-phase deadline (a blackholed connect can't stall the read loop
  forever) and a byte-silence stall detector, plus `restartAll()` for system resume. Recovery is
  layered: a 60s watchdog re-probes every instance so an `unreachable` verdict self-heals (probe
  results broadcast only on change), and `powerMonitor` `resume` bounces all sockets and reprobes
  immediately; the renderer also reprobes on `online` and after a failed session reload.
- `src/components/ChatView.tsx` — the transcript shell and composer. Text, model, reasoning variant,
  attachments, and reply context are kept per session; the one-line textarea grows to a
  capped height and failed sends restore the draft. Draft text and model choices persist
  across restarts (including choice-only drafts), while attachments and reply context stay in memory.
  `ProjectPicker.tsx` and `QueuedMessageList.tsx` are lazy children; the queue list is keyed by
  session so its per-item UI resets on switch. A new agent is a *draft*, not a dialog: with
  `newSessionInstanceId` set and no session selected, the composer is live under key
  `new::<instanceId>` with an instance/project/folder row above it, and the first send calls
  `onCreateAndSend` (create session → send). Folder, model/variant and YOLO are prefilled from
  `src/lib/newSessionDefaults.ts` (folder: saved default → last-used on that instance → last-opened
  project; model/variant: saved default → server default — the last session's model is deliberately
  ignored, so a one-off image model can't hijack every new agent) until the user edits them;
  switching instance re-seeds. The draft's
  centre blob resolves through `resolveDraftIdentity`, so it previews the destination project's
  colour/override and follows the folder picker before the session exists. The header's
  wrench toggle flips the global `hideToolCalls` setting, which drops tool-call rows from every
  transcript, and a cyclical thinking button cycles `reasoningDisplay` (expanded → collapsed →
  hidden) using `ThinkingIcon` — one brain, with a bar for collapsed and a slash for hidden, cut out
  of the glyph with a background-coloured casing (reviewed in `buddy-arena/`, `/thinking`). Pressing
  Up on an empty composer recalls the last message the user sent, Alt/Option+Enter skips the
  busy-session queue and sends now, and Cmd/Ctrl+Enter saves the draft as a note. A context-usage
  ring (`ContextMeter.tsx`) shows the last turn's tokens against the selected model's window and
  compacts the session on click (`POST /api/session/:id/summarize`, which needs the session's
  provider/model). A fork button beside it forks the session, waits for the handoff summary to land,
  then compacts the fork so the new session carries just the summary and the source is left
  untouched (`POST /api/openchamber/sessions/:id/fork` + `/api/session/:id/summarize`). The
  same two display settings are also editable from the top bar's View options dialog
  (`ViewOptionsDialog.tsx`). As a workspace column it shows minimize and archive controls in the
  header (`onMinimize`/`onArchive`; × archives through App's `requestArchive`, which routes busy,
  queued or input-blocked sessions through `ArchiveSessionDialog.tsx` first and always offers
  Undo — it never sends an abort), and calls `onActivate` on pointer-down so the active session
  (and the rail's row highlight) follows the column the user is working in. The active column's
  header is tinted (`data-active`); rail blobs show an underline while their session is a column
  (`visibleColumn`/`visibleKeys`), so two open panels means two underlines. Double-clicking the
  header title renames the session on its instance (`PATCH /api/session/:id` `{ title }`; the
  local copy bumps `updated` so a stale in-flight poll can't revert it).
- `src/components/InstanceBar.tsx` — the top bar (Ember wordmark, command palette, view options,
  instances menu, settings). App passes the error/notice toasts as `banner`, so they render inline
  next to the search button; both self-dismiss (errors after three minutes).
- `src/components/LeftRail.tsx` — the rail is a single recency-ordered list from
  `src/lib/projectGroups.ts` (`buildRailEntries`). A configured project with one active session
  renders as a plain `SessionRow` whose title is the project name (a hover `+` starts a new session
  there); a project with two or more sessions renders as a `ProjectCard`. Projects with no active
  sessions are omitted — start one from New agent. Standalone (root/chat) sessions are always
  `SessionRow`s. Cards and rows interleave by most-recent activity. Clicking a project body opens the
  whole project — see App's `openProject`; the blobs are display-only (their right-click menu still
  reloads/archives that session). The toolbar is New agent + search + the scheduled toggle + the
  archive button. The scheduled view lists the latest run of each scheduled task; those rows also
  carry the task's run/model actions (see SessionRow), so an errored task can be retried after
  switching its model. Search is scoped to the current view by default; when it comes up empty it offers
  "Search all time" and "Search archived sessions", the latter listing archived hits as individual
  rows under an Archived heading (clearing the box resets the scope). Empty configured projects also
  appear in search results when their name or path matches, listed after projects that have sessions.
  The selected session is pinned into the list even when filters hide it.
- `src/components/ProjectCard.tsx` — a multi-session project: name, `+`, and a row of 48px
  mood-carrying blobs that shrink then overflow to `+N`. Every blob carries the session title
  beneath it as a two-line chip (hard-clipped, no ellipsis), so `blobStripLayout`
  counts each item at `LABEL_WIDTH` (56px) even when blobs shrink below it. Clicking the project name/body opens the
  project; clicking a blob opens just that session; right-clicking a blob still offers the per-session
  menu. Right-clicking the `+N` chip opens a tidy-up menu ("Archive N inactive" plus "older than 1
  day / 3 days / 1 week / 2 weeks / 1 month" with counts), driven by `src/lib/bulkArchive.ts`. Bulk
  actions never touch a busy/thinking/needs-input session and share one Undo notice
  (`handleArchiveMany`). Separately, `sweepStaleScheduledRuns` in App auto-archives scheduled-task
  runs that are a day old, finished, and not open — `staleScheduledRuns` in `bulkArchive.ts` picks
  the targets, retry attempts are throttled per session, and the scheduled view still lists them
  via `scheduledSessionBindings`. The `autoArchiveScheduledRuns` setting (default on) gates it. A session with pinned messages shows a small pin badge at its blob's
  bottom-left (`pinnedCounts`, from `src/lib/pins.ts`).
- `src/components/SessionRow.tsx` — the shared full session row (55px blob, title, preview,
  instance/project line, archive button, context menu) used by the rail and the archive screen.
  Optional `titleOverride`/`topMeta`/`onNewAgent` turn it into the one-session project row (project
  name as the title, instance above it); the rail passes a `topMeta` header
  (`project/folder · instance`) so every entry is labelled like a project card. Memoized; the
  timestamp is a self-ticking `RelativeTime`. Archive/restore is decided per row from
  `session.archived`; a row whose session has pins gets a small pin badge on its blob. When the row
  is the latest run of a scheduled task it also gets a hover play
  button and menu entries to run the task now or change its model and run: App resolves the task
  through `scheduledSessionBindings`/`scheduledTasksByKey`, `runScheduledTask` re-runs it server-side
  and `updateScheduledTaskModel` replays the task's own JSON with a patched `execution`.
- `src/components/ArchiveDialog.tsx` — the rail's archive screen (`archivedSessions`): every
  archived session as an individual row, newest first, with restore. Opened from the rail toolbar's
  archive button.
- `src/components/ColumnTabStrip.tsx` — the numbered strip above the columns (right of the rail) of
  the open sessions that aren't currently columns (overflow + minimized). Columns and tabs share one
  numbering (1-based `openSessions` order, so `Cmd/Ctrl+1–9` is stable); a tab click loads it into
  the **rightmost** column, the chevron minimizes/restores (sticky across restarts), and ×
  archives (same `requestArchive` path as the column header). Renders nothing when everything fits. App remembers each project's
  column order, minimized set and active session (`projectLayoutsRef`) so leaving and returning
  restores the arrangement; reopening a project always reopens *all* its sessions, so closing one
  isn't a dead end.
- `src/components/CommandPalette.tsx` — `Cmd/Ctrl+K` session/note search plus new-agent commands.
- `src/components/ui/` — shadcn/ui primitives (Tailwind v4, `radix-ui`). Add more with
  `bunx --bun shadcn@latest add <name>`.
- `src/blob/` — session avatars. `Blob.tsx` switches between `BuddyBlob` (flat, soft shapes) and
  `GlyphBlob` (hand-drawn icons, no eyes); Gem and Critter were removed, and stored settings that
  still name them fall back to the default. Renderers memoize on the `identity` object, so App
  hands back the previous reference when nothing changed. Buddy pupils track the cursor only while
  it's within `NEAR_RADIUS` (`usePupilTracking.ts`), and active Buddy blobs do squash-and-stretch
  hops with a per-blob occasional somersault (`blob-hop`/`blob-flip` in `blob.css`); the eyes
  counter-scale 75% of the hop so they mostly keep their shape (`blob-hop-eyes`). Visuals key off
  a `BallMood` (`blob/mood.ts`): `busy` = hop+flip, `thinking` = breathe + a soft arc, `input` =
  wobble + padlock badge, `question` = tilt + "?" badge, `error` = wobble + warning triangle,
  `unread` = a highlight dot. App derives the mood from the ball state plus the prompt kind
  (permission vs question), whether the last assistant turn is reasoning (`isThinkingMessages`), and
  whether an idle session has a response the user hasn't opened (per-session `lastReadAt`; the active
  column is marked read). `buddy.ts` holds
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
  activity line (suppressed until initial history resolves), per-message footer (model, duration,
  cache read/write, output tok/s, provider cost when the API reports one, and a self-ticking
  "x min ago" received time), pin-to-bottom scrolling (ResizeObserver +
  `scrollend`), and message jump/highlight support. Expanding a thinking block stops auto-follow and
  nudges the block into view with `block: 'nearest'`, so it doesn't yank the reader to the bottom.
  The session blob lives here rather than in the
  chat header: while a turn is pending it rides the activity line below the last message, and once
  the turn is done it tucks in beside the last assistant message.
- `src/components/SessionNotes.tsx` — notes parked from the composer, listed above it like the
  queue but never dispatched on their own. The composer's save-as-note button (next to send) stores
  the text in Ember settings under a notes key: a session inside a configured project shares the
  project's notes (so they appear in, and can be sent to, every session in the project), while a
  standalone session keeps its own (`notesKeyForSession` in `src/lib/projectGroups.ts`; ChatView takes
  an explicit `notesKey`). Each row can send as-is, bring the text back into the
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
- Errors name their layer: the transport's own 20s deadline reads "… (Ember → OpenChamber)", other
  request failures are prefixed with the instance label, and OpenChamber/OpenCode/provider messages
  pass through with their text (`proxyApiRequest` in `electron/main.ts`;
  `responseError` in `App.tsx`).
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
  from the list endpoint, newest `time.updated` first) — nothing is stored on the Ember side. The
  catalogue itself comes from `loadModels`: it tries `/api/provider` then `/api/config/providers`
  and parses provider/model collections whether they arrive as arrays or as id→entry maps (a
  stricter parser silently yields an empty picker when a version uses the other shape).
- Permissions: `GET /api/permission` lists pending requests; Ember merges the global response with
  directory-scoped responses because OpenCode scopes pending requests by project. The directory hints
  cover the selected session, every open column/tab, and any directory named by a prompt event
  (`directoryHintsFor`), plus every directory that already holds a pending prompt, so a background
  column's question still resolves and browsing away doesn't drop its request. Reply with `POST /api/permission/:id/reply?directory=…` `{ reply: once|always|reject }`
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

## Workspace reliability and performance

- `bun run test:e2e` runs Playwright against `dev:web`. Install its pinned Chromium with
  `bunx --no-install playwright install chromium`. Tests use `.pw.ts` so Bun's unit runner does not
  collect them. `?fixture=performance&noDock` supplies 85 sessions and a 10,000-message transcript;
  `&slowInstance` holds the second mock instance until `releaseSlowInstance()` is called.
- `bun run test:native` builds production assets and runs the `.native.ts` Playwright suite against
  the real Electron main/preload and authenticated remote router. It isolates HOME, Chromium profile,
  and OpenChamber settings in a temporary directory and uses a loopback upstream fixture; it never
  operates on real sessions. Requires a GUI-capable environment (validated on macOS). Remote tests
  bind the router factory to loopback; production `startRemoteServer` remains Tailscale-only. This
  covers IPC, disk persistence, production CSP/assets, remote cookies and shared drafts/ratings,
  but not real Tailnet connectivity or a packaged/notarized distribution.
- Composer persistence uses per-key `composerDraftChanges` (null deletes), not replacement snapshots.
  `composerMemory` retains transient attachments/reply context across column unmounts. Settings writes
  are serialized in both renderer and main; failed draft patches remain optimistic and retryable.
  Sending or saving a note clears content but retains a choice-only draft with the selected model and
  reasoning level. New-agent creation transfers that choice to the created session. Restore choices
  before paint, independently of session-list metadata. `modelSelection.ts` resolves concrete IDs by
  exact match: absent models/effort levels block composer sends, queues and note sends without changing
  the selection. Only the `default` sentinel delegates model choice to the server. `selectedModelId`
  travels through client send/queue handlers as a fallback guard, never in the upstream request body.
  Picker opening and the unavailable-model warning can refresh the catalogue; refreshes do not choose
  a replacement. Queued-message model edits forward reasoning explicitly, including an explicit
  default/cleared effort; they must not inherit the old queue item's effort by accident.
  `e2e/modelSelection.pw.ts` verifies outgoing model IDs, effort levels and persistence.
- Instance probes publish `ember:instances-updated` hints. `listInstances(false)` reads the current
  snapshot without probing; each healthy instance can load while another is still checking.
- `ReadCoordinator` serializes full/tail transcript reads. Post-mutation and authoritative event
  repairs request a read after any already-running request. Routine polls fetch tails; full repairs
  remain for terminal events, reconnects, missing overlap and 60s busy/polling or 5min idle-live safety
  checks. Routine session-list reads use one page between 5min deeper reads. Partial lists merge rather
  than deleting absent sessions. The palette can explicitly request deeper indexing.
- `StableChatView` stabilizes callbacks/data for its memoized child. `Transcript` is memoized separately,
  virtualizes histories over 80 visible records with TanStack Virtual, and retains expansion state
  outside virtual rows. Cmd/Ctrl+F within a column opens inline data-backed conversation search.
  A keyboard/screen-reader-accessible control offers full non-virtualized history; virtual row mounts
  are not live announcements, so scrolling does not repeatedly announce old messages.
- `TranscriptCache` accounts estimated bytes (64 MiB target plus the existing count cap). Visible
  columns and pending sends are protected; minimized/closed histories can be evicted. Protected
  working sets may exceed the target: it is not a hard process-memory limit.
- `capabilities.dockIcon` gates the dock renderer before import. Remote assets negotiate gzip/Brotli,
  with an 8 MiB compressed-asset cache; API responses remain uncached and SSE remains uncompressed.
  Remote sessions own their SSE subscriptions: logout revokes existing streams, expiry is checked on
  events and heartbeats, and disabling/restarting remote access closes existing HTTP connections.
- Personal model experience lives in the existing model picker and stores metadata/ratings on the
  Ember host in `model-stats.json`, separate from settings. It retains up to 10,000 observations for
  90 days, keyed by instance/session/message. Metrics describe observed model calls, not whole tasks
  or inference-only timing. Helpful/not-helpful ratings apply to completed replies. No transcript
  text or tool payloads are retained. Clear/reset also records a cutoff so old polls cannot recreate
  cleared observations. Desktop IPC, the authenticated remote bridge and the mock implement it.
- At this baseline `bun.lock` is tracked, despite the older note above; dependency changes include its
  generated updates along with `package.json`.
