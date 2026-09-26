import { describe, expect, test } from 'bun:test';
import { EventStreamManager, parseEventData, SseFrameParser, type EmberEvent } from './electron/eventStream';

describe('sse frame parser', () => {
  test('splits complete frames and keeps partial ones buffered', () => {
    const parser = new SseFrameParser();
    expect(parser.push('data: {"a":1}\n\ndata: {"b":')).toEqual(['{"a":1}']);
    expect(parser.push('2}\n\n:heartbeat\n\n')).toEqual(['{"b":2}']);
    expect(parser.push('')).toEqual([]);
  });

  test('joins multi-line data per the SSE spec and ignores other fields', () => {
    const parser = new SseFrameParser();
    expect(parser.push('id: 7\nevent: x\ndata: {"a":\ndata: 1}\n\n')).toEqual(['{"a":\n1}']);
  });
});

describe('event hints', () => {
  // Frames in OpenCode 2's envelope: { id, created, type, location, data, durable }.
  const opencode = (event: { type: string; data?: unknown; durable?: unknown; directory?: string }) =>
    JSON.stringify({
      id: 'evt_1',
      created: 1,
      type: event.type,
      location: { directory: event.directory ?? '/Users/me' },
      data: event.data ?? {},
      durable: event.durable ?? {},
    });

  test('extracts session and directory from OpenCode events', () => {
    expect(
      parseEventData('local', 'opencode', opencode({
        type: 'session.execution.started',
        data: { sessionID: 'ses_1' },
      }))
    ).toEqual({ instanceId: 'local', stream: 'opencode', type: 'session.execution.started', sessionId: 'ses_1', directory: '/Users/me' });

    expect(
      parseEventData('local', 'opencode', opencode({
        type: 'session.created',
        data: { sessionID: 'ses_2' },
        directory: '/Users/me/proj',
      }))
    ).toMatchObject({ type: 'session.created', sessionId: 'ses_2', directory: '/Users/me/proj' });

    expect(
      parseEventData('local', 'opencode', opencode({
        type: 'session.text.delta',
        data: { sessionID: 'ses_3', messageID: 'msg_1' },
      }))
    ).toMatchObject({ type: 'session.text.delta', sessionId: 'ses_3' });
    // Session ids can be nested a level down (permission requests, forms, inbox items) or
    // echoed on the durable aggregate for session-rooted events.
    expect(
      parseEventData('local', 'opencode', opencode({
        type: 'permission.asked',
        data: { request: { id: 'per_1', sessionID: 'ses_4' } },
      }))
    ).toMatchObject({ type: 'permission.asked', sessionId: 'ses_4' });
    expect(
      parseEventData('local', 'opencode', opencode({
        type: 'session.renamed',
        data: { title: 'New name' },
        durable: { aggregateID: 'ses_5', seq: 9 },
      }))
    ).toMatchObject({ type: 'session.renamed', sessionId: 'ses_5' });
  });

  test('extracts OpenChamber events, which are not wrapped', () => {
    expect(
      parseEventData('local', 'openchamber', JSON.stringify({
        type: 'openchamber:session-status',
        properties: { sessionID: 'ses_1', status: 'idle', needsAttention: false },
      }))
    ).toEqual({ instanceId: 'local', stream: 'openchamber', type: 'openchamber:session-status', sessionId: 'ses_1', directory: undefined });
    expect(
      parseEventData('local', 'openchamber', JSON.stringify({
        type: 'openchamber:session-activity',
        properties: { sessionId: 'ses_1', phase: 'busy' },
      }))
    ).toMatchObject({ sessionId: 'ses_1' });
  });

  test('drops connection chatter and garbage', () => {
    expect(parseEventData('local', 'opencode', opencode({ type: 'server.connected', data: {} }))).toBeNull();
    expect(parseEventData('local', 'opencode', opencode({ type: 'server.heartbeat' }))).toBeNull();
    expect(
      parseEventData('local', 'openchamber', JSON.stringify({ type: 'openchamber:notification-stream-ready', properties: { uiToken: 'secret' } }))
    ).toBeNull();
    expect(parseEventData('local', 'opencode', 'not json')).toBeNull();
    expect(parseEventData('local', 'opencode', '[]')).toBeNull();
  });
});

