import { modelRefKey } from '../types';
import type { ChatMessage } from '../types';

// FNV-1a: cheap, stable digest so large payloads (tool output, data URLs) don't get
// concatenated into a signature string on every poll.
export const digest = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${value.length}.${hash.toString(36)}`;
};

const digestInput = (input: Record<string, unknown> | undefined): string => {
  if (!input) return '';
  try {
    return digest(JSON.stringify(input));
  } catch {
    // Cyclic or BigInt payloads from the server must not crash a setState updater.
    return 'unserializable';
  }
};

const partSignature = (part: ChatMessage['parts'][number]): string => {
  if (part.type === 'text' || part.type === 'reasoning') {
    return `${part.type}:${part.id}:${digest(part.text)}`;
  }
  if (part.type === 'file') {
    return `file:${part.id}:${part.file.mime}:${part.file.filename}:${digest(part.file.url)}`;
  }
  const { call } = part;
  return `tool:${part.id}:${call.id}:${call.tool}:${call.status}:${call.title ?? ''}:${call.error ?? ''}:${digestInput(call.input)}:${digest(call.output ?? '')}:${digest(call.diff ?? '')}`;
};

/**
 * Everything that can visibly change on a message. A fresh poll that yields the same signature can
 * reuse the previous object; anything the transcript renders (tokens, cost, abort state, model
 * variant, part shape, tool metadata) must be part of it or a streamed update would be dropped.
 */
export const messageSignature = (message: ChatMessage): string =>
  [
    message.id,
    message.role,
    message.completed ? 1 : 0,
    message.createdAt ?? '',
    message.completedAt ?? '',
    message.model ? `${modelRefKey(message.model)}/${message.model.variant ?? ''}` : '',
    message.error ?? '',
    message.aborted ? 1 : 0,
    message.tokens
      ? `${message.tokens.input},${message.tokens.output},${message.tokens.cacheRead},${message.tokens.cacheWrite}`
      : '',
    message.cost ?? '',
    digest(message.text),
    message.parts.map(partSignature).join('\u0001'),
  ].join('|');
