import { describe, expect, test } from 'bun:test';
import { InvalidationQueue, invalidationsFor, type Invalidation } from './src/lib/invalidation';

const loadedNone = () => false;
const loaded = (_instance: string, sessionId: string) => sessionId === 'open';

describe('event → invalidations', () => {
  test('status events refresh states; session lifecycle refreshes the list', () => {
    expect(invalidationsFor({ instanceId: 'a', type: 'session.status', sessionId: 's' }, loadedNone)).toEqual([
      { instanceId: 'a', resource: 'states' },
    ]);
    expect(invalidationsFor({ instanceId: 'a', type: 'session.created', sessionId: 's' }, loadedNone)).toEqual([
      { instanceId: 'a', resource: 'sessions' },
    ]);
    expect(invalidationsFor({ instanceId: 'a', type: 'openchamber:session-created' }, loadedNone)).toEqual([
      { instanceId: 'a', resource: 'sessions' },
    ]);
  });

  test('message events refetch the transcript only when it is loaded, else the session list', () => {
    expect(invalidationsFor({ instanceId: 'a', type: 'message.part.updated', sessionId: 'open' }, loaded)).toEqual([
      { instanceId: 'a', resource: 'messages', sessionId: 'open' },
    ]);
    expect(invalidationsFor({ instanceId: 'a', type: 'message.part.updated', sessionId: 'other' }, loaded)).toEqual([
      { instanceId: 'a', resource: 'sessions' },
    ]);
    expect(invalidationsFor({ instanceId: 'a', type: 'message.updated' }, loaded)).toEqual([]);
  });

  test('permission and question events also refresh states, since they force needs-input', () => {
    expect(invalidationsFor({ instanceId: 'a', type: 'permission.updated', sessionId: 's' }, loadedNone)).toEqual([
      { instanceId: 'a', resource: 'permissions' },
      { instanceId: 'a', resource: 'states' },
    ]);
    expect(invalidationsFor({ instanceId: 'a', type: 'question.asked', sessionId: 's' }, loadedNone)).toEqual([
      { instanceId: 'a', resource: 'questions' },
      { instanceId: 'a', resource: 'states' },
    ]);
  });

  test('policy and schedule events map to their resources; unknown or chatter events map to nothing', () => {
    expect(invalidationsFor({ instanceId: 'a', type: 'openchamber:permission-auto-accept.updated' }, loadedNone)).toEqual([
      { instanceId: 'a', resource: 'autoAccept' },
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
  const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  test('coalesces a burst into one refetch per key', async () => {
    const calls: Invalidation[] = [];
    const queue = new InvalidationQueue(async (inv) => {
      calls.push(inv);
    }, 10);
    for (let i = 0; i < 20; i += 1) queue.push({ instanceId: 'a', resource: 'messages', sessionId: 's' });
    queue.push({ instanceId: 'a', resource: 'states' });
    await tick(30);
    expect(calls).toEqual([
      { instanceId: 'a', resource: 'messages', sessionId: 's' },
      { instanceId: 'a', resource: 'states' },
    ]);
  });

  test('a hint during an in-flight refetch schedules exactly one follow-up', async () => {
    let calls = 0;
    let release: () => void = () => {};
    const queue = new InvalidationQueue(async () => {
      calls += 1;
      if (calls === 1) await new Promise<void>((resolve) => { release = resolve; });
    }, 5);
    queue.push({ instanceId: 'a', resource: 'states' });
    await tick(10);
    expect(calls).toBe(1);
    queue.push({ instanceId: 'a', resource: 'states' });
    queue.push({ instanceId: 'a', resource: 'states' });
    release();
    await tick(20);
    expect(calls).toBe(2);
  });

  test('a failing refetch does not wedge the key', async () => {
    let calls = 0;
    const queue = new InvalidationQueue(async () => {
      calls += 1;
      throw new Error('boom');
    }, 5);
    queue.push({ instanceId: 'a', resource: 'states' });
    await tick(10);
    queue.push({ instanceId: 'a', resource: 'states' });
    await tick(10);
    expect(calls).toBe(2);
  });
});
