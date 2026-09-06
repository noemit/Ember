import { describe, expect, test } from 'bun:test';
import {
  createClientMessageId,
  createSession,
  enqueueMessage,
  errorMessageOf,
  loadAllMessageQueues,
  loadAllPermissions,
  loadAllQuestions,
  loadAllSessions,
  loadMessages,
  loadModels,
  loadProjects,
  loadQuestions,
  loadSessionPreview,
  loadSessions,
  loadScheduledIdentityData,
  mergePolledSessions,
  reconcilePolledMessages,
  removeQueuedMessage,
  replyPermission,
  replyQuestion,
  sendPrompt,
} from './src/api';
import { shouldOfferSessionReload } from './src/components/ChatView';
import { isAssistantTurnEnd } from './src/components/Transcript';
import type { ChatMessage, ModelOption } from './src/types';

const setRequest = (
  request: (instanceId: string, method: string, path: string, body?: unknown) => Promise<unknown>
) => {
  (globalThis as { window?: unknown }).window = { ember: { request } };
};

const userMessage = (id: string, text: string): ChatMessage => ({
  id,
  role: 'user',
  text,
  parts: [{ type: 'text', id: `${id}-text`, text }],
  completed: true,
});

const assistantMessage = (id: string): ChatMessage => ({
  id,
  role: 'assistant',
  text: '',
  parts: [],
  completed: true,
});

const queueModel: ModelOption = {
  providerID: 'anthropic',
  modelID: 'claude-sonnet',
  label: 'Anthropic / Claude Sonnet',
  details: {
    name: 'Claude Sonnet',
    providerName: 'Anthropic',
    reasoning: true,
    toolcall: true,
    attachment: true,
    inputs: ['text'],
    variants: ['low', 'high'],
  },
};

describe('session loading', () => {
  test('omits failed instances so existing state is preserved', async () => {
    setRequest(async () => ({ ok: false, status: 503, data: null }));
    expect(await loadAllSessions(['offline'])).toEqual({});
  });

  test('preserves a newly created or selected session missing from a stale poll', () => {
    const created = { id: 'new', instanceId: 'local', directory: '/workspace/project', updated: 200 };
    const existing = { id: 'old', instanceId: 'local', updated: 100 };
    const current = { local: [created, existing] };
    const stalePoll = { local: [existing] };

    expect(mergePolledSessions(current, stalePoll, [created])).toEqual({
      local: [created, existing],
    });
    expect(mergePolledSessions(current, { local: [created, existing] }, [created])).toEqual({
      local: [created, existing],
    });
    expect(mergePolledSessions(current, stalePoll, [])).toEqual(stalePoll);
  });

  test('paginates from the last raw record even when subagents are filtered', async () => {
    const paths: string[] = [];
    const firstPage = [
      { id: 'top', time: { updated: 1000 } },
      ...Array.from({ length: 199 }, (_, index) => ({
        id: `child-${index}`,
        parentID: 'top',
        time: { updated: 999 - index },
      })),
    ];
    setRequest(async (_instanceId, _method, path) => {
      paths.push(path);
      return paths.length === 1
        ? { ok: true, status: 200, data: firstPage }
        : { ok: true, status: 200, data: [{ id: 'older', time: { updated: 700 } }] };
    });

    expect((await loadSessions('local'))?.map((session) => session.id)).toEqual(['top', 'older']);
    expect(paths[1]).toContain('cursor=801');
  });

  test('distinguishes a failed preview from a successful empty preview', async () => {
    setRequest(async () => ({ ok: false, status: 503, data: null }));
    expect(await loadSessionPreview('local', 'session')).toBeNull();

    setRequest(async () => ({ ok: true, status: 200, data: [] }));
    expect(await loadSessionPreview('local', 'session')).toBe('');
  });

  test('normalizes model and timing metadata for user and assistant messages', async () => {
    setRequest(async () => ({
      ok: true,
      status: 200,
      data: [
        {
          info: {
            id: 'user',
            role: 'user',
            model: { providerID: 'openai', modelID: 'gpt-5' },
            time: { created: 100 },
          },
          parts: [{ id: 'user-text', type: 'text', text: 'Hello' }],
        },
        {
          info: {
            id: 'assistant',
            role: 'assistant',
            providerID: 'anthropic',
            modelID: 'claude-opus',
            time: { created: 200, completed: 1450 },
          },
          parts: [{ id: 'assistant-text', type: 'text', text: 'Hi' }],
        },
      ],
    }));

    const messages = await loadMessages('local', 'session');
    expect(messages[0]).toMatchObject({
      model: { providerID: 'openai', modelID: 'gpt-5' },
      createdAt: 100,
      completedAt: undefined,
    });
    expect(messages[1]).toMatchObject({
      model: { providerID: 'anthropic', modelID: 'claude-opus' },
      createdAt: 200,
      completedAt: 1450,
    });
  });

  test('keeps partless assistant errors in the transcript', async () => {
    setRequest(async () => ({
      ok: true,
      status: 200,
      data: [{
        info: {
          id: 'assistant-error',
          role: 'assistant',
          providerID: 'moonshotai',
          modelID: 'kimi-k2',
          time: { created: 200, completed: 240 },
          error: {
            name: 'APIError',
            data: { message: 'Invalid request Error', statusCode: 400 },
          },
        },
        parts: [],
      }],
    }));

    expect(await loadMessages('local', 'session')).toEqual([
      expect.objectContaining({
        id: 'assistant-error',
        error: 'Invalid request Error',
        completed: true,
      }),
    ]);
  });
});

