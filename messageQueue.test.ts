import { describe, expect, test } from 'bun:test';
import { mergePolledQueues } from './src/hooks/useMessageQueue';
import type { MessageQueueSession, QueuedMessage } from './src/types';

const queued = (id: string, extra: Partial<QueuedMessage> = {}): QueuedMessage => ({
  id,
  createdAt: 0,
  content: id,
  text: id,
  attachments: [],
  context: [],
  sendConfig: { providerID: 'p', modelID: 'm' },
  ...extra,
});

const session = (items: QueuedMessage[]): MessageQueueSession => ({
  sessionId: 's',
  directory: '/d',
  sendingId: null,
  items,
});

describe('message queue polling', () => {
  test('keeps local pending and failed rows across a poll', () => {
    const prev = {
      local: [session([queued('server-1'), queued('local-1', { pending: true }), queued('local-2', { error: 'nope' })])],
    };
    const next = { local: [session([queued('server-1'), queued('server-2')])] };
    const merged = mergePolledQueues(prev, next);
    expect(merged.local[0].items.map((item) => item.id)).toEqual([
      'local-1',
      'local-2',
      'server-1',
      'server-2',
    ]);
  });

  test('keeps a queue that only holds local rows', () => {
    const prev = { local: [session([queued('local-1', { pending: true })])] };
    const next = { local: [] as MessageQueueSession[] };
    const merged = mergePolledQueues(prev, next);
    expect(merged.local).toHaveLength(1);
    expect(merged.local[0].items.map((item) => item.id)).toEqual(['local-1']);
  });

  test('drops a local row once the server reports the same id', () => {
    const prev = { local: [session([queued('server-1', { pending: true })])] };
    const next = { local: [session([queued('server-1')])] };
    const merged = mergePolledQueues(prev, next);
    expect(merged.local[0].items).toEqual([queued('server-1')]);
  });
});
