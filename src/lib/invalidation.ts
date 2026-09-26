import type { EmberEvent } from '../types';

/** A REST resource the renderer can refetch. `messages`/`messageSummary` are per session. */
export type Resource =
  | 'sessions'
  | 'states'
  | 'permissions'
  | 'questions'
  | 'queues'
  | 'autoAccept'
  | 'scheduled'
  | 'messages'
  | 'messageSummary';

/** A visible column wants a bounded tail; terminal events upgrade it to a full repair. */
export type MessageRefreshMode = 'tail' | 'full';

export type Invalidation = {
  instanceId: string;
  resource: Resource;
  sessionId?: string;
  messageMode?: MessageRefreshMode;
};

/** Bridge payloads are untrusted until they look like an event hint. */
export const parseEmberEvent = (raw: unknown): EmberEvent | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.instanceId !== 'string' || typeof value.type !== 'string') return null;
  return {
    instanceId: value.instanceId,
    type: value.type,
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : undefined,
    directory: typeof value.directory === 'string' ? value.directory : undefined,
    connected: typeof value.connected === 'boolean' ? value.connected : undefined,
  };
};

type ResourceHint = { resource: Resource; messageMode?: MessageRefreshMode };

/**
 * Anything on the OpenCode stream that isn't listed here is deliberately ignored. Message hints
 * carry a mode so a visible column can fetch a bounded tail while a terminal event upgrades the
 * pending work to a full repair. Event names are OpenCode 2's (`session.*`, `permission.*`,
 * `form.*` — forms are what the API now calls interactive questions).
 */
const OPENCODE_RESOURCES: Record<string, ResourceHint[]> = {
  'session.created': [{ resource: 'sessions' }],
  'session.updated': [{ resource: 'sessions' }],
  'session.renamed': [{ resource: 'sessions' }],
  'session.metadata.updated': [{ resource: 'sessions' }],
  'session.moved': [{ resource: 'sessions' }],
  'session.forked': [{ resource: 'sessions' }],
  'session.deleted': [{ resource: 'sessions' }],
  'session.model.selected': [{ resource: 'sessions' }],
  'session.agent.selected': [{ resource: 'sessions' }],
  'session.status': [{ resource: 'states' }],
  'session.retry.scheduled': [{ resource: 'states' }],
  'session.execution.started': [{ resource: 'states' }],
  'session.idle': [
    { resource: 'states' },
    { resource: 'sessions' },
    { resource: 'messages', messageMode: 'full' },
  ],
  'session.execution.succeeded': [
    { resource: 'states' },
    { resource: 'sessions' },
    { resource: 'messages', messageMode: 'full' },
  ],
  'session.execution.failed': [
    { resource: 'states' },
    { resource: 'messages', messageMode: 'full' },
  ],
  'session.execution.interrupted': [
    { resource: 'states' },
    { resource: 'messages', messageMode: 'full' },
  ],
  'session.error': [
    { resource: 'states' },
    { resource: 'messages', messageMode: 'full' },
  ],
  'session.compacted': [{ resource: 'messages', messageMode: 'full' }],
  'session.compaction.ended': [{ resource: 'messages', messageMode: 'full' }],
  'session.compaction.failed': [{ resource: 'messages', messageMode: 'full' }],
  'session.inbox.delivered': [{ resource: 'messages', messageMode: 'tail' }],
  'session.synthetic': [{ resource: 'messages', messageMode: 'tail' }],
  'session.usage.updated': [{ resource: 'messages', messageMode: 'tail' }],
  'session.step.streamed': [{ resource: 'messages', messageMode: 'tail' }],
  'session.step.ended': [{ resource: 'messages', messageMode: 'tail' }],
  'session.text.delta': [{ resource: 'messages', messageMode: 'tail' }],
  'session.text.ended': [{ resource: 'messages', messageMode: 'tail' }],
  'session.reasoning.delta': [{ resource: 'messages', messageMode: 'tail' }],
  'session.reasoning.ended': [{ resource: 'messages', messageMode: 'tail' }],
  'session.tool.called': [{ resource: 'messages', messageMode: 'tail' }],
  'session.tool.success': [{ resource: 'messages', messageMode: 'tail' }],
  'session.tool.failed': [{ resource: 'messages', messageMode: 'tail' }],
  'session.tool.progress': [{ resource: 'messages', messageMode: 'tail' }],
  'session.shell.ended': [{ resource: 'messages', messageMode: 'tail' }],
  'session.diff': [],
  'permission.asked': [{ resource: 'permissions' }, { resource: 'states' }],
  'permission.replied': [{ resource: 'permissions' }, { resource: 'states' }],
  'permission.rejected': [{ resource: 'permissions' }, { resource: 'states' }],
  'form.created': [{ resource: 'questions' }, { resource: 'states' }],
  'form.replied': [{ resource: 'questions' }, { resource: 'states' }],
  'form.cancelled': [{ resource: 'questions' }, { resource: 'states' }],
};

const OPENCHAMBER_RESOURCES: Record<string, ResourceHint[]> = {
  'openchamber:session-status': [{ resource: 'states' }],
  'openchamber:session-activity': [],
  'openchamber:session-created': [{ resource: 'sessions' }],
  'openchamber:session-archived': [{ resource: 'sessions' }],
  'openchamber:permission-auto-accept.updated': [{ resource: 'autoAccept' }],
  'openchamber:scheduled-task-ran': [{ resource: 'scheduled' }, { resource: 'sessions' }],
  'openchamber:notification': [],
};

/**
 * Which REST resources an event makes stale. A visible column gets a bounded message tail; the same
 * event for a background session refreshes only its compact summary, never the session list. Session
 * lifecycle events and safety polling remain the authority for list membership and ordering.
 */
