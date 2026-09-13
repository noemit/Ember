# PERF-1–3 implementation plan

## Goal

Fix the three related transcript performance problems without weakening Ember's freshness or optimistic-send behavior:

1. Token events repeatedly trigger full transcript or session-list requests.
2. Rail previews fetch and cache 24 complete transcripts.
3. A change to one streaming message recreates every `ChatMessage`, so all transcript rows render again.

This plan keeps REST as the source of truth. SSE payloads remain invalidation hints only.

## Success criteria

- A visible `message.part.updated` event fetches a bounded message tail, not the full transcript.
- A background message event never directly fetches the full paginated session list.
- Continuous token events cause at most one tail request per session per 750 ms, plus one bounded follow-up after an in-flight request.
- `session.idle`, reconnect, removal, compaction, polling, selection, and manual reload still repair state with a full fetch.
- Preview warming stores compact metadata only. It never inserts a transcript into `messageCacheRef` or `transcripts`.
- Changing the final message preserves the object identity of every unchanged earlier message.
- Existing optimistic bubbles do not flicker or disappear.
- Multiple instances and columns remain isolated by `sessionKey()`.
- `bun run check` passes.

## Current hot paths

- Event mapping: `src/lib/invalidation.ts`
- Event integration and transcript state: `src/App.tsx:1071-1301`
- Preview warming: `src/App.tsx:1220-1273`
- Full message loading and optimistic reconciliation: `src/api.ts:466-558`
- Message equality: `src/lib/messageSignature.ts`
- Memoized transcript row: `src/components/Transcript.tsx:693-794`
- Browser mock: `src/dev/mockBridge.ts`
- Existing tests: `api.test.ts`, `invalidation.test.ts`

The current OpenCode API declares `limit?: number` for `GET /session/{id}/message` in its [generated SDK types](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts). Add a characterization test that confirms the endpoint returns the latest N messages in chronological order before relying on that merge contract. No bridge or Electron protocol change is needed because Ember's bridge already proxies query strings.

## Non-negotiable invariants

1. Never build UI state from an SSE body. Fetch REST data after a hint.
2. A partial tail cannot prove that older messages were removed. Only a full response may remove an older prefix.
3. A failed request preserves the last good transcript, summary, and preview.
4. Full and tail responses must preserve unmatched optimistic user messages.
5. Every cache, request, pending-send set, and summary is keyed by `instanceId::sessionId`.
6. Full fetches remain authoritative for deletions, compaction, reconnects, explicit reloads, and safety polling.
7. The latest assistant error sets the rail error state only when it was not a user abort.
8. A preview still skips tool-only records and uses the latest textual message or error.
9. Do not introduce permanent debug logging or a second polling loop.

## Target design

### 1. One normalization path, two load modes

Keep `loadMessages` as the full-history API. Add a separate bounded loader so callers cannot accidentally treat a tail as authoritative:

```ts
export const loadMessageTail = async (
  instanceId: string,
  sessionId: string,
  directory?: string,
  limit = MESSAGE_TAIL_LIMIT
): Promise<ChatMessage[]>;
```

Both functions must call one internal normalizer. Build the query with `URLSearchParams` so `directory` and `limit` compose safely.

Recommended constants:

```ts
const MESSAGE_TAIL_LIMIT = 8;
const PREVIEW_LIMITS = [8, 32, 128] as const;
```

Older servers may ignore `limit`. The result remains correct. It only loses the expected transfer saving on that server.

### 2. Structural sharing for fetched messages

Add `src/lib/transcriptReconciliation.ts` with pure functions:

```ts
export type TranscriptReconciliation = {
  messages: ChatMessage[];
  reconciledOptimisticIds: string[];
  needsFullFetch: boolean;
};

export function equalMessage(a: ChatMessage, b: ChatMessage): boolean;

export function shareMessageReferences(
  previous: readonly ChatMessage[],
  next: readonly ChatMessage[]
): ChatMessage[];

export function reconcileFullTranscript(
  current: readonly ChatMessage[],
  fetched: readonly ChatMessage[],
  pendingIds: ReadonlySet<string>
): TranscriptReconciliation;

export function reconcileTranscriptTail(
  current: readonly ChatMessage[],
  fetchedTail: readonly ChatMessage[],
  pendingIds: ReadonlySet<string>
): TranscriptReconciliation;
```

`equalMessage` must compare every renderer-observable field:

- Message ID, role, completion state, timestamps, error, and `aborted`.
- Provider, model, and variant.
- Token counts.
- Ordered part type and ID.
- Text and reasoning content.
- File URL, MIME type, and filename.
- Tool ID, tool name, status, title, error, input, output, and diff.

