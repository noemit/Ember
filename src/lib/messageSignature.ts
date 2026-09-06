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

/** Everything that can visibly change on a message. Tool calls change status without the text changing, so parts count too. */
export const messageSignature = (message: ChatMessage): string =>
  `${message.id}|${message.completed ? 1 : 0}|${message.createdAt ?? ''}|${message.completedAt ?? ''}|${message.model ? modelRefKey(message.model) : ''}|${message.error ?? ''}|${message.parts
    .map((part) => {
      if (part.type === 'text' || part.type === 'reasoning') return digest(part.text);
      if (part.type === 'file') return `${part.file.mime}:${part.file.filename}:${digest(part.file.url)}`;
      const { call } = part;
      return `${call.id}:${call.status}:${call.title ?? ''}:${call.error ?? ''}:${digestInput(call.input)}:${digest(call.output ?? '')}:${digest(call.diff ?? '')}`;
    })
    .join('\u0001')}`;

/** True when a fresh poll would render identically, so the previous array can be kept. */
export const sameMessages = (a: ChatMessage[], b: ChatMessage[]): boolean =>
  a.length === b.length && a.every((m, i) => messageSignature(m) === messageSignature(b[i]));