describe('session reload visibility', () => {
  const now = 1_000_000;
  const staleAssistant = [{ ...assistantMessage('assistant'), createdAt: now - 11 * 60_000 }];

  test('offers reload only for stale active sessions or failed message loads', () => {
    expect(shouldOfferSessionReload('active', 'ready', undefined, staleAssistant, now)).toBe(true);
    expect(shouldOfferSessionReload('active', 'ready', now - 60_000, [], now)).toBe(false);
    expect(shouldOfferSessionReload('idle', 'ready', undefined, staleAssistant, now)).toBe(false);
    expect(shouldOfferSessionReload('idle', 'error', now, [], now)).toBe(true);
  });
});

describe('project loading', () => {
  test('deduplicates project paths used as select values', async () => {
    setRequest(async () => ({
      ok: true,
      status: 200,
      data: {
        projects: [
          { id: 'first', name: 'First', path: '/workspace/ember' },
          { id: 'duplicate', name: 'Duplicate', path: '/workspace/ember' },
          { id: 'other', name: 'Other', path: '/workspace/other' },
        ],
      },
    }));

    expect(await loadProjects('local')).toEqual([
      { id: 'first', name: 'First', path: '/workspace/ember' },
      { id: 'other', name: 'Other', path: '/workspace/other' },
    ]);
  });
});

describe('permission loading', () => {
  test('merges global and directory-scoped pending requests without duplicates', async () => {
    const paths: string[] = [];
    const request = {
      id: 'per_1',
      sessionID: 'ses_1',
      permission: 'bash',
      patterns: ['bun test'],
      metadata: {},
    };
    setRequest(async (_instanceId, _method, path) => {
      paths.push(path);
      return {
        ok: true,
        status: 200,
        data: path === '/api/permission' ? [request] : { data: [request] },
      };
    });

    const result = await loadAllPermissions(['local'], { local: ['/workspace/ember'] });
    expect(result.local).toEqual([
      expect.objectContaining({
        id: 'per_1',
        sessionId: 'ses_1',
        directory: '/workspace/ember',
      }),
    ]);
    expect(paths).toEqual(['/api/permission', '/api/permission?directory=%2Fworkspace%2Fember']);
  });

  test('routes replies through the directory that produced the request', async () => {
    let requestPath = '';
    let requestBody: unknown;
    setRequest(async (_instanceId, _method, path, body) => {
      requestPath = path;
      requestBody = body;
      return { ok: true, status: 200, data: true };
    });

    expect(await replyPermission({
      id: 'per_1',
      instanceId: 'local',
      sessionId: 'ses_1',
      directory: '/workspace/ember',
      permission: 'bash',
      patterns: [],
      metadata: {},
    }, 'once')).toBe(true);
    expect(requestPath).toBe('/api/permission/per_1/reply?directory=%2Fworkspace%2Fember');
    expect(requestBody).toEqual({ reply: 'once' });
  });
});