Reuse the guarded digest approach for large strings and tool input. Expand `src/lib/messageSignature.ts` if keeping it is cleaner. Do not leave `sameMessages` with its current incomplete field coverage.

`shareMessageReferences` must:

1. Index previous messages by ID.
2. Reuse an old object when `equalMessage` says it is unchanged.
3. Return the previous array when length, order, and every object reference are unchanged.
4. Otherwise return a new array containing shared old objects and changed new objects.

`reconcileTranscriptTail` must:

1. Find the earliest fetched ID that overlaps the current transcript.
2. Preserve the current prefix before that message.
3. Replace the suffix with the fetched tail.
4. Preserve unmatched optimistic messages.
5. Match both server-preserved optimistic IDs and legacy server-assigned IDs.
6. Return `needsFullFetch: true` when a non-empty current transcript has no overlap. Do not guess across a gap.
7. Apply structural sharing to the final result.

If a tail refresh reports `needsFullFetch`, perform one deduplicated full repair. Do not append a potentially discontinuous tail.

As a small correctness prerequisite, change pending optimistic IDs from one global set to a per-session map during integration:

```ts
Map<string, Set<string>>
```

Only the target session's fetch may reconcile or release its pending IDs.

### 3. Compact rail metadata

Add `src/lib/messageSummary.ts`:

```ts
export type SessionMessageSummary = {
  preview: string;
  failed: boolean;
  thinking: boolean;
  version?: number;
};

export function summarizeMessages(
  messages: readonly ChatMessage[],
  options: {
    previous?: SessionMessageSummary;
    complete: boolean;
    version?: number;
  }
): SessionMessageSummary;
```

Rules:

- `preview` uses the existing `previewOf` behavior.
- If a partial tail has no textual message or error, retain the previous preview.
- If a complete response has no previewable message, use an empty preview.
- `failed` is true only when the actual final message is an assistant error that is not aborted.
- `thinking` uses `isThinkingMessages`. The existing mood calculation will still gate it on active state.
- A failed summary request leaves the prior summary unchanged.

Replace the parallel `previews`, `previewVersions`, and transcript-cache-derived background mood/error behavior with:

```ts
Record<string, SessionMessageSummary>
```

Temporary derived selectors are fine to keep component props unchanged. For example, derive `previews` and `failedKeys` from summaries while integrating.

Every successful full or tail transcript commit updates the same summary record. Summary state must not depend on whether the full transcript remains cached.

### 4. Bounded preview loading

Replace the preview effect's full `loadMessages` call with progressive tails:

1. Request 8 messages.
2. Stop when `previewOf` finds text or an error.
3. Stop when fewer than the requested limit are returned because the transcript is exhausted.
4. Otherwise retry with 32, then 128.
5. If the last 128 records are tool-only, retain an existing preview or show no preview. Do not fall back to a full transcript.

The preview effect may keep `PREVIEW_COUNT = 24` and `PREVIEW_CONCURRENCY = 4`. It must write summaries only after its cancellation or generation check. It must not call `cacheMessages`.

After this change, lower `MESSAGE_CACHE_LIMIT` from 32 to a workspace-oriented value such as `MAX_OPEN_SESSIONS + 4`. Preview count must no longer determine transcript cache capacity.

Pruning the separate `transcripts` state is PERF-4 and is out of scope for this batch.

### 5. Streaming-aware invalidation

Keep a single logical `messages` resource per session so a terminal full invalidation can upgrade a pending tail invalidation.

Extend `Invalidation`:

```ts
type MessageRefreshMode = 'tail' | 'full';

type Invalidation = {
  instanceId: string;
  resource: Resource;
  sessionId?: string;
  messageMode?: MessageRefreshMode;
};
```

Add a separate `messageSummary` resource for non-visible sessions. The invalidation key for `messages` must ignore `messageMode`, allowing `full` to replace `tail` for the same session.

Use this event matrix:

| Event | Visible column | Background session |
| --- | --- | --- |
| `message.updated` | message tail | message summary |
| `message.part.updated` | message tail | message summary |
| `message.removed` | full messages | message summary |
| `message.part.removed` | full messages | message summary |
| `session.error` | states + full messages | states + message summary |
| `session.idle` | states + sessions + full messages | states + sessions + message summary |
| `session.compacted` | full messages | message summary |
| reconnect | full messages for visible columns | normal session/summary refresh path |

