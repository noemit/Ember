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
  // Frames captured from a live OpenChamber 1.18 instance.
  const opencode = (payload: unknown) =>
    JSON.stringify({ directory: '/Users/me', project: 'global', payload });

  test('extracts session and directory from OpenCode events', () => {
    expect(
      parseEventData('local', 'opencode', opencode({
        id: 'evt_1',
        type: 'session.status',
        properties: { sessionID: 'ses_1', status: { type: 'busy' } },
      }))
    ).toEqual({ instanceId: 'local', stream: 'opencode', type: 'session.status', sessionId: 'ses_1', directory: '/Users/me' });

    expect(
      parseEventData('local', 'opencode', opencode({
        type: 'session.created',
        properties: { sessionID: 'ses_2', info: { id: 'ses_2', directory: '/Users/me/proj' } },
      }))
    ).toMatchObject({ type: 'session.created', sessionId: 'ses_2', directory: '/Users/me' });

    expect(
      parseEventData('local', 'opencode', opencode({
        type: 'message.part.updated',
        properties: { part: { id: 'prt_1', sessionID: 'ses_3', messageID: 'msg_1', type: 'text' } },
      }))
    ).toMatchObject({ type: 'message.part.updated', sessionId: 'ses_3' });
    expect(
      parseEventData('local', 'opencode', opencode({
        type: 'message.updated',
        properties: { info: { id: 'msg_1', sessionID: 'ses_4', role: 'assistant' } },
      }))
    ).toMatchObject({ type: 'message.updated', sessionId: 'ses_4' });
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
    expect(parseEventData('local', 'opencode', opencode({ type: 'server.connected', properties: {} }))).toBeNull();
    expect(parseEventData('local', 'opencode', opencode({ type: 'server.heartbeat' }))).toBeNull();
    expect(
      parseEventData('local', 'openchamber', JSON.stringify({ type: 'openchamber:notification-stream-ready', properties: { uiToken: 'secret' } }))
    ).toBeNull();
    expect(parseEventData('local', 'opencode', 'not json')).toBeNull();
    expect(parseEventData('local', 'opencode', '[]')).toBeNull();
  });
});

describe('stream manager', () => {
  const streamResponse = (frames: string[]) =>
    new Response(
      new ReadableStream({
        start(controller) {
          frames.forEach((frame) => controller.enqueue(new TextEncoder().encode(frame)));
          // Leave the stream open; the test stops the manager.
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
      if (url.endsWith('/api/global/event')) {
        return streamResponse([
          'data: {"payload":{"type":"server.connected","properties":{}}}\n\n',
          'data: {"directory":"/w","payload":{"type":"session.status","properties":{"sessionID":"s1","status":{"type":"busy"}}}}\n\n',
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

    expect(urls.sort()).toEqual(['http://a.test/api/global/event', 'http://a.test/api/notifications/stream']);
    expect(manager.isConnected('a')).toBe(true);
    expect(statuses).toContainEqual(['a', true]);
    expect(events.map((event) => event.type).sort()).toEqual(['openchamber:session-activity', 'session.status']);
    manager.stopAll();
    expect(manager.isConnected('a')).toBe(false);
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