describe('session creation and model metadata', () => {
  test('creates sessions with directory only in the query string', async () => {
    let requestPath = '';
    let requestBody: unknown;
    setRequest(async (_instanceId, _method, path, body) => {
      requestPath = path;
      requestBody = body;
      return {
        ok: true,
        status: 200,
        data: { id: 'ses_new', directory: '/workspace/ember', time: { updated: 100 } },
      };
    });

    expect((await createSession('local', '/workspace/ember'))?.id).toBe('ses_new');
    expect(requestPath).toBe('/api/session?directory=%2Fworkspace%2Fember');
    expect(requestBody).toEqual({});
  });

  test('resolves provider-map defaults and reasoning variants', async () => {
    setRequest(async () => ({
      ok: true,
      status: 200,
      data: {
        all: [{
          id: 'anthropic',
          name: 'Anthropic',
          models: {
            'claude-sonnet': {
              id: 'claude-sonnet',
              name: 'Claude Sonnet',
              capabilities: { reasoning: true, toolcall: true, attachment: true, input: { text: true } },
              variants: { low: {}, high: {} },
            },
          },
        }],
        connected: ['anthropic'],
        default: { anthropic: 'claude-sonnet' },
      },
    }));

    const list = await loadModels('local');
    expect(list.defaultModelId).toBe('anthropic/claude-sonnet');
    expect(list.models[0].details.variants).toEqual(['low', 'high']);
  });
});

describe('scheduled task identity', () => {
  test('binds the latest scheduled session to its stable project task key', async () => {
    setRequest(async (_instanceId, _method, path) =>
      path.includes('supported')
        ? {
            ok: true,
            status: 200,
            data: {
              tasks: [{
                id: 'daily-review',
                name: 'Daily review',
                state: { lastSessionId: 'ses_latest' },
              }],
            },
          }
        : { ok: false, status: 404, data: null }
    );

    const result = await loadScheduledIdentityData('local', [
      { id: 'supported', name: 'Supported', path: '/workspace/one' },
      { id: 'legacy', name: 'Legacy', path: '/workspace/two' },
    ]);
    expect(result.bindings).toEqual({
      'local::ses_latest': 'task:local::supported::daily-review',
    });
    expect(result.taskNames).toEqual({
      'task:local::supported::daily-review': 'Daily review',
    });
  });

  test('falls back cleanly when scheduled-task routes are unavailable', async () => {
    setRequest(async () => ({ ok: false, status: 404, data: null }));
    expect(await loadScheduledIdentityData('legacy', [
      { id: 'project', name: 'Project', path: '/workspace/project' },
    ])).toEqual({ bindings: {}, taskNames: {} });
  });
});

