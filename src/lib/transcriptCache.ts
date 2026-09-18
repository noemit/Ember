import type { ChatMessage } from '../types';

const estimates = new WeakMap<ChatMessage, number>();
const estimate = (value: unknown, seen: Set<object>): number => {
  if (typeof value === 'string') return value.length * 2;
  if (!value || typeof value !== 'object') return 8;
  if (seen.has(value)) return 0;
  seen.add(value);
  return 32 + Object.entries(value).reduce((bytes, [key, entry]) => bytes + key.length * 2 + estimate(entry, seen), 0);
};
export const messageBytes = (message: ChatMessage): number => {
  let bytes = estimates.get(message);
  if (bytes === undefined) {
    bytes = estimate(message, new Set());
    estimates.set(message, bytes);
  }
  return bytes;
};

export class TranscriptCache extends Map<string, ChatMessage[]> {
  private sizes = new Map<string, number>();
  bytes = 0;

  constructor(private readonly protectedKeys: () => ReadonlySet<string>, readonly budget = 64 * 1024 * 1024, readonly capacity = 12) {
    super();
  }

  override set(key: string, messages: ChatMessage[]): this {
    this.delete(key);
    super.set(key, messages);
    const bytes = messages.reduce((sum, message) => sum + messageBytes(message), 0);
    this.sizes.set(key, bytes);
    this.bytes += bytes;
    this.prune();
    return this;
  }

  override delete(key: string): boolean {
    this.bytes -= this.sizes.get(key) ?? 0;
    this.sizes.delete(key);
    return super.delete(key);
  }

  override clear(): void {
    super.clear();
    this.sizes.clear();
    this.bytes = 0;
  }

  prune(): void {
    const protectedKeys = this.protectedKeys();
    for (const key of this.keys()) {
      if (this.bytes <= this.budget && this.size <= this.capacity) break;
      if (!protectedKeys.has(key)) this.delete(key);
    }
  }
}