Do not map background token events to `sessions`. Session lifecycle events and safety polling remain responsible for authoritative list membership and ordering. Keep `session.updated` session-list refreshes, but give session-list invalidations a short minimum interval in case an upstream version emits them frequently.

### 6. Queue policy

Upgrade `InvalidationQueue` rather than adding another debounce in `App.tsx`.

Suggested policies:

| Work | Lead | Minimum interval |
| --- | ---: | ---: |
| Full message repair | 0–100 ms | 0 ms |
| Message tail | 100 ms | 750 ms |
| Message summary | 150 ms | 1,000 ms |
| Sessions | 250 ms | 2,000 ms |
| Other resources | 250 ms | 0 ms |

Required scheduler behavior:

- Coalesce by instance, resource, and session.
- Keep at most one follow-up while a request is in flight.
- Respect a resource's minimum interval before running that follow-up.
- Merge duplicate pending invalidations.
- Upgrade `messages/tail` to `messages/full` when a terminal event arrives.
- Never downgrade a pending full refresh back to a tail refresh.
- `clear()` cancels pending timers and prevents queued follow-ups.
- Preserve independent scheduling across sessions and instances.

The existing constructor can accept a policy resolver with defaults so current non-message behavior stays stable.

### 7. Central transcript commit path

The integration owner should route every fetched transcript through one helper in `src/App.tsx`:

```ts
commitFetchedTranscript({
  key,
  fetched,
  mode,
  version,
});
```

That helper must:

1. Read only the target session's current messages and pending IDs.
2. Run full or tail reconciliation.
3. Release only IDs reported as reconciled.
4. Preserve shared message references.
5. Update `messageCacheRef` and `transcripts` with the same array.
6. Update the compact summary.
7. Trigger one full repair if a tail has no safe overlap.

Use this helper for:

- Event refreshes.
- Selected-session refreshes.
- Visible-column polling.
- Accepted-send refreshes.
- Manual reload.
- Abort.
- Compact.

This prevents PERF-3 from being fixed only on the normal polling path.

## Ordered implementation phases

### Phase 0: Characterization tests

Add tests before production changes:

- Preview selection skips trailing tool-only records.
- Final aborted assistant errors do not set failure state.
- Existing optimistic reconciliation preserves unmatched local messages.
- Current invalidation coalescing keeps at most one in-flight follow-up.

Commit this phase separately if possible.

### Phase 1: Structural sharing

1. Add `transcriptReconciliation.ts` and its tests.
2. Expand semantic message equality.
3. Cover full and tail reconciliation, including optimistic sends.
4. Do not change request cadence yet.

This phase delivers PERF-3 with the smallest behavioral change.

### Phase 2: Tail API and summaries

1. Add `loadMessageTail` and shared message normalization.
2. Add compact summary helpers.
3. Teach the mock endpoint to honor `limit` and return the latest N records in chronological order.
4. Add progressive preview loading.
5. Keep event mapping unchanged until these foundations are tested.

### Phase 3: Invalidation policy

1. Add message refresh modes and `messageSummary`.
2. Implement scheduler policies and tail-to-full upgrades.
3. Update event-mapping tests.
4. Keep `App.tsx` untouched in this phase.

### Phase 4: App integration

Only one agent edits `src/App.tsx`.

1. Add the central commit helper.
2. Session-scope pending optimistic IDs.
3. Replace preview warming with summary warming.
4. Replace cache-derived background error/thinking state with summaries.
5. Connect tail, full, and summary invalidations.
6. Lower the full transcript cache limit.
7. Run all checks and perform manual multi-column validation.

### Phase 5: Cleanup and measurement

1. Remove obsolete preview-version and equality paths.
2. Remove dead exports only after all callers migrate.
3. Confirm no preview path calls `cacheMessages`.
4. Record request counts and message object identity during a mock streaming turn.
5. Run `bun run check` and `bun run build`.

## Subagent ownership

Use isolated branches or worktrees. Do not have multiple agents edit `src/App.tsx`.

### Agent A: transcript reconciliation

Owns:

- `src/lib/transcriptReconciliation.ts`
- `transcriptReconciliation.test.ts`
- `src/lib/messageSignature.ts`, if needed

Does not edit `src/App.tsx` or `src/api.ts`.

Deliverables:

- Complete semantic equality.
- Full structural sharing.
- Safe tail merge.
- Explicit reconciled optimistic IDs.
- Object-identity tests.

### Agent B: message API

Owns:

- `src/api.ts`
- Relevant additions in `api.test.ts`

Does not edit `src/App.tsx`.

Deliverables:

