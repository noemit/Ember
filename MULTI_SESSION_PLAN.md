# Multi-session workspace + project rail — implementation plan

Status: **planned, not implemented.** This file is the handoff brief for a fresh session.
Read it end to end, then start at **Phase 1**. Keep the app usable after every phase.

> Repo note: this workspace is edited by more than one agent. Before committing, run
> `git status` and stage **only** the files you changed; never sweep up another session's
> working-tree edits. `bun run check` (typecheck + lint + tests) must pass; use
> `npx --yes bun@1.4.2 ...` if `bun` isn't on PATH.

---

## 1. Goal

Turn Ember from a **single-chat** app into a **multi-session workspace**:

- The left rail becomes a **collection of projects**, not a flat list of sessions.
- Each project is a compact card: name, a `[+]` to start a session in it, and a strip of its
  session **blobs** (mood-carrying, all visible, shrinking as the count grows).
- **Standalone** sessions (root / chats, not in a project) render like today's rows (blob, title,
  description), with **no** `+`.
- Clicking a session **opens it as a column**. Columns show side-by-side while they fit; extras
  collapse into a **numbered top-bar tab strip**. `Cmd/Ctrl+1–9` jumps to the nth open session.
- Minimizing a column is **remembered** across restarts.
- Forked (auto-compacted) sessions stay in the source's project.

The bet: making projects the primary axis encourages archiving, because you clear a project's
blob strip rather than scrolling a growing session list.

---

## 2. Current architecture (as-is)

All renderer state lives in `src/App.tsx` (~1930 lines). Key pieces and current line numbers
(they drift; search by name):

- **Single selection**: `const [selected, setSelected] = React.useState<SessionRef | null>(null)`
  (~194). `SessionRef = { instanceId, sessionId }` (`src/types.ts`). `sessionKey(ref)` →
  `"instance::session"` (`src/types.ts`).
- **Single transcript**: `const [transcript, setTranscript] = useState<{ key: string | null;
  messages: ChatMessage[]; status: MessagesStatus }>` (~196).
  - `selectedKey` (~395); `cachedTranscript = messageCacheRef.current.get(selectedKey)`;
    `transcriptMatchesSelection`; `messages` (~398); `messagesStatus` (~399).
  - Effect seeds the transcript from `messageCacheRef` on selection and calls `refreshMessages`
    (~932-941).
  - Messages poll: `usePoll(() => refreshMessages(selected), live ? 20s : 3s, selected !== null)`
    (~944-950).
- **Per-session caches that already exist**:
  - `messageCacheRef: Map<sessionKey, ChatMessage[]>` + `cacheMessages(key, messages)` (~293).
  - `previews: Record<sessionKey, string>` warmed for sidebar rows.
  - `statesByInstance`, `permissionsByInstance`, `questionsByInstance`, `queuesByInstance` (keyed
    by instance; the per-session item carries the session id).
  - Settings hold per-session data already: `sessionNotes`, `composerDrafts`, `pinnedMessages`.
- **Polling**: `usePoll(task, intervalMs, enabled)` runs immediately then `intervalMs` after each
  completion (`src/hooks/usePoll.ts`). Constants in `App.tsx`: `STATE_POLL_MS = 3000`,
  `SESSION_POLL_MS = 10_000`, `SCHEDULE_POLL_MS = 30_000`; live-stream variants
  `STATE_POLL_LIVE_MS = 30_000`, `SESSION_POLL_LIVE_MS = 60_000`, `MESSAGES_POLL_LIVE_MS = 20_000`,
  `SCHEDULE_POLL_LIVE_MS = 300_000`. Full refresh on stream (re)connect (`refreshAll`, ~861).
- **Event-driven invalidation**: `src/lib/invalidation.ts` maps event types → `Resource`s
  (`sessions | states | permissions | questions | queues | autoAccept | scheduled | messages`),
  coalesced by `InvalidationQueue` (~250ms). Wired in `App.tsx` ~809-852; `isLoaded(instanceId,
  sessionId)` currently checks `selectedSessionRef.current`. `refreshMessages` is the `messages`
  resource refresher.
- **Top bar**: `src/components/InstanceBar.tsx` (instances menu, search/command palette,
  refresh, view options, settings). Rendered above the rail + chat row.
- **Layout shell** (`App.tsx` ~1649):
  `<div className="relative flex min-h-0 flex-1"><LeftRail …/><ChatView …/></div>`.
- **LeftRail**: `src/components/LeftRail.tsx`. Rows are memoized `SessionRow` (blob 55px, title,
  preview, instance/project line, archive button, context menu). It has facet filters/sorters
  (`facetGroups`, `filter`, `sorter`), a recency window, `showArchived` / `showScheduled` toggles,
  search, and a `renderSession` that maps the filtered list flat. There is **no project grouping**.
