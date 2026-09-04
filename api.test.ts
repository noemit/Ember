import { describe, expect, test } from 'bun:test';
import {
  createClientMessageId,
  errorMessageOf,
  loadAllQuestions,
  loadAllSessions,
  loadMessages,
  loadProjects,
  loadQuestions,
  loadSessionPreview,
  loadSessions,
  loadScheduledIdentityData,
  reconcilePolledMessages,
  sendPrompt,
} from './src/api';
import { isAssistantTurnEnd } from './src/components/Transcript';
import type { ChatMessage } from './src/types';

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

describe('session loading', () => {
  test('omits failed instances so existing state is preserved', async () => {
    setRequest(async () => ({ ok: false, status: 503, data: null }));
    expect(await loadAllSessions(['offline'])).toEqual({});
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
    expect(result.local.map((request) => request.id)).toEqual(['que_1']);
    expect(paths).toEqual(['/api/question', '/api/question?directory=%2Fworkspace%2Fember']);
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
    await sendPrompt('local', 'session', { text: 'Hello' }, undefined, messageId);
    expect(requestBody).toMatchObject({ messageID: messageId });
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
