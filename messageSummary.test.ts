import { describe, expect, test } from 'bun:test';
import { summarizeMessages, type SessionMessageSummary } from './src/lib/messageSummary';
import type { ChatMessage } from './src/types';

const message = (
  id: string,
  role: ChatMessage['role'],
  text: string,
  overrides: Partial<ChatMessage> = {}
): ChatMessage => ({
  id,
  role,
  text,
  parts: text ? [{ type: 'text', id: `${id}-text`, text }] : [],
  completed: true,
  ...overrides,
});

const toolOnly: ChatMessage = {
  id: 'tool',
  role: 'assistant',
  text: '',
  parts: [{ type: 'tool', id: 'tool-1', call: { id: 'c1', tool: 'bash', status: 'completed' } }],
  completed: true,
};

const previous: SessionMessageSummary = { preview: 'old preview', failed: false, thinking: false };

describe('summarizeMessages', () => {
  test('uses the latest textual turn for the preview', () => {
    const summary = summarizeMessages(
      [message('u1', 'user', 'the question'), message('a1', 'assistant', 'the answer')],
      { complete: true }
    );
    expect(summary.preview).toBe('the answer');
  });

  test('skips trailing tool-only turns', () => {
    const summary = summarizeMessages(
      [message('u1', 'user', 'question'), message('a1', 'assistant', 'answer'), toolOnly],
      { complete: true }
    );
    expect(summary.preview).toBe('answer');
  });

  test('retains the previous preview for an incomplete tool-only tail', () => {
    const summary = summarizeMessages([toolOnly], { previous, complete: false });
    expect(summary.preview).toBe('old preview');
  });

  test('clears the preview only when a complete transcript has nothing previewable', () => {
    expect(summarizeMessages([toolOnly], { previous, complete: true }).preview).toBe('');
    expect(summarizeMessages([toolOnly], { previous, complete: false }).preview).toBe('old preview');
  });

  test('marks a final non-aborted assistant error as failed', () => {
    const failed = message('a1', 'assistant', '', { error: 'boom' });
    expect(summarizeMessages([failed], { complete: true }).failed).toBe(true);

    const aborted = message('a1', 'assistant', '', { error: 'stopped', aborted: true });
    expect(summarizeMessages([aborted], { complete: true }).failed).toBe(false);
  });

  test('clears an earlier failure after a later successful turn', () => {
    const failed = message('a1', 'assistant', '', { error: 'boom' });
    const retry = message('u2', 'user', 'try again');
    const answer = message('a2', 'assistant', 'worked');
    expect(summarizeMessages([failed, retry, answer], { complete: true }).failed).toBe(false);
  });

  test('detects a reasoning-only thinking state but not a running tool', () => {
    const thinking: ChatMessage = {
      id: 'a1',
      role: 'assistant',
      text: '',
      parts: [{ type: 'reasoning', id: 'r1', text: 'weighing options' }],
      completed: false,
    };
    expect(summarizeMessages([thinking], { complete: false }).thinking).toBe(true);

    const busy: ChatMessage = {
      ...thinking,
      parts: [{ type: 'tool', id: 't1', call: { id: 'c1', tool: 'bash', status: 'running' } }],
    };
    expect(summarizeMessages([busy], { complete: false }).thinking).toBe(false);
  });

  test('carries the requested version through', () => {
    expect(summarizeMessages([message('u1', 'user', 'hi')], { complete: true, version: 42 }).version).toBe(42);
  });
});