export const invalidationsFor = (
  event: EmberEvent,
  isLoaded: (instanceId: string, sessionId: string) => boolean
): Invalidation[] => {
  const hints = OPENCODE_RESOURCES[event.type] ?? OPENCHAMBER_RESOURCES[event.type];
  if (!hints) return [];
  return hints.flatMap((hint): Invalidation[] => {
    if (hint.resource !== 'messages') {
      return [{ instanceId: event.instanceId, resource: hint.resource }];
    }
    if (!event.sessionId) return [];
    if (isLoaded(event.instanceId, event.sessionId)) {
      return [
        {
          instanceId: event.instanceId,
          resource: 'messages',
          sessionId: event.sessionId,
          messageMode: hint.messageMode ?? 'tail',
        },
      ];
    }
    return [{ instanceId: event.instanceId, resource: 'messageSummary', sessionId: event.sessionId }];
  });
};

export const invalidationKey = (invalidation: Invalidation): string =>
  `${invalidation.instanceId}\u0000${invalidation.resource}\u0000${invalidation.sessionId ?? ''}`;

export type InvalidationPolicy = {
  /** Debounce before the first request for a quiet key. */
  leadMs: number;
  /** Minimum spacing between two requests for the same key. */
  minIntervalMs: number;
};

/** Per-resource defaults: a streaming tail is throttled, full repairs are prompt. */
export const defaultPolicyFor = (invalidation: Invalidation): InvalidationPolicy => {
  if (invalidation.resource === 'messages') {
    return invalidation.messageMode === 'full'
      ? { leadMs: 50, minIntervalMs: 0 }
      : { leadMs: 100, minIntervalMs: 750 };
  }
  if (invalidation.resource === 'messageSummary') return { leadMs: 150, minIntervalMs: 1000 };
  if (invalidation.resource === 'sessions') return { leadMs: 250, minIntervalMs: 2000 };
  return { leadMs: 250, minIntervalMs: 0 };
};

const mergeMode = (a?: MessageRefreshMode, b?: MessageRefreshMode): MessageRefreshMode | undefined =>
  a === 'full' || b === 'full' ? 'full' : (a ?? b);

/** Same-key invalidations only differ by message mode; a full repair must never downgrade. */
const mergeInvalidation = (current: Invalidation, incoming: Invalidation): Invalidation => {
  if (current.resource !== 'messages') return current;
  return { ...current, messageMode: mergeMode(current.messageMode, incoming.messageMode) };
};

/**
 * Coalesces bursts by instance/resource/session. A streaming turn emits a part update per token, so
 * the first hint schedules a refetch after the resource's lead time; hints that arrive during that
 * refetch fold into exactly one follow-up, which waits out the resource's minimum interval. A
 * terminal full-repair hint upgrades a pending tail rather than queuing behind it.
 */
export class InvalidationQueue {
  private readonly pending = new Map<
    string,
    { invalidation: Invalidation; timer: ReturnType<typeof setTimeout> }
  >();
  private readonly inFlight = new Map<string, { invalidation: Invalidation; followUp: Invalidation | null }>();
  private readonly lastRunAt = new Map<string, number>();

  constructor(
    private readonly refetch: (invalidation: Invalidation) => Promise<void>,
    private readonly policyFor: (invalidation: Invalidation) => InvalidationPolicy = defaultPolicyFor
  ) {}

  push(invalidation: Invalidation): void {
    const key = invalidationKey(invalidation);
    const flight = this.inFlight.get(key);
    if (flight) {
      flight.followUp = flight.followUp
        ? mergeInvalidation(flight.followUp, invalidation)
        : invalidation;
      return;
    }
    const pending = this.pending.get(key);
    if (pending) {
      const previousMode = pending.invalidation.messageMode;
      pending.invalidation = mergeInvalidation(pending.invalidation, invalidation);
      if (previousMode !== 'full' && pending.invalidation.messageMode === 'full') {
        clearTimeout(pending.timer);
        this.schedule(key, pending.invalidation);
      }
      return;
    }
    this.schedule(key, invalidation);
  }

  private schedule(key: string, invalidation: Invalidation): void {
    const policy = this.policyFor(invalidation);
    const sinceLast = this.lastRunAt.has(key) ? Date.now() - (this.lastRunAt.get(key) ?? 0) : Infinity;
    const wait = Math.max(policy.leadMs, policy.minIntervalMs - sinceLast);
    const timer = setTimeout(() => void this.run(key), wait);
    this.pending.set(key, { invalidation, timer });
  }

  private async run(key: string): Promise<void> {
    const entry = this.pending.get(key);
    if (!entry) return;
    this.pending.delete(key);
    this.lastRunAt.set(key, Date.now());
    if (this.lastRunAt.size > 2000) {
      const cutoff = Date.now() - 60_000;
      this.lastRunAt.forEach((at, oldKey) => { if (at < cutoff) this.lastRunAt.delete(oldKey); });
    }
    this.inFlight.set(key, { invalidation: entry.invalidation, followUp: null });
    try {
      await this.refetch(entry.invalidation);
    } catch {
      // The refetcher reports its own errors; the queue just keeps going.
    } finally {
      const flight = this.inFlight.get(key);
      this.inFlight.delete(key);
      const followUp = flight?.followUp ?? null;
      if (followUp) this.schedule(key, followUp);
    }
  }

  clear(): void {
    this.pending.forEach((entry) => clearTimeout(entry.timer));
    this.pending.clear();
    this.lastRunAt.clear();
    // Dropping in-flight entries makes their completion skip the follow-up.
    this.inFlight.clear();
  }
}