describe('stream manager', () => {
  const streamResponse = (frames: string[], signal?: AbortSignal) =>
    new Response(
      new ReadableStream({
        start(controller) {
          frames.forEach((frame) => controller.enqueue(new TextEncoder().encode(frame)));
          // Leave the stream open; the test stops the manager. A real fetch binds the body to
          // the request signal, so mirror that: abort closes the stream.
          signal?.addEventListener('abort', () => {
            try { controller.close(); } catch { /* already closed */ }
          });
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } }
    );

  test('opens both streams per instance, reports live status and forwards hints', async () => {
    const events: EmberEvent[] = [];
    const statuses: Array<[string, boolean]> = [];
    const urls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith('/api/event')) {
        return streamResponse([
          'data: {"type":"server.connected","data":{}}\n\n',
          'data: {"type":"session.execution.started","location":{"directory":"/w"},"data":{"sessionID":"s1"}}\n\n',
        ]);
      }
      return streamResponse(['data: {"type":"openchamber:session-activity","properties":{"sessionId":"s1","phase":"busy"}}\n\n']);
    }) as typeof fetch;

    const manager = new EventStreamManager(
      (instanceId) => ({ url: `http://${instanceId}.test/`, headers: { authorization: 'Bearer t' } }),
      { onEvent: (event) => events.push(event), onStatus: (status) => statuses.push([status.instanceId, status.connected]) },
      fetchImpl
    );
    manager.sync(['a']);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(urls.sort()).toEqual(['http://a.test/api/event', 'http://a.test/api/notifications/stream']);
    expect(manager.isConnected('a')).toBe(true);
    expect(statuses).toContainEqual(['a', true]);
    expect(events.map((event) => event.type).sort()).toEqual(['openchamber:session-activity', 'session.execution.started']);
    manager.stopAll();
    expect(manager.isConnected('a')).toBe(false);
  });

  test('a hung connect is aborted by the connect deadline and retried', async () => {
    let calls = 0;
    const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      // Never answers, like a blackholed tunnel; honours AbortSignal like undici.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    }) as typeof fetch;
    const statuses: boolean[] = [];
    const manager = new EventStreamManager(
      () => ({ url: 'http://c.test', headers: {} }),
      { onEvent: () => {}, onStatus: (status) => statuses.push(status.connected) },
      fetchImpl,
      { connectMs: 20, stallMs: 60_000, reconnectBaseMs: 5 }
    );
    manager.sync(['c']);
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(manager.isConnected('c')).toBe(false);
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(statuses.every((connected) => connected === false)).toBe(true);
    manager.stopAll();
  });

  test('restartAll drops the live socket and reconnects without waiting for the stall timer', async () => {
    let calls = 0;
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      return streamResponse(['data: {"type":"openchamber:session-activity","properties":{"sessionId":"s1"}}\n\n'], init?.signal ?? undefined);
    }) as typeof fetch;
    const manager = new EventStreamManager(
      () => ({ url: 'http://d.test', headers: {} }),
      { onEvent: () => {}, onStatus: () => {} },
      fetchImpl,
      { connectMs: 60_000, stallMs: 60_000, reconnectBaseMs: 5 }
    );
    manager.sync(['d']);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(manager.isConnected('d')).toBe(true);
    const connectedCalls = calls;
    manager.restartAll();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(calls).toBeGreaterThan(connectedCalls);
    expect(manager.isConnected('d')).toBe(true);
    manager.stopAll();
  });

  test('a failed connect is not "live" and gets retried', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response('nope', { status: 503 });
    }) as typeof fetch;
    const statuses: boolean[] = [];
    const manager = new EventStreamManager(
      () => ({ url: 'http://b.test', headers: {} }),
      { onEvent: () => {}, onStatus: (status) => statuses.push(status.connected) },
      fetchImpl
    );
    manager.sync(['b']);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(manager.isConnected('b')).toBe(false);
    expect(statuses.every((connected) => connected === false)).toBe(true);
    expect(calls).toBeGreaterThanOrEqual(2);
    manager.stopAll();
  });
});
