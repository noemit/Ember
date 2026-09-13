import { describe, expect, test } from 'bun:test';
import {
  equalMessage,
  reconcileFullTranscript,
  reconcileTranscriptTail,
  shareMessageReferences,
} from './src/lib/transcriptReconciliation';
import type { ChatMessage, MessagePart } from './src/types';

const textPart = (id: string, text: string): MessagePart => ({ type: 'text', id, text });

const user = (id: string, text: string): ChatMessage => ({
  id,
  role: 'user',
  text,
  parts: [textPart(`${id}-text`, text)],
  completed: true,
});

const assistant = (id: string, text: string, overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  role: 'assistant',
  text,
  parts: [textPart(`${id}-text`, text)],
  completed: true,
  ...overrides,
});

const ids = (messages: readonly ChatMessage[]): string[] => messages.map((message) => message.id);

describe('message equality and structural sharing', () => {
  test('identical content is equal and reuses the previous array', () => {
    const previous = [user('u1', 'hi'), assistant('a1', 'yo')];
    expect(equalMessage(previous[1], assistant('a1', 'yo'))).toBe(true);
    expect(shareMessageReferences(previous, [user('u1', 'hi'), assistant('a1', 'yo')])).toBe(previous);
  });

  test('replaces a message when any rendered field changes', () => {
    const expectReplaced = (before: ChatMessage, after: ChatMessage) => {
      const result = reconcileFullTranscript([before], [after], new Set());
      expect(result.messages[0]).toBe(after);
    };

    const base = assistant('a1', 'hello', {
      tokens: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
    });
    expectReplaced(base, { ...base, tokens: { input: 9, output: 2, cacheRead: 0, cacheWrite: 0 } });
    expectReplaced(base, { ...base, aborted: true, error: 'Stopped' });
    expectReplaced(base, { ...base, model: { providerID: 'p', modelID: 'm', variant: 'high' } });
    expectReplaced(base, { ...base, parts: [textPart('a1-other', 'hello')] });
    expectReplaced(base, { ...base, parts: [{ type: 'reasoning', id: 'a1-text', text: 'hello' }] });

    const toolBase: ChatMessage = {
      ...assistant('a1', ''),
      parts: [{ type: 'tool', id: 'a1-tool', call: { id: 'c1', tool: 'bash', status: 'running' } }],
    };
    expectReplaced(toolBase, {
      ...toolBase,
      parts: [
        { type: 'tool', id: 'a1-tool', call: { id: 'c1', tool: 'bash', status: 'running', title: 'ls' } },
      ],
    });
    expectReplaced(toolBase, {
      ...toolBase,
      parts: [
        {
          type: 'tool',
          id: 'a1-tool',
          call: { id: 'c1', tool: 'bash', status: 'completed', output: 'done' },
        },
      ],
    });

    const fileBase: ChatMessage = {
      ...assistant('a1', ''),
      parts: [{ type: 'file', id: 'a1-file', file: { filename: 'a.txt', mime: 'text/plain', url: 'data:one' } }],
    };
    expectReplaced(fileBase, {
      ...fileBase,
      parts: [{ type: 'file', id: 'a1-file', file: { filename: 'a.txt', mime: 'text/plain', url: 'data:two' } }],
    });
    expectReplaced(fileBase, {
      ...fileBase,
      parts: [{ type: 'file', id: 'a1-file', file: { filename: 'b.txt', mime: 'text/plain', url: 'data:one' } }],
    });
    expectReplaced(fileBase, {
      ...fileBase,
      parts: [{ type: 'file', id: 'a1-file', file: { filename: 'a.txt', mime: 'image/png', url: 'data:one' } }],
    });
  });

  test('a cyclic tool input does not throw', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const tool: ChatMessage = {
      ...assistant('a1', ''),
      parts: [{ type: 'tool', id: 'a1-tool', call: { id: 'c1', tool: 'bash', status: 'running', input: cyclic } }],
    };
    expect(() => equalMessage(tool, { ...tool })).not.toThrow();
    expect(() =>
      reconcileFullTranscript([tool], [{ ...tool, completedAt: 5 }], new Set())
    ).not.toThrow();
  });
});

