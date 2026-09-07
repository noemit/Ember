import type { EmberEvent } from '../types';

/** A REST resource the renderer can refetch. `messages` is per session; the rest are per instance. */
export type Resource = 'sessions' | 'states' | 'permissions' | 'questions' | 'queues' | 'autoAccept' | 'scheduled' | 'messages';

export type Invalidation = { instanceId: string; resource: Resource; sessionId?: string };

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

/** Anything on the OpenCode stream that isn't listed here is deliberately ignored. */
const OPENCODE_RESOURCES: Record<string, Resource[]> = {
  'session.created': ['sessions'],
  'session.updated': ['sessions'],
  'session.deleted': ['sessions'],
  'session.status': ['states'],
  'session.idle': ['states', 'sessions'],
  'session.error': ['states', 'messages'],
  'session.diff': [],
  'message.updated': ['messages'],
  'message.part.updated': ['messages'],
  'message.part.removed': ['messages'],
  'message.removed': ['messages'],
  'permission.updated': ['permissions', 'states'],
  'permission.replied': ['permissions', 'states'],
  'question.asked': ['questions', 'states'],
  'question.replied': ['questions', 'states'],
  'question.rejected': ['questions', 'states'],
};

const OPENCHAMBER_RESOURCES: Record<string, Resource[]> = {
  'openchamber:session-status': ['states'],
  'openchamber:session-activity': [],
  'openchamber:session-created': ['sessions'],
  'openchamber:permission-auto-accept.updated': ['autoAccept'],
  'openchamber:scheduled-task-ran': ['scheduled', 'sessions'],
  'openchamber:notification': [],
};

/**
 * Which REST resources an event makes stale. Message events are only worth acting on for a
 * session whose transcript is currently loaded (`isLoaded`); for the rest the session list's
 * `updated` timestamp, refreshed by its own event, is what drives the preview loader.
 */
export const invalidationsFor = (
  event: EmberEvent,
  isLoaded: (instanceId: string, sessionId: string) => boolean
): Invalidation[] => {
  const resources = OPENCODE_RESOURCES[event.type] ?? OPENCHAMBER_RESOURCES[event.type];
  if (!resources) return [];
  return resources.flatMap((resource): Invalidation[] => {
    if (resource !== 'messages') return [{ instanceId: event.instanceId, resource }];
    if (!event.sessionId) return [];
    // A message landing in a session we aren't showing still moves it in the rail.
    return isLoaded(event.instanceId, event.sessionId)
      ? [{ instanceId: event.instanceId, resource, sessionId: event.sessionId }]
      : [{ instanceId: event.instanceId, resource: 'sessions' }];
  });
};

export const invalidationKey = (invalidation: Invalidation): string =>
  `${invalidation.instanceId}\u0000${invalidation.resource}\u0000${invalidation.sessionId ?? ''}`;

/**
 * Coalesces bursts: a streaming turn emits a part update per token, and one refetch per
 * ~250ms is plenty. First hint in a quiet period fires after `leadMs`; further hints within
 * the window fold into that one refetch, and a hint that arrives while a refetch is in flight
 * schedules exactly one follow-up so nothing is missed.
 */
export class InvalidationQueue {
  private readonly pending = new Map<string, { invalidation: Invalidation; timer: ReturnType<typeof setTimeout> }>();
  private readonly inFlight = new Map<string, boolean>();

  constructor(
    private readonly refetch: (invalidation: Invalidation) => Promise<void>,
    private readonly leadMs = 250
  ) {}

  push(invalidation: Invalidation): void {
    const key = invalidationKey(invalidation);
    if (this.inFlight.has(key)) {
      this.inFlight.set(key, true);
      return;
    }
    if (this.pending.has(key)) return;
    const timer = setTimeout(() => void this.run(key), this.leadMs);
    this.pending.set(key, { invalidation, timer });
  }

  private async run(key: string): Promise<void> {
    const entry = this.pending.get(key);
    if (!entry) return;
    this.pending.delete(key);
    this.inFlight.set(key, false);
    try {
      await this.refetch(entry.invalidation);
    } catch {
      // The refetcher reports its own errors; the queue just keeps going.
    } finally {
      const again = this.inFlight.get(key) === true;
      this.inFlight.delete(key);
      if (again) this.push(entry.invalidation);
    }
  }

  clear(): void {
    this.pending.forEach((entry) => clearTimeout(entry.timer));
    this.pending.clear();
    this.inFlight.clear();
  }
}