- **ChatView**: keyed children (notes/queue) use `composerKey`; composer text/model/variant/
  attachments/reply live in ChatView local state, with drafts persisted per session via
  `handleComposerDraftsChange`.
- **App settings** (`EmberSettings`, `src/types.ts`): `theme, blobStyle, sessionWindowHours,
  hideToolCalls, reasoningDisplay, instanceDefaults, pinnedMessages, sessionNotes, composerDrafts,
  scheduledSessionBindings, avatarOverrides, projectColorAssignments, remoteAccessEnabled,
  remotePasswordConfigured`. Persisted through main; the trusted parse lives in
  `electron/transport.ts` (`parseColorAssignments`, `parseStringRecord`, `parseAvatarOverrides`,
  `parseSessionNotes`, `parseComposerDrafts`, …). The renderer keeps its own copy in
  `src/types.ts` because the tsconfig roots differ.

### Handy facts already established about OpenChamber/OpenCode

- Ember's request proxy only allows paths matching `/^\/api(?:[/?]|$)/` (`resolveApiUrl`,
  `electron/transport.ts`). Bare OpenCode paths (`/session/:id/fork`) are **not** reachable.
- `POST /api/session/:id/compact` (directory query) compacts/summarizes in place; `204`.
- `POST /api/openchamber/sessions/:id/fork` body `{ directory, prompt, agent? }` forks the session
  **and dispatches `prompt`** (prompt is required); returns `{ sessionId, … }`; source untouched.
  Handoff (`handleHandoff` in App) forks with `HANDOFF_PROMPT` (`src/api.ts`), waits for idle, then
  compacts the fork so the new session carries just the summary.
- Compaction config knobs live server-side (`auto`, `prune`, `tail_turns`,
  `preserve_recent_tokens`, `reserved`); there's also a non-destructive server `summary`.
- `MessageQueue` is server-owned; enqueue is optimistic in the renderer (`useMessageQueue`,
  `mergePolledQueues`).

---

## 3. Target UX

### 3.1 Rail = project cards + standalone session rows

```
Projects
┌──────────────────────────────────────────┐
│ Habit                            [+]      │
│   ● ● ● ● ●        ← blobs; mood; all     │
│                      visible, shrink to fit│
├──────────────────────────────────────────┤
│ Ember                            [+]      │
│   ● ● ●                                   │
└──────────────────────────────────────────┘

Sessions            (standalone: root / chats; NO +)
  [blob] Title                                12:04
         description · instance
```

- **Project card**: project name, `[+]` (new session prefilled with that project's directory), then
  a single row of session blobs.
- **Blobs**: render the session's existing `BallMood` (they already do). Clicking a blob opens that
  session as a workspace column. Right-click keeps the existing session context menu
  (reload / customize / archive). Hover shows the title.
- **Blob sizing**: full size (~30px) for ≤3–4 blobs; shrink as the count grows so **all are
  visible**. Graceful floor + overflow cue TBD (see §12 Q2).
- **Open/active blobs**: ring/lift for the active column, and show the tab number when open.
- **Standalone sessions**: exactly today's `SessionRow` look and behaviour, no `+`.
- **`+`**: begins a new agent with that project's directory prefilled (reuse `beginNewAgent` /
  `newSessionPrefill`).
- **Forked sessions stay in the source's project** (a fork copies the directory, so
  `projectForSession` already groups it correctly — verify).

### 3.2 Archived sessions (open question — recommended: project drill-in)

The old "Show archived sessions" toggle is removed. Proposed homes:

- **A (recommended) — project drill-in.** Clicking the **project name** expands that card into the
  full current-style session list scoped to the project (rows, search, actions, a per-project
  **Archived (N)** toggle); collapse with the same header. Reuses `SessionRow` and the existing
  archived filter. Standalone archived sessions get a matching treatment for the Sessions group.
- **B — global Archive screen.** A top-bar entry listing archived sessions grouped by project,
  with restore.
- **C — inline `N archived`** link that expands archived rows under the strip.

Card with zero active sessions shows name + `[+]` + `N archived`.

### 3.3 Workspace = columns + overflow tabs

- `openSessions: string[]` (ordered session keys) + `activeSession: string | null`.
- Visible columns = `floor(workspaceWidth / MIN_COLUMN_WIDTH)` (proposed 420), clamped to
  `[1, openSessions.length]`, minus manually minimized; extras become **numbered tabs**.
- **Tab strip**: a slim full-width bar just under the top bar. Each tab: number, blob, title,
  close. Clicking activates; restore a minimized session from its tab.
- **Close** removes from `openSessions` (activate a neighbour). **Minimize** sends it to the tabs
  and is **persisted** (sticky), so it stays minimized even when width returns.
