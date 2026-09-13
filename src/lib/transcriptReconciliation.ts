import type { ChatMessage } from '../types';
import { messageSignature } from './messageSignature';

export type TranscriptReconciliation = {
  messages: ChatMessage[];
  reconciledOptimisticIds: string[];
  needsFullFetch: boolean;
};

/** Same renderer-observable content, so the previous object can be reused. */
export const equalMessage = (a: ChatMessage, b: ChatMessage): boolean =>
  a === b || messageSignature(a) === messageSignature(b);

/**
 * A sent-but-not-yet-indexed user turn. The server copy may reuse our client id (modern builds) or
 * get a fresh one (legacy); matching on the outgoing shape lets both reconcile to the same bubble.
 */
export const outgoingMessageSignature = (message: ChatMessage): string | null => {
  if (message.role !== 'user') return null;
  const files = message.parts
    .filter((part) => part.type === 'file')
    .map((part) => [part.file.mime, part.file.filename]);
  return JSON.stringify([message.text, files]);
};

/**
 * Reuses previous message objects for records a fresh fetch left unchanged. Returns the previous
 * array itself when length, order and every reference are unchanged, so React.memo rows skip work.
 */
export function shareMessageReferences(
  previous: readonly ChatMessage[],
  next: readonly ChatMessage[]
): ChatMessage[] {
  if (previous.length === 0) return next as ChatMessage[];
  const byId = new Map(previous.map((message) => [message.id, message]));
  const shared = next.map((message) => {
    const old = byId.get(message.id);
    return old && equalMessage(old, message) ? old : message;
  });
  if (shared.length === previous.length && shared.every((message, index) => message === previous[index])) {
    return previous as ChatMessage[];
  }
  return shared;
}

type OptimisticReconciliation = {
  unmatched: ChatMessage[];
  reconciledIds: string[];
};

/**
 * Pairs pending optimistic turns against a fetched server list. A message is reconciled when the
 * server either preserves its id or returns a *new* record with the same outgoing shape; matching
 * only against records absent from the current transcript keeps an older identical turn from
 * swallowing the match.
 */
const reconcileOptimistic = (
  current: readonly ChatMessage[],
  fetched: readonly ChatMessage[],
  pendingIds: ReadonlySet<string>
): OptimisticReconciliation => {
  const pending = current.filter((message) => pendingIds.has(message.id));
  if (pending.length === 0) return { unmatched: [], reconciledIds: [] };

  const fetchedIds = new Set(fetched.map((message) => message.id));
  const knownIds = new Set(
    current.filter((message) => !pendingIds.has(message.id)).map((message) => message.id)
  );
  const candidates = fetched.filter((message) => !knownIds.has(message.id));
  const consumed = new Set<number>();
  const unmatched: ChatMessage[] = [];
  const reconciledIds: string[] = [];

  pending.forEach((message) => {
    if (fetchedIds.has(message.id)) {
      reconciledIds.push(message.id);
      return;
    }
    const signature = outgoingMessageSignature(message);
    if (signature === null) {
      unmatched.push(message);
      return;
    }
    const index = candidates.findIndex(
      (candidate, candidateIndex) =>
        !consumed.has(candidateIndex) && outgoingMessageSignature(candidate) === signature
    );
    if (index < 0) {
      unmatched.push(message);
      return;
    }
    consumed.add(index);
    reconciledIds.push(message.id);
  });

  return { unmatched, reconciledIds };
};

/** A complete response is authoritative: it replaces the transcript and keeps unmatched sends. */
export function reconcileFullTranscript(
  current: readonly ChatMessage[],
  fetched: readonly ChatMessage[],
  pendingIds: ReadonlySet<string>
): TranscriptReconciliation {
  const { unmatched, reconciledIds } = reconcileOptimistic(current, fetched, pendingIds);
  const final = unmatched.length > 0 ? [...fetched, ...unmatched] : (fetched as ChatMessage[]);
  return {
    messages: shareMessageReferences(current, final),
    reconciledOptimisticIds: reconciledIds,
    needsFullFetch: false,
  };
}

/**
 * A bounded tail is not authoritative. Preserve the current prefix up to the earliest overlapping
 * message, replace the suffix with the fetched tail, and keep unmatched sends. With no overlap the
 * server may have compacted or rewritten history, so ask the caller for one full repair rather than
 * gluing on a discontinuous tail.
 */
export function reconcileTranscriptTail(
  current: readonly ChatMessage[],
  fetchedTail: readonly ChatMessage[],
  pendingIds: ReadonlySet<string>
): TranscriptReconciliation {
  const { unmatched, reconciledIds } = reconcileOptimistic(current, fetchedTail, pendingIds);

  if (current.length === 0) {
    const final = unmatched.length > 0 ? [...fetchedTail, ...unmatched] : (fetchedTail as ChatMessage[]);
    return {
      messages: shareMessageReferences(current, final),
      reconciledOptimisticIds: reconciledIds,
      needsFullFetch: false,
    };
  }

  const currentIds = new Set(current.map((message) => message.id));
  const overlapIndex = fetchedTail.findIndex((message) => currentIds.has(message.id));
  if (overlapIndex < 0) {
    return {
      messages: current as ChatMessage[],
      reconciledOptimisticIds: reconciledIds,
      needsFullFetch: true,
    };
  }

  const overlapId = fetchedTail[overlapIndex].id;
  const currentOverlap = current.findIndex((message) => message.id === overlapId);
  const base = [...current.slice(0, currentOverlap), ...fetchedTail];
  const baseIds = new Set(base.map((message) => message.id));
  const appended = unmatched.filter((message) => !baseIds.has(message.id));
  const final = appended.length > 0 ? [...base, ...appended] : base;

  return {
    messages: shareMessageReferences(current, final),
    reconciledOptimisticIds: reconciledIds,
    needsFullFetch: false,
  };
}