- Shared normalizer.
- `loadMessageTail` with `limit` and directory query support.
- Tests for query construction, failure, empty response, and normalization parity.

Avoid changing the existing reconciliation export unless coordinated with the integration owner.

### Agent C: compact summaries

Owns:

- `src/lib/messageSummary.ts`
- `messageSummary.test.ts`

Does not edit `src/App.tsx` or `src/api.ts`.

Deliverables:

- Preview, failed, thinking, and version derivation.
- Correct partial-tail fallback behavior.
- Tool-only and aborted-error tests.

### Agent D: invalidation scheduler

Owns:

- `src/lib/invalidation.ts`
- `invalidation.test.ts`

Does not edit `src/App.tsx`.

Deliverables:

- Event matrix.
- Tail/full upgrade semantics.
- Per-resource lead and minimum-interval policies.
- Deterministic scheduler tests with short test intervals.

### Agent E: mock support

Owns:

- `src/dev/mockBridge.ts`

Does not edit `src/App.tsx`.

Deliverables:

- Honor the message `limit` query.
- Include tail text length or revision in the event watcher fingerprint so it can emit updates without message-count changes.
- Provide a development scenario with trailing tool-only messages and a streaming final message.

### Integration owner

Owns:

- `src/App.tsx`
- Any final import/export cleanup

Starts after Agents A–E merge. Rebase onto the latest `main` first. Resolve API shape differences rather than duplicating helpers.

## Required tests

### Transcript reconciliation

- Identical full fetch returns the exact previous array.
- Updating only the last message returns a new array and preserves all earlier objects with `toBe`.
- Append preserves all existing objects.
- Full removal and reorder follow the authoritative response.
- Tail overlap preserves the prefix and replaces the suffix.
- A tail with no overlap requests a full repair.
- Changes to tokens, abort state, model variant, part ID/type, tool name/status/output, and file metadata replace the affected message.
- Cyclic tool input does not throw.
- Direct optimistic ID reconciliation releases the correct pending ID.
- Legacy server IDs match the new optimistic message, not an older identical message.
- Two sessions reconcile independently.

### Summary behavior

- Uses the latest textual message.
- Skips trailing tool-only messages.
- Retains the previous preview for an incomplete tool-only tail.
- Clears the preview only when a complete transcript has no previewable message.
- Marks a final non-aborted assistant error as failed.
- Clears an earlier failure after a later successful/user message.
- Detects reasoning-only thinking state.

### API behavior

- Full loads send no `limit`.
- Tail loads encode both directory and limit.
- Full and tail paths normalize identical records identically.
- Empty success differs from request failure.
- Progressive preview stops after finding text.
- Progressive preview expands through 8, 32, and 128 only when needed.

### Invalidation behavior

- Visible token updates request a tail.
- Background token updates request a summary and never sessions.
- Removal and idle upgrade a pending visible tail to full.
- Continuous token hints obey the 750 ms minimum interval.
- An in-flight key gets at most one follow-up.
- Sessions and instances remain independently keyed.
- `clear()` prevents delayed work.

## Manual verification

Run `bun run dev:web`, then exercise the mock in one and several columns.

1. Open DevTools Network and start a streaming turn.
2. Confirm event-driven requests include `limit=8`.
3. Confirm full message requests occur on selection and terminal repair, not for every token.
4. Start a background/minimized turn. Confirm it makes bounded summary requests and no token-driven session-list requests.
5. Open a session after its background turn. Confirm cached UI paints immediately when available, followed by a correct full refresh.
6. Send in two columns at once. Confirm neither optimistic bubble flickers.
7. Confirm rail preview, error mood, and thinking mood remain correct.
8. Expand old Markdown and tool rows during streaming. Confirm they do not reset or rerender visibly.

Temporary render counters or request counters may be used locally. Remove them before commit.

## Completion commands

```bash
bun run check
bun run build
```

The build must complete without introducing a larger initial bundle or new eager dependency.

## Rollback boundaries

- Phase 1 is pure reconciliation and can be reverted independently.
- Phase 2 adds API and summary primitives without changing event cadence.
- Phase 3 changes scheduling but not application state ownership.
- Phase 4 is the behavioral cutover. Revert it as one unit if freshness or optimistic sends regress.

Keep commits aligned with these phases so regressions can be bisected.

## Out of scope

- Transcript virtualization.
- Byte-bounding or consolidating `transcripts` and `messageCacheRef` beyond lowering the cache count.
- General `App` state-store refactoring.
- Server or bridge protocol changes.
- Queue revision handling.
- Draft persistence changes.
- Accessibility changes from the broader audit.