- Empty workspace → today's empty state / new-agent draft. The draft pane occupies the active
  column until the session is created, then resolves into it.
- Mobile / narrow: single pane + tabs (no side-by-side columns).

### 3.4 Hotkeys

- `Cmd/Ctrl+1–9` → activate the nth open session (columns and tabs share the numbering). Tab
  labels show the number.
- Optional (only if requested): `Cmd/Ctrl+W` close active, `Cmd/Ctrl+[` `]` step.

---

## 4. Decisions

**Locked in by the user**
1. One **session** per column.
2. Extras collapse to a **top-bar tab strip**.
3. `Cmd/Ctrl+number` jumps; tabs are **labelled with numbers**.
4. Minimized state is **remembered**.
5. Blobs carry their current **mood**.
6. Pending: **all blobs visible**; shrink as the count grows (≤3 stay full size).
7. Standalone sessions render like today's rows; no `+`.
8. Forked (auto-compacted) sessions stay in the same project.
9. `+` after the project name adds a session to that project.

**Assumed unless overridden** (see §12)
- `MIN_COLUMN_WIDTH = 420`.
- Tab strip spans the full width under the top bar.
- Open-session cap: soft-warn at 6, hard at 8.
- Projects/blobs ordered by most-recent activity.
- The existing facet filter chips/sorters are simplified; search stays.

---

## 5. Data model & persistence

Add to `EmberSettings` (renderer `src/types.ts` **and** trusted parse in
`electron/transport.ts`):

```ts
/** Workspace: ordered open session keys ("instance::session"). */
openSessions: string[];
activeSession: string | null;
/** Manually minimized sessions; sticky across resizes and restarts. */
minimizedSessions: string[];
```

- Bound arrays (e.g. ≤20) and validate entries as non-empty strings (`parseStringRecord`-style;
  a new `parseStringArray`). Values are opaque `"instance::session"` keys.
- **Prune on load and on every session merge**: drop keys whose instance is gone or whose session
  is absent/archived. Keep `activeSession` pointing at an open, non-minimized session (fall back to
  the first open one).
- Where keys are (re)validated: after `refreshSessions` / `mergePolledSessions`, and once settings
  hydrate.

---

## 6. Architecture refactor (do this first, no visual change)

The risky core. Land it alone so it's reviewable.

1. **Workspace state** in `App.tsx`:
   `openSessions: string[]`, `activeSession: string | null`, `minimizedSessions: Set<string>`
   (hydrated from settings, written back on change through `handleSettings`).
2. **`selected` → derived**: `selectedKey = activeSession`; `selected = parseKey(activeSession)`
   so all existing `selected`/`selectedKey` code keeps working. Add `openKeys` + `isOpen(key)`.
3. **Per-key transcripts**: `transcripts: Record<key, { messages, status }>` instead of the single
   `{ key, messages, status }`. Seed each from `messageCacheRef`, update the one that changed.
   `messages`/`messagesStatus` for a column read from `transcripts[key]` (fallback cache).
4. **Refs**: `activeKeyRef`, `openKeysRef`; update the `isLoaded` predicate in the invalidation
   wiring to `(instanceId, sessionId) => openKeysRef.current.has(key)`.
5. **`refreshMessages(ref)`** stays per session; the poll loop becomes "refresh every visible
   column", staggered. A single `usePoll` that iterates visible keys is fine to start; keep the
   interval selection based on the instance's stream liveness.
6. **Open/close/activate helpers**: `openSession(ref)` (append + activate),
   `activateSession(key)`, `closeSession(key)` (remove; activate neighbour),
   `minimizeSession(key)` / `restoreSession(key)`.
7. Keep the active session driving: dock icon, command palette, `PinnedMessagesDialog`, header
   title, avatar picker. Those should read `activeSession`, not the first open one.

**Definition of done for Phase 1:** the app behaves exactly as today (single visible chat) but the
state model supports N open sessions, per-key transcripts, and persisted minimized keys. Tests
pass; no UI change.

---

## 7. Components / files

- `src/App.tsx` — the refactor above; rail + workspace wiring; hotkey listener; settings writes.
- `src/components/LeftRail.tsx` — replace the flat list with project cards + standalone rows;
  project grouping; drill-in; `+`; blob strip; archived access.
  - New `ProjectCard.tsx` (or a subcomponent in LeftRail) for the card + strip.
  - Keep `SessionRow` for standalone rows and the drill-in list.
- New `ColumnTabStrip.tsx` — numbered tabs + minimize/restore/close.
- New `ContextWorkspace` layout — either inline in `App.tsx` or `components/Workspace.tsx`:
  renders visible `ChatView`s side by side, overflow hidden.