describe('full reconciliation', () => {
  test('updating only the last message preserves every earlier object', () => {
    const previous = [user('u1', 'hi'), assistant('a1', 'start')];
    const updated = assistant('a1', 'start more');
    const result = reconcileFullTranscript(previous, [user('u1', 'hi'), updated], new Set());
    expect(result.messages).not.toBe(previous);
    expect(result.messages[0]).toBe(previous[0]);
    expect(result.messages[1]).toBe(updated);
  });

  test('append preserves existing objects', () => {
    const previous = [user('u1', 'hi')];
    const appended = assistant('a1', 'new');
    const result = reconcileFullTranscript(previous, [user('u1', 'hi'), appended], new Set());
    expect(result.messages[0]).toBe(previous[0]);
    expect(result.messages[1]).toBe(appended);
  });

  test('removal and reorder follow the authoritative response', () => {
    const a = user('a', 'A');
    const b = user('b', 'B');
    expect(ids(reconcileFullTranscript([a, b], [b], new Set()).messages)).toEqual(['b']);
    expect(ids(reconcileFullTranscript([a, b], [b, a], new Set()).messages)).toEqual(['b', 'a']);
  });

  test('matches a direct optimistic id and reports it for release', () => {
    const optimistic = user('msg_opt', 'Hello');
    const current = [user('u1', 'Earlier'), optimistic];
    const fetched = [user('u1', 'Earlier'), user('msg_opt', 'Hello')];
    const result = reconcileFullTranscript(current, fetched, new Set([optimistic.id]));
    expect(result.reconciledOptimisticIds).toEqual(['msg_opt']);
    expect(ids(result.messages)).toEqual(['u1', 'msg_opt']);
  });

  test('a new legacy server id matches the optimistic turn, not an older identical one', () => {
    const previous = user('u1', 'Hello');
    const optimistic = user('msg_opt', 'Hello');
    const server = user('msg_server', 'Hello');
    const pending = new Set([optimistic.id]);

    const notYetIndexed = reconcileFullTranscript([previous, optimistic], [previous], pending);
    expect(ids(notYetIndexed.messages)).toEqual(['u1', 'msg_opt']);
    expect(notYetIndexed.reconciledOptimisticIds).toEqual([]);

    const indexed = reconcileFullTranscript([previous, optimistic], [previous, server], pending);
    expect(ids(indexed.messages)).toEqual(['u1', 'msg_server']);
    expect(indexed.reconciledOptimisticIds).toEqual(['msg_opt']);
  });

  test('two transcripts reconcile independently', () => {
    const a = [user('a1', 'a')];
    const b = [user('b1', 'b')];
    const ra = reconcileFullTranscript(a, [user('a1', 'a')], new Set());
    const rb = reconcileFullTranscript(b, [user('b1', 'b changed')], new Set());
    expect(ra.messages).toBe(a);
    expect(rb.messages[0].text).toBe('b changed');
    expect(b[0].text).toBe('b');
  });
});

describe('tail reconciliation', () => {
  test('preserves the prefix and replaces the suffix from the earliest overlap', () => {
    const current = [user('u1', 'u1'), assistant('a1', 'a1'), user('u2', 'u2'), assistant('a2', 'a2')];
    const tail = [user('u2', 'u2'), assistant('a2', 'a2 changed')];
    const result = reconcileTranscriptTail(current, tail, new Set());
    expect(result.needsFullFetch).toBe(false);
    expect(ids(result.messages)).toEqual(['u1', 'a1', 'u2', 'a2']);
    expect(result.messages[0]).toBe(current[0]);
    expect(result.messages[1]).toBe(current[1]);
    expect(result.messages[3].text).toBe('a2 changed');
  });

  test('keeps an optimistic turn the tail has not indexed yet', () => {
    const optimistic = user('msg_opt', 'next');
    const current = [user('u1', 'one'), assistant('a1', 'two'), optimistic];
    const tail = [user('u1', 'one'), assistant('a1', 'two')];
    const result = reconcileTranscriptTail(current, tail, new Set([optimistic.id]));
    expect(result.needsFullFetch).toBe(false);
    expect(ids(result.messages)).toEqual(['u1', 'a1', 'msg_opt']);
    expect(result.reconciledOptimisticIds).toEqual([]);
  });

  test('a tail with no overlap asks for a full repair and keeps the current transcript', () => {
    const current = [user('x1', 'x'), user('x2', 'y')];
    const result = reconcileTranscriptTail(current, [assistant('z1', 'brand new')], new Set());
    expect(result.needsFullFetch).toBe(true);
    expect(result.messages).toBe(current);
  });

  test('an empty tail with a non-empty transcript asks for a full repair', () => {
    const current = [user('x1', 'x')];
    const result = reconcileTranscriptTail(current, [], new Set());
    expect(result.needsFullFetch).toBe(true);
    expect(result.messages).toBe(current);
  });

  test('an empty current transcript adopts the tail', () => {
    const tail = [user('u1', 'one'), assistant('a1', 'two')];
    const result = reconcileTranscriptTail([], tail, new Set());
    expect(result.needsFullFetch).toBe(false);
    expect(result.messages).toBe(tail);
  });
});
