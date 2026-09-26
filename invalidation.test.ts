import { describe, expect, test } from 'bun:test';
import {
  InvalidationQueue,
  invalidationsFor,
  type Invalidation,
  type InvalidationPolicy,
} from './src/lib/invalidation';

const loadedNone = () => false;
const loaded = (_instance: string, sessionId: string) => sessionId === 'open';
const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('event → invalidations', () => {
  test('a visible token update requests a bounded tail; a background one only its summary', () => {
    expect(
      invalidationsFor({ instanceId: 'a', type: 'session.text.delta', sessionId: 'open' }, loaded)
    ).toEqual([{ instanceId: 'a', resource: 'messages', sessionId: 'open', messageMode: 'tail' }]);
    expect(
      invalidationsFor({ instanceId: 'a', type: 'session.text.delta', sessionId: 'other' }, loaded)
    ).toEqual([{ instanceId: 'a', resource: 'messageSummary', sessionId: 'other' }]);
    expect(invalidationsFor({ instanceId: 'a', type: 'session.text.delta' }, loaded)).toEqual([]);
  });

  test('failed, interrupted and compacted turns request a full repair for visible sessions', () => {
    for (const type of ['session.execution.failed', 'session.execution.interrupted', 'session.error', 'session.compacted']) {
      expect(invalidationsFor({ instanceId: 'a', type, sessionId: 'open' }, loaded)).toContainEqual({
        instanceId: 'a',
        resource: 'messages',
        sessionId: 'open',
        messageMode: 'full',
      });
    }
    expect(invalidationsFor({ instanceId: 'a', type: 'session.idle', sessionId: 'open' }, loaded)).toEqual([
      { instanceId: 'a', resource: 'states' },
      { instanceId: 'a', resource: 'sessions' },
      { instanceId: 'a', resource: 'messages', sessionId: 'open', messageMode: 'full' },
    ]);
    expect(invalidationsFor({ instanceId: 'a', type: 'session.idle', sessionId: 'other' }, loadedNone)).toEqual([
      { instanceId: 'a', resource: 'states' },
      { instanceId: 'a', resource: 'sessions' },
      { instanceId: 'a', resource: 'messageSummary', sessionId: 'other' },
    ]);
  });

  test('background token events never invalidate the session list', () => {
    const result = invalidationsFor(
      { instanceId: 'a', type: 'session.text.delta', sessionId: 'background' },
      loaded
    );
    expect(result.some((invalidation) => invalidation.resource === 'sessions')).toBe(false);
  });

  test('permission, form and schedule events map onto their resources', () => {
    expect(invalidationsFor({ instanceId: 'a', type: 'permission.asked', sessionId: 's' }, loadedNone)).toEqual([
      { instanceId: 'a', resource: 'permissions' },
      { instanceId: 'a', resource: 'states' },
    ]);
    expect(invalidationsFor({ instanceId: 'a', type: 'form.created', sessionId: 's' }, loadedNone)).toEqual([
      { instanceId: 'a', resource: 'questions' },
      { instanceId: 'a', resource: 'states' },
    ]);
    expect(invalidationsFor({ instanceId: 'a', type: 'openchamber:scheduled-task-ran' }, loadedNone)).toEqual([
      { instanceId: 'a', resource: 'scheduled' },
      { instanceId: 'a', resource: 'sessions' },
    ]);
    expect(invalidationsFor({ instanceId: 'a', type: 'session.diff', sessionId: 's' }, loadedNone)).toEqual([]);
    expect(invalidationsFor({ instanceId: 'a', type: 'openchamber:notification' }, loadedNone)).toEqual([]);
    expect(invalidationsFor({ instanceId: 'a', type: 'something.new' }, loadedNone)).toEqual([]);
  });
});