- `src/components/ChatView.tsx` — a "minimize" affordance in the header (or the column chrome
  owns it); `ChatView` already keys per-session children.
- `src/blob/Blob.tsx` — reuse; ensure a small size variant renders well (blob strip).
- `src/lib/` — new pure helpers: `workspace.ts` with `parseSessionKey`, `visibleColumns(open,
  minimized, width, minWidth)`, project grouping, and `src/lib/projectGroups.ts` if useful.
- `src/types.ts` + `electron/transport.ts` — settings fields + parsing.
- `AGENTS.md` — update the Layout + Data freshness notes when behaviour changes.

---

## 8. Polling & freshness

- Poll **visible** columns' transcripts (`visibleColumns`), not every open session; minimized tabs
  use the preview cache and the session-list `updated`.
- Keep the live/dead interval split per instance.
- Message events already invalidate `messages` per session; make `isLoaded` return true for any
  **open, visible** key, and fall back to `sessions` invalidation otherwise (existing code already
  does this via the predicate).
- Column open/close should trigger an immediate `refreshMessages` for the newly visible key.

---

## 9. Edge cases

- **Persisted keys go stale** (session archived/deleted, instance removed): prune (§5).
- **Session archived while open**: close its column (or mark it) and prune; archived sessions never
  appear in a project strip.
- **Instance offline/unreachable**: column shows the existing disconnected/blocked state; `ChatView`
  already handles `blocked`.
- **New-agent draft**: no session key yet; add it to `openSessions` as a pseudo-key (e.g.
  `draft::<instanceId>`) or render it as the active pane without adding to the list; on
  `onCreateAndSend`, replace the pseudo-key with the created session key.
- **Rapid open/close**: keep `openSessions` order stable; cap size.
- **Mobile**: rail is a drawer; force single pane + tabs.
- **Search**: filter projects (and their strips) + standalone rows; decide whether a project with
  no matching sessions hides.
- **`+` on a project with no configured path** (directory-only card): prefill the folder string.

---

## 10. Testing

Add pure-function tests (Bun) next to the existing root `*.test.ts`:

- `parseSessionKey` / key formatting round-trips.
- `visibleColumns(open, minimized, width, minWidth)` across widths and minimized sets.
- Project grouping: configured projects + directory-only folders + standalone (root/chat) buckets,
  ordering by recency, forks landing in the source project.
- Settings parsing: `parseStringArray` bounds/validation; workspace pruning drops stale keys.
- Regression: existing `messageQueue.test.ts`, `themes.test.ts`, `api.test.ts`, etc. must stay green.

Run `bun run check` before every commit. Commit + push `main` when a phase's checks pass.

---

## 11. Open questions (resolve before/at the phase noted)

1. **What counts as "a project"?** Configured projects only, or any directory? *Recommend:
   configured projects + directories with ≥2 sessions or a fork; lone stray folders → standalone.*
   Blocks Phase 2 (grouping).
2. **Blob extremes.** With 20+ sessions, shrinking to fit makes dots. Cap the shrink at ~18px then
   `+N`, or truly render all? *Blocks Phase 2 (strip).*
3. **Blob size rule.** e.g. 30px for ≤4, linearly to ~18px, then overflow. Confirm. *Phase 2.*
4. **Project name = drill-in** (hosts the session list + archived), separate from `+`. Confirm.
   *Phase 2.*
5. **Standalone grouping.** One unlabelled "Sessions" section, or labelled? Do standalone rows keep
   titles/previews (yes, per the brief). *Phase 2.*
6. **Multi-instance.** Same folder on two instances: two cards, or one merged by path? *Recommend
   two cards with the instance marker.* *Phase 2.*
7. **Archived home**: A / B / C from §3.2. *Recommend A.*
8. **Ordering**: projects and blobs by most-recent activity. Confirm. *Phase 2.*

Column/tab defaults (assumed; say otherwise): 420px min width, tab strip under the top bar,
close drops / minimize sticks, soft-warn 6 / hard cap 8, `Cmd+1–9` plus optional close/step keys.

---

## 12. Phasing (app usable after each)

1. **State + persistence refactor** (§6): open/active/minimized model, per-key transcripts,
   settings fields + parsing, `visibleColumns` helper, no visual change. Land alone.
2. **Rail = projects**: project cards + blob strips + standalone rows + `+` + drill-in/archived.
3. **Columns + tab strip**: render N `ChatView`s, ResizeObserver fit, minimize/restore/sticky.
4. **Hotkeys + numbering**: `Cmd+number`, tab labels, optional close/step bindings.
5. **Polish**: mobile, draft pseudo-column, max-open cap, search/filter simplification, empty
   states.

Start at Phase 1.
