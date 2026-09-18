import { expect, test } from 'bun:test';
import { TranscriptCache, messageBytes } from './src/lib/transcriptCache';
import type { ChatMessage } from './src/types';

const message = (id: string): ChatMessage => ({ id, role: 'assistant', text: 'x'.repeat(1000), parts: [], completed: true });

test('evicts by bytes before hitting the session count limit', () => {
  const m = message('m');
  const cache = new TranscriptCache(() => new Set(), messageBytes(m) + 1);
  cache.set('a', [m]);
  cache.set('b', [message('n')]);
  expect(cache.has('a')).toBe(false);
  expect(cache.has('b')).toBe(true);
  expect(cache.bytes).toBeLessThanOrEqual(cache.budget);
});

test('protects visible content and accounts for over-budget working sets', () => {
  const protectedKeys = new Set(['a']);
  const cache = new TranscriptCache(() => protectedKeys, 100);
  cache.set('a', [message('a')]);
  expect(cache.has('a')).toBe(true);
  expect(cache.bytes).toBeGreaterThan(cache.budget);
  protectedKeys.clear();
  cache.prune();
  expect(cache.size).toBe(0);
  expect(cache.bytes).toBe(0);
});

test('replacements and clear do not double count memory', () => {
  const cache = new TranscriptCache(() => new Set());
  const m = message('m');
  cache.set('a', [m]);
  cache.set('a', [m]);
  expect(cache.bytes).toBe(messageBytes(m));
  cache.clear();
  expect(cache.bytes).toBe(0);
});
