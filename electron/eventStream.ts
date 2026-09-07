/**
 * Server-sent events from an OpenChamber instance, reduced to invalidation hints.
 *
 * Ember treats REST as the source of truth; events only say "something about session X
 * changed, go refetch". So the stream client parses SSE frames, pulls out the event type and
 * the session/directory it concerns, and drops the payload body. Two upstream streams exist:
 * OpenCode's `/api/global/event` (sessions, messages, permissions, questions, status) and
 * OpenChamber's `/api/notifications/stream` (auto-accept policy, scheduled tasks).
 */

export type EmberEvent = {
  instanceId: string;
  stream: 'opencode' | 'openchamber';
  type: string;
  sessionId?: string;
  directory?: string;
};

export type StreamStatus = { instanceId: string; connected: boolean };

export const STREAM_PATHS = {
  opencode: '/api/global/event',
  openchamber: '/api/notifications/stream',
} as const;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
/** Upstream heartbeats every ~15-30s; past this with no bytes the socket is presumed dead. */
const STALL_MS = 90_000;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

/**
 * One `data:` frame → event hint, or null for frames we don't care about (heartbeats,
 * stream-ready markers, malformed JSON).
 */
export const parseEventData = (
  instanceId: string,
  stream: EmberEvent['stream'],
  data: string
): EmberEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  const root = asRecord(parsed);
  // OpenCode wraps in { directory, project, payload }; OpenChamber sends { type, properties }.
  const payload = stream === 'opencode' ? asRecord(root.payload) : root;
  const type = optionalString(payload.type);
  if (!type) return null;
  if (type.startsWith('server.') || type.endsWith('-stream-ready') || type === 'openchamber:heartbeat') return null;

  const properties = asRecord(payload.properties);
  const info = asRecord(properties.info);
  // message.* events nest the session under `info`/`part`; session.* put it on `properties`.
  const part = asRecord(properties.part);
  const sessionId =
    optionalString(properties.sessionID) ??
    optionalString(properties.sessionId) ??
    optionalString(info.sessionID) ??
    optionalString(part.sessionID) ??
    (type.startsWith('session.') ? optionalString(info.id) : undefined);
  const directory = optionalString(root.directory) ?? optionalString(properties.directory) ?? optionalString(info.directory);
  return { instanceId, stream, type, sessionId, directory };
};

/**
 * Incremental SSE frame splitter. Feed it decoded chunks; it yields the `data:` payload of
 * each complete event (multi-line data joined per spec) and keeps partial frames buffered.
 */
export class SseFrameParser {
  private buffer = '';

  push(chunk: string): string[] {
    this.buffer += chunk;
    const frames: string[] = [];
    let boundary = this.buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
      if (data) frames.push(data);
      boundary = this.buffer.indexOf('\n\n');
    }
    return frames;
  }
}

type Target = { url: string; headers: Record<string, string> };

type Handlers = {
  onEvent: (event: EmberEvent) => void;
  onStatus: (status: StreamStatus) => void;
};

/** Reconnecting subscription to one stream of one instance. */
class StreamSubscription {
  private abort: AbortController | null = null;
  private attempt = 0;
  private stopped = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly instanceId: string,
    private readonly stream: EmberEvent['stream'],
    private readonly resolveTarget: () => Target | null,
    private readonly handlers: Handlers,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  start(): void {
    this.stopped = false;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.abort?.abort();
    this.abort = null;
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.attempt) * (0.75 + Math.random() * 0.5);
    this.attempt += 1;
    this.timer = setTimeout(() => void this.connect(), delay);
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const target = this.resolveTarget();
    if (!target) {
      this.scheduleReconnect();
      return;
    }
    const abort = new AbortController();
    this.abort = abort;
    let stallTimer: NodeJS.Timeout | null = null;
    const armStall = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => abort.abort(), STALL_MS);
    };

    try {
      const response = await this.fetchImpl(`${target.url.replace(/\/+$/, '')}${STREAM_PATHS[this.stream]}`, {
        headers: { ...target.headers, accept: 'text/event-stream', 'cache-control': 'no-cache' },
        signal: abort.signal,
      });
      if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);

      this.attempt = 0;
      this.handlers.onStatus({ instanceId: this.instanceId, connected: true });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseFrameParser();
      armStall();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        armStall();
        for (const data of parser.push(decoder.decode(value, { stream: true }))) {
          const event = parseEventData(this.instanceId, this.stream, data);
          if (event) this.handlers.onEvent(event);
        }
      }
    } catch {
      // Network errors and aborts both land here; the reconnect loop handles them.
    } finally {
      if (stallTimer) clearTimeout(stallTimer);
      if (this.abort === abort) this.abort = null;
      this.handlers.onStatus({ instanceId: this.instanceId, connected: false });
      this.scheduleReconnect();
    }
  }
}

/**
 * Keeps both streams open for every attachable instance. `sync` reconciles the set of
 * instances after each probe; targets are re-resolved on every (re)connect so a host that
 * changes URL or token in OpenChamber's settings picks that up without a restart.
 */
export class EventStreamManager {
  private readonly subscriptions = new Map<string, StreamSubscription[]>();
  private readonly connected = new Map<string, Set<EmberEvent['stream']>>();

  constructor(
    private readonly resolveTarget: (instanceId: string) => Target | null,
    private readonly handlers: Handlers,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  sync(instanceIds: string[]): void {
    const wanted = new Set(instanceIds);
    for (const [instanceId, subs] of this.subscriptions) {
      if (wanted.has(instanceId)) continue;
      subs.forEach((sub) => sub.stop());
      this.subscriptions.delete(instanceId);
      this.connected.delete(instanceId);
    }
    for (const instanceId of wanted) {
      if (this.subscriptions.has(instanceId)) continue;
      const handlers: Handlers = {
        onEvent: this.handlers.onEvent,
        onStatus: () => {},
      };
      const subs = (['opencode', 'openchamber'] as const).map((stream) => {
        const sub = new StreamSubscription(
          instanceId,
          stream,
          () => this.resolveTarget(instanceId),
          {
            ...handlers,
            // An instance counts as live when its OpenCode stream is up; that's the one
            // carrying session/message traffic. The OpenChamber stream is best-effort.
            onStatus: ({ connected }) => {
              const set = this.connected.get(instanceId) ?? new Set();
              if (connected) set.add(stream);
              else set.delete(stream);
              this.connected.set(instanceId, set);
              this.handlers.onStatus({ instanceId, connected: set.has('opencode') });
            },
          },
          this.fetchImpl
        );
        sub.start();
        return sub;
      });
      this.subscriptions.set(instanceId, subs);
    }
  }

  isConnected(instanceId: string): boolean {
    return this.connected.get(instanceId)?.has('opencode') ?? false;
  }

  /** Live status of every managed instance, for a renderer that just (re)loaded. */
  snapshot(): Record<string, boolean> {
    return Object.fromEntries([...this.subscriptions.keys()].map((id) => [id, this.isConnected(id)]));
  }

  stopAll(): void {
    this.sync([]);
  }
}