describe('invalidation queue', () => {
  const promptPolicy = (): InvalidationPolicy => ({ leadMs: 10, minIntervalMs: 0 });
  const throttledPolicy = (): InvalidationPolicy => ({ leadMs: 10, minIntervalMs: 60 });

  test('coalesces a burst into one refetch per key', async () => {
    const calls: Invalidation[] = [];
    const queue = new InvalidationQueue(async (invalidation) => {
      calls.push(invalidation);
    }, promptPolicy);
    for (let i = 0; i < 20; i += 1) {
      queue.push({ instanceId: 'a', resource: 'messages', sessionId: 's', messageMode: 'tail' });
    }
    queue.push({ instanceId: 'a', resource: 'states' });
    await tick(30);
    expect(calls).toEqual([
      { instanceId: 'a', resource: 'messages', sessionId: 's', messageMode: 'tail' },
      { instanceId: 'a', resource: 'states' },
    ]);
  });

  test('a hint during an in-flight refetch schedules exactly one follow-up', async () => {
    let calls = 0;
    let release: () => void = () => {};
    const queue = new InvalidationQueue(async () => {
      calls += 1;
      if (calls === 1) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
    }, promptPolicy);
    queue.push({ instanceId: 'a', resource: 'states' });
    await tick(20);
    expect(calls).toBe(1);
    queue.push({ instanceId: 'a', resource: 'states' });
    queue.push({ instanceId: 'a', resource: 'states' });
    release();
    await tick(30);
    expect(calls).toBe(2);
  });

  test('a pending tail is upgraded to a full repair and never downgraded', async () => {
    const calls: Invalidation[] = [];
    const queue = new InvalidationQueue(async (invalidation) => {
      calls.push(invalidation);
    }, promptPolicy);
    queue.push({ instanceId: 'a', resource: 'messages', sessionId: 's', messageMode: 'tail' });
    queue.push({ instanceId: 'a', resource: 'messages', sessionId: 's', messageMode: 'full' });
    queue.push({ instanceId: 'a', resource: 'messages', sessionId: 's', messageMode: 'tail' });
    await tick(30);
    expect(calls).toEqual([
      { instanceId: 'a', resource: 'messages', sessionId: 's', messageMode: 'full' },
    ]);
  });

  test('upgrading a throttled tail advances its timer', async () => {
    const calls: string[] = [];
    const queue = new InvalidationQueue(async (entry) => { calls.push(entry.messageMode ?? ''); },
      (entry) => ({ leadMs: 5, minIntervalMs: entry.messageMode === 'full' ? 0 : 300 }));
    const tail: Invalidation = { instanceId: 'a', resource: 'messages', sessionId: 's', messageMode: 'tail' };
    queue.push(tail);
    await tick(20);
    queue.push(tail);
    queue.push({ ...tail, messageMode: 'full' });
    await tick(30);
    queue.clear();
    expect(calls).toEqual(['tail', 'full']);
  });

  test('continuous token hints respect the minimum interval', async () => {
    const startedAt: number[] = [];
    const queue = new InvalidationQueue(
      async () => {
        startedAt.push(Date.now());
      },
      throttledPolicy
    );
    const timer = setInterval(
      () => queue.push({ instanceId: 'a', resource: 'messages', sessionId: 's', messageMode: 'tail' }),
      15
    );
    await tick(200);
    clearInterval(timer);
    queue.clear();
    expect(startedAt.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < startedAt.length; i += 1) {
      expect(startedAt[i] - startedAt[i - 1]).toBeGreaterThanOrEqual(60);
    }
  });

  test('a failing refetch does not wedge the key', async () => {
    let calls = 0;
    const queue = new InvalidationQueue(async () => {
      calls += 1;
      throw new Error('boom');
    }, promptPolicy);
    queue.push({ instanceId: 'a', resource: 'states' });
    await tick(20);
    queue.push({ instanceId: 'a', resource: 'states' });
    await tick(20);
    expect(calls).toBe(2);
  });

  test('sessions and instances remain independently keyed', async () => {
    const calls: Invalidation[] = [];
    const queue = new InvalidationQueue(async (invalidation) => {
      calls.push(invalidation);
    }, promptPolicy);
    queue.push({ instanceId: 'a', resource: 'messages', sessionId: 's1' });
    queue.push({ instanceId: 'a', resource: 'messages', sessionId: 's2' });
    queue.push({ instanceId: 'b', resource: 'messages', sessionId: 's1' });
    await tick(30);
    expect(calls).toHaveLength(3);
  });

  test('clear() prevents delayed work', async () => {
    let calls = 0;
    const queue = new InvalidationQueue(async () => {
      calls += 1;
    }, promptPolicy);
    queue.push({ instanceId: 'a', resource: 'states' });
    queue.clear();
    await tick(30);
    expect(calls).toBe(0);
  });
});