describe('question loading', () => {
  test('loads questions from the selected session directory', async () => {
    const paths: string[] = [];
    setRequest(async (_instanceId, _method, path) => {
      paths.push(path);
      return {
        ok: true,
        status: 200,
        data: path === '/api/question?directory=%2Fworkspace%2Fember'
          ? [{
              id: 'que_1',
              sessionID: 'ses_1',
              questions: [{
                header: 'Theme',
                question: 'Which theme?',
                options: [{ label: 'Dark', description: 'Use dark mode.' }],
              }],
            }]
          : [],
      };
    });

    expect(await loadQuestions('local', '/workspace/ember')).toHaveLength(1);
    expect(paths).toContain('/api/question?directory=%2Fworkspace%2Fember');
  });

  test('merges default and directory-scoped questions without duplicates', async () => {
    const paths: string[] = [];
    const question = {
      id: 'que_1',
      sessionID: 'ses_1',
      questions: [{
        header: 'Theme',
        question: 'Which theme?',
        options: [{ label: 'Dark', description: 'Use dark mode.' }],
      }],
    };
    setRequest(async (_instanceId, _method, path) => {
      paths.push(path);
      return {
        ok: true,
        status: 200,
        data: path === '/api/question' ? [question] : { data: [question] },
      };
    });

    const result = await loadAllQuestions(['local'], {
      local: ['/workspace/ember', '/workspace/ember'],
    });
    expect(result.local).toEqual([
      expect.objectContaining({
        id: 'que_1',
        sessionId: 'ses_1',
        directory: '/workspace/ember',
      }),
    ]);
    expect(paths).toEqual(['/api/question', '/api/question?directory=%2Fworkspace%2Fember']);
  });

  test('routes question replies through the directory that produced the request', async () => {
    let requestPath = '';
    let requestBody: unknown;
    setRequest(async (_instanceId, _method, path, body) => {
      requestPath = path;
      requestBody = body;
      return { ok: true, status: 200, data: true };
    });

    expect(await replyQuestion({
      id: 'que_1',
      instanceId: 'local',
      sessionId: 'ses_1',
      directory: '/workspace/ember',
      questions: [{
        header: 'Theme',
        question: 'Which theme?',
        options: [],
      }],
    }, [['Dark']])).toBe(true);
    expect(requestPath).toBe('/api/question/que_1/reply?directory=%2Fworkspace%2Fember');
    expect(requestBody).toEqual({ answers: [['Dark']] });
  });
});

describe('message queue', () => {
  test('loads queued sessions and skips malformed items', async () => {
    setRequest(async (_instanceId, _method, path) => {
      expect(path).toBe('/api/message-queue');
      return {
        ok: true,
        status: 200,
        data: {
          revision: 7,
          sessions: [{
            sessionId: 'ses_1',
            directory: '/workspace/ember',
            sendingId: null,
            items: [{
              id: 'queued-1',
              createdAt: 100,
              content: 'Follow up',
              text: 'Follow up',
              attachments: [],
              sendConfig: { providerID: 'anthropic', modelID: 'claude-sonnet', variant: 'high' },
            }, { id: 'broken' }],
          }],
        },
      };
    });

    expect(await loadAllMessageQueues(['local'])).toEqual({
      local: [
        expect.objectContaining({
          sessionId: 'ses_1',
          directory: '/workspace/ember',
          sendingId: null,
          items: [
            expect.objectContaining({
              id: 'queued-1',
              text: 'Follow up',
              sendConfig: expect.objectContaining({ variant: 'high' }),
            }),
          ],
        }),
      ],
    });
  });

  test('enqueues the composer payload in OpenChamber queue format', async () => {
    let requestPath = '';
    let requestBody: unknown;
    setRequest(async (_instanceId, _method, path, body) => {
      requestPath = path;
      requestBody = body;
      return {
        ok: true,
        status: 200,
        data: {
          revision: 8,
          itemId: 'queued-1',
          session: {
            sessionId: 'ses_1',
            directory: '/workspace/ember',
            sendingId: null,
            items: [{
              id: 'queued-1',
              createdAt: 100,
              content: 'Run the tests',
              text: 'Run the tests',
              attachments: [],
              sendConfig: { providerID: 'anthropic', modelID: 'claude-sonnet' },
            }],
          },
        },
      };
    });

    const response = await enqueueMessage('local', 'ses_1', '/workspace/ember', {
      text: 'Run the tests',
      model: queueModel,
      mode: 'build',
      variant: 'high',
      attachments: [{ filename: 'log.txt', mime: 'text/plain', url: 'data:text/plain;base64,bG9n' }],
      replyContext: 'Earlier context',
    });

    expect(response.ok).toBe(true);
    expect(response.data?.itemId).toBe('queued-1');
    expect(requestPath).toBe('/api/message-queue/sessions/ses_1/items');
    expect(requestBody).toEqual({
      directory: '/workspace/ember',
      item: {
        content: 'Run the tests',
        text: 'Run the tests',
        attachments: [{
          id: 'attachment-0',
          filename: 'log.txt',
          mimeType: 'text/plain',
          source: 'local',
          dataUrl: 'data:text/plain;base64,bG9n',
        }],
        context: [{
          kind: 'synthetic',
          text: 'Earlier pinned message being replied to:\n\nEarlier context',
        }],
        sendConfig: {
          providerID: 'anthropic',
          modelID: 'claude-sonnet',
          agent: 'build',
          variant: 'high',
        },
      },
    });
  });

  test('removes a queued message through the server queue endpoint', async () => {
    let requestMethod = '';
    let requestPath = '';
    setRequest(async (_instanceId, method, path) => {
      requestMethod = method;
      requestPath = path;
      return {
        ok: true,
        status: 200,
        data: {
          revision: 9,
          session: {
            sessionId: 'ses_1',
            directory: '/workspace/ember',
            sendingId: null,
            items: [],
          },
        },
      };
    });

    const response = await removeQueuedMessage('local', 'ses_1', 'queued-1');
    expect(response.ok).toBe(true);
    expect(response.data?.session.items).toEqual([]);
    expect(requestMethod).toBe('DELETE');
    expect(requestPath).toBe('/api/message-queue/sessions/ses_1/items/queued-1');
  });
});

describe('transcript metadata', () => {
  test('marks only the final assistant record in each completed turn', () => {
    const messages = [
      userMessage('user-1', 'Start'),
      assistantMessage('tool-1'),
      assistantMessage('tool-2'),
      assistantMessage('answer-1'),
      userMessage('user-2', 'Continue'),
      assistantMessage('tool-3'),
    ];

    expect(messages.map((_, index) => isAssistantTurnEnd(messages, index, true))).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(isAssistantTurnEnd(messages, messages.length - 1, false)).toBe(true);
  });
});

describe('message submission', () => {
  test('extracts synchronous invalid-request messages from common API error shapes', () => {
    expect(errorMessageOf({ message: 'Invalid request Error' })).toBe('Invalid request Error');
    expect(errorMessageOf({ error: { data: { message: 'Model is unavailable' } } })).toBe(
      'Model is unavailable'
    );
  });

  test('uses a valid client message id to correlate the optimistic and server messages', async () => {
    let requestBody: unknown;
    setRequest(async (_instanceId, _method, _path, body) => {
      requestBody = body;
      return { ok: true, status: 204, data: null };
    });
    const messageId = createClientMessageId(1_750_000_000_000);

    expect(messageId).toMatch(/^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/);
    await sendPrompt('local', 'session', { text: 'Hello', variant: 'high' }, undefined, messageId);
    expect(requestBody).toMatchObject({ messageID: messageId, variant: 'high' });
  });

  test('replaces an optimistic message when the poll returns its server copy', () => {
    const previous = userMessage('msg_previous', 'Earlier');
    const optimistic = userMessage('msg_optimistic', 'Hello');
    const server = userMessage('msg_optimistic', 'Hello');

    expect(
      reconcilePolledMessages(
        [previous, optimistic],
        [previous, server],
        new Set([optimistic.id])
      )
    ).toEqual([previous, server]);
  });

  test('matches a new legacy server id without consuming an older identical message', () => {
    const previous = userMessage('msg_previous', 'Hello');
    const optimistic = userMessage('msg_optimistic', 'Hello');
    const server = userMessage('msg_server', 'Hello');
    const pending = new Set([optimistic.id]);

    expect(reconcilePolledMessages([previous, optimistic], [previous], pending)).toEqual([
      previous,
      optimistic,
    ]);
    expect(reconcilePolledMessages([previous, optimistic], [previous, server], pending)).toEqual([
      previous,
      server,
    ]);
  });
});
