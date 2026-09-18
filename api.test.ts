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
  loadAutoAcceptPolicy,
  loadMessages,
  loadMessageTail,
  loadModels,
  loadProjects,
  loadQuestions,
  loadSessions,
  loadScheduledIdentityData,
  mergePolledSessions,
  removeQueuedMessage,
  reorderQueuedMessages,
  replyPermission,
  replyQuestion,
  runScheduledTask,
  sendPrompt,
  setAutoAccept,
  takeQueuedMessage,
  updateScheduledTaskModel,
} from './src/api';
import type { ScheduledTask } from './src/api';
import { shouldOfferSessionReload } from './src/components/ChatView';
import { cacheSummary, formatCost, isAssistantTurnEnd, relativeTimeAgo, tokensPerSecond } from './src/components/Transcript';
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

  test('keeps the locally newer copy when a poll returns a stale session', () => {
    const local = { id: 'a', instanceId: 'local', updated: 500, model: { providerID: 'p', modelID: 'm' } };
    const stale = { id: 'a', instanceId: 'local', updated: 100 };
    const other = { id: 'b', instanceId: 'local', updated: 50 };

    // The poll decides which sessions exist and in what order; the newer local copy wins per id.
    expect(mergePolledSessions({ local: [local] }, { local: [stale, other] }, [])).toEqual({
      local: [local, other],
    });
    // A poll that has caught up replaces the local copy.
    const fresher = { id: 'a', instanceId: 'local', updated: 900 };
    expect(mergePolledSessions({ local: [local] }, { local: [fresher] }, [])).toEqual({ local: [fresher] });
    // Instances absent from the poll are untouched.
    expect(mergePolledSessions({ local: [local], remote: [other] }, { local: [local] }, [])).toEqual({
      local: [local],
      remote: [other],
    });
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

  test('partial page refreshes preserve older sessions', async () => {
    setRequest(async () => ({ ok: true, status: 200, data: Array.from({ length: 200 }, (_, index) => ({ id: `new-${index}`, time: { updated: 1000 - index } })) }));
    const partial = await loadAllSessions(['local'], {}, 1);
    const old = { id: 'older', instanceId: 'local', updated: 1 };
    const merged = mergePolledSessions({ local: [old] }, partial, []);
    expect(merged.local).toHaveLength(201);
    expect(merged.local.find((session) => session.id === 'older')).toBe(old);
  });

  test('distinguishes a failed message load from a successful empty transcript', async () => {
    setRequest(async () => ({ ok: false, status: 503, data: null }));
    await expect(loadMessages('local', 'session')).rejects.toThrow();

    setRequest(async () => ({ ok: true, status: 200, data: [] }));
    expect(await loadMessages('local', 'session')).toEqual([]);
  });

  test('full loads send no limit; tail loads encode directory and limit', async () => {
    const paths: string[] = [];
    setRequest(async (_instanceId, _method, path) => {
      paths.push(path);
      return { ok: true, status: 200, data: [] };
    });

    await loadMessages('local', 'session', '/workspace/ember');
    await loadMessageTail('local', 'session', '/workspace/ember', 8);
    await loadMessageTail('local', 'session');

    expect(paths[0]).toBe('/api/session/session/message?directory=%2Fworkspace%2Fember');
    expect(paths[1]).toBe('/api/session/session/message?directory=%2Fworkspace%2Fember&limit=8');
    expect(paths[2]).toBe('/api/session/session/message?limit=8');
  });

  test('tail loads slice to the latest limit and normalize identically to full loads', async () => {
    const record = (id: string, text: string) => ({
      info: { id, role: 'user', time: { created: 1 }, model: { providerID: 'p', modelID: 'm' } },
      parts: [{ id: `${id}-text`, type: 'text', text }],
    });
    const data = [record('m1', 'one'), record('m2', 'two'), record('m3', 'three')];
    setRequest(async () => ({ ok: true, status: 200, data }));

    expect(await loadMessages('local', 'session')).toEqual(
      await loadMessageTail('local', 'session', undefined, 3)
    );
    // A server that ignores `limit` still yields a bounded tail.
    expect((await loadMessageTail('local', 'session', undefined, 2)).map((m) => m.id)).toEqual(['m2', 'm3']);
  });

  test('distinguishes an empty tail success from a request failure', async () => {
    setRequest(async () => ({ ok: true, status: 200, data: [] }));
    expect(await loadMessageTail('local', 'session')).toEqual([]);

    setRequest(async () => ({ ok: false, status: 503, data: null }));
    await expect(loadMessageTail('local', 'session')).rejects.toThrow();
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

  test('reads prompt-cache token usage and treats missing usage as unknown', async () => {
    setRequest(async () => ({
      ok: true,
      status: 200,
      data: [
        {
          info: {
            id: 'cached',
            role: 'assistant',
            time: { created: 1, completed: 2 },
            tokens: { total: 10644, input: 1483, output: 201, reasoning: 0, cache: { read: 8960, write: 0 } },
          },
          parts: [{ id: 'p', type: 'text', text: 'ok' }],
        },
        {
          info: { id: 'unknown', role: 'assistant', time: { created: 3, completed: 4 } },
          parts: [{ id: 'q', type: 'text', text: 'ok' }],
        },
        {
          info: { id: 'zeros', role: 'assistant', time: { created: 5, completed: 6 }, tokens: { input: 0, output: 0 } },
          parts: [{ id: 'r', type: 'text', text: 'ok' }],
        },
      ],
    }));

    const [cached, unknown, zeros] = await loadMessages('local', 'session');
    expect(cached.tokens).toEqual({ input: 1483, output: 201, cacheRead: 8960, cacheWrite: 0 });
    expect(cacheSummary(cached.tokens)).toBe('86% cached');
    expect(unknown.tokens).toBeUndefined();
    expect(zeros.tokens).toBeUndefined();
    expect(cacheSummary({ input: 500, output: 10, cacheRead: 0, cacheWrite: 12_400 })).toBe('cache written 12k');
    expect(cacheSummary({ input: 500, output: 10, cacheRead: 0, cacheWrite: 0 })).toBeNull();
  });

  test('computes output tokens/second and formats per-turn cost', () => {
    const base: ChatMessage = {
      id: 'm',
      role: 'assistant',
      text: '',
      parts: [],
      completed: true,
      tokens: { input: 10, output: 100, cacheRead: 0, cacheWrite: 0 },
      createdAt: 1000,
      completedAt: 3000,
    };
    expect(tokensPerSecond(base)).toBeCloseTo(50);
    expect(tokensPerSecond({ ...base, completedAt: 1000 })).toBeNull();
    expect(tokensPerSecond({ ...base, tokens: undefined })).toBeNull();
    expect(formatCost(0.0123)).toBe('$0.0123');
    expect(formatCost(0.5)).toBe('$0.500');
    expect(formatCost(2.5)).toBe('$2.50');
    expect(formatCost(0)).toBe('$0');
    const now = 10_000_000;
    expect(relativeTimeAgo(now - 10_000, now)).toBe('just now');
    expect(relativeTimeAgo(now - 600_000, now)).toBe('10 min ago');
    expect(relativeTimeAgo(now - 3_600_000, now)).toBe('1 hour ago');
    expect(relativeTimeAgo(now - 7_200_000, now)).toBe('2 hours ago');
    expect(relativeTimeAgo(now - 2 * 86_400_000, now)).toBe('2 days ago');
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
        aborted: false,
        completed: true,
      }),
    ]);
  });

  test('marks a user-initiated stop as aborted so it is not shown as a failure', async () => {
    setRequest(async () => ({
      ok: true,
      status: 200,
      data: [
        {
          info: {
            id: 'stopped',
            role: 'assistant',
            time: { created: 200 },
            error: { name: 'MessageAbortedError', data: { message: 'The running turn was interrupted.' } },
          },
          parts: [],
        },
        {
          info: {
            id: 'failed',
            role: 'assistant',
            time: { created: 300 },
            error: { name: 'ProviderAuthError', data: { message: 'Invalid API key' } },
          },
          parts: [],
        },
      ],
    }));

    const messages = await loadMessages('local', 'session');
    expect(messages[0]).toMatchObject({ id: 'stopped', aborted: true });
    expect(messages[1]).toMatchObject({ id: 'failed', aborted: false });
  });
});

describe('permission auto-accept (YOLO mode)', () => {
  test('reads the server policy and distinguishes an unsupported instance from a failure', async () => {
    setRequest(async () => ({
      ok: true,
      status: 200,
      data: { sessions: { a: true, b: false, c: 'yes' }, revision: 3 },
    }));
    expect(await loadAutoAcceptPolicy('local')).toEqual({ supported: true, sessions: { a: true, b: false } });

    setRequest(async () => ({ ok: false, status: 404, data: null }));
    expect(await loadAutoAcceptPolicy('old')).toEqual({ supported: false, sessions: {} });

    setRequest(async () => ({ ok: false, status: 503, data: null }));
    expect(await loadAutoAcceptPolicy('down')).toBeNull();
  });

  test('sends the session policy with its directory', async () => {
    const calls: Array<[string, string, unknown]> = [];
    setRequest(async (_instance, method, path, body) => {
      calls.push([method, path, body]);
      return { ok: true, status: 200, data: { sessions: { 'ses 1': true }, revision: 4 } };
    });
    expect(await setAutoAccept('local', 'ses 1', true, '/work')).toEqual({ ok: true, status: 200 });
    expect(calls).toEqual([
      ['PUT', '/api/permission-auto-accept/sessions/ses%201', { enabled: true, directory: '/work' }],
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

  test('reports failure as null rather than an empty project list', async () => {
    setRequest(async () => ({ ok: false, status: 502, data: null }));
    expect(await loadProjects('local')).toBeNull();
  });

  test('does not mistake an array body for a settings object', async () => {
    setRequest(async () => ({ ok: true, status: 200, data: [{ path: '/x' }] }));
    expect(await loadProjects('local')).toEqual([]);
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
    expect(list?.defaultModelId).toBe('anthropic/claude-sonnet');
    expect(list?.models[0].details.variants).toEqual(['low', 'high']);
  });

  test('reports a failed provider request as null so the picker keeps its models', async () => {
    setRequest(async () => ({ ok: false, status: 500, data: { error: 'boom' } }));
    expect(await loadModels('local')).toBeNull();
  });

  test('falls back to /config/providers when /provider yields no models', async () => {
    setRequest(async (_instanceId, _method, path) =>
      path === '/api/provider'
        ? { ok: true, status: 200, data: { all: [], connected: [] } }
        : {
            ok: true,
            status: 200,
            data: {
              providers: [
                { id: 'deepseek', name: 'DeepSeek', models: { 'deepseek-v4': { id: 'deepseek-v4', name: 'DeepSeek V4' } } },
              ],
            },
          }
    );
    const list = await loadModels('local');
    expect(list?.models[0]?.providerID).toBe('deepseek');
    expect(list?.models[0]?.modelID).toBe('deepseek-v4');
  });

  test('parses providers and models whether they arrive as arrays or id maps', async () => {
    // Providers as an id map, each provider's models as an array.
    setRequest(async () => ({
      ok: true,
      status: 200,
      data: {
        all: {
          anthropic: { name: 'Anthropic', models: [{ id: 'claude-sonnet', name: 'Claude Sonnet' }] },
        },
        connected: ['anthropic'],
      },
    }));
    expect((await loadModels('local'))?.models[0]).toMatchObject({
      providerID: 'anthropic',
      modelID: 'claude-sonnet',
    });

    // Providers as an array, each provider's models as an id map with no explicit id.
    setRequest(async () => ({
      ok: true,
      status: 200,
      data: { providers: [{ id: 'openai', name: 'OpenAI', models: { 'gpt-5': { name: 'GPT-5' } } }] },
    }));
    expect((await loadModels('local'))?.models[0]).toMatchObject({
      providerID: 'openai',
      modelID: 'gpt-5',
    });
  });
});

describe('scheduled task identity', () => {
  const makeScheduledTask = (): ScheduledTask => ({
    key: 'task:local::project-1::daily-review',
    instanceId: 'local',
    projectId: 'project-1',
    projectName: 'Project One',
    id: 'daily-review',
    name: 'Daily review',
    enabled: true,
    model: { providerID: 'anthropic', modelID: 'claude-sonnet' },
    state: { lastSessionId: 'ses_latest' },
    raw: {
      id: 'daily-review',
      name: 'Daily review',
      enabled: true,
      schedule: { kind: 'daily', times: ['09:00'] },
      execution: { prompt: 'Review the day', providerID: 'anthropic', modelID: 'claude-sonnet', agent: 'build' },
      state: { lastSessionId: 'ses_latest' },
    },
  });

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
                enabled: true,
                execution: { prompt: 'Review the day', providerID: 'anthropic', modelID: 'claude-sonnet' },
                state: { lastSessionId: 'ses_latest', lastStatus: 'error', lastError: 'timed out' },
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
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      key: 'task:local::supported::daily-review',
      instanceId: 'local',
      projectId: 'supported',
      projectName: 'Supported',
      id: 'daily-review',
      name: 'Daily review',
      enabled: true,
      model: { providerID: 'anthropic', modelID: 'claude-sonnet' },
      state: { lastSessionId: 'ses_latest', lastStatus: 'error', lastError: 'timed out' },
    });
  });

  test('falls back cleanly when scheduled-task routes are unavailable', async () => {
    setRequest(async () => ({ ok: false, status: 404, data: null }));
    expect(await loadScheduledIdentityData('legacy', [
      { id: 'project', name: 'Project', path: '/workspace/project' },
    ])).toEqual({ bindings: {}, taskNames: {}, tasks: [] });
  });

  test('runs a task and reports the created session', async () => {
    const calls: Array<{ method: string; path: string }> = [];
    setRequest(async (_instanceId, method, path) => {
      calls.push({ method, path });
      return { ok: true, status: 200, data: { ok: true, sessionId: 'ses_new' } };
    });
    const task = makeScheduledTask();
    expect(await runScheduledTask('local', task)).toEqual({ ok: true, sessionId: 'ses_new' });
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/api/projects/project-1/scheduled-tasks/daily-review/run',
      },
    ]);
  });

  test('surfaces the server error when a run is rejected', async () => {
    setRequest(async () => ({ ok: false, status: 409, data: { error: 'Task already running' } }));
    const result = await runScheduledTask('local', makeScheduledTask());
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Task already running');
  });

  test('updates only execution model when saving a new model', async () => {
    let sent: { task?: Record<string, unknown> } | undefined;
    setRequest(async (_instanceId, method, path, body) => {
      if (method !== 'PUT') return { ok: false, status: 404, data: null };
      sent = body as { task?: Record<string, unknown> };
      return {
        ok: true,
        status: 200,
        data: { task: { ...(sent?.task ?? {}), id: 'daily-review', name: 'Daily review' } },
      };
    });
    const task = makeScheduledTask();
    const result = await updateScheduledTaskModel('local', task, {
      providerID: 'openai',
      modelID: 'gpt-5',
      variant: 'high',
    });
    expect(result.ok).toBe(true);
    expect(sent?.task).toMatchObject({
      id: 'daily-review',
      name: 'Daily review',
      schedule: { kind: 'daily', times: ['09:00'] },
      execution: {
        prompt: 'Review the day',
        providerID: 'openai',
        modelID: 'gpt-5',
        agent: 'build',
        variant: 'high',
      },
    });
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

  test('preserves taken context and agent mentions when requeueing', async () => {
    let requestBody: unknown;
    setRequest(async (_instanceId, _method, _path, body) => {
      requestBody = body;
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

    await enqueueMessage('local', 'ses_1', '/workspace/ember', {
      text: 'Steer this',
      model: queueModel,
      queuedContext: [{ kind: 'context', text: 'Diff context', instructions: 'Read this first' }],
      agentMention: 'reviewer',
    });

    expect(requestBody).toMatchObject({
      item: {
        context: [{ kind: 'context', text: 'Diff context', instructions: 'Read this first' }],
        agentMention: 'reviewer',
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

  test('takes a queued message back with its full send payload', async () => {
    let requestMethod = '';
    let requestPath = '';
    setRequest(async (_instanceId, method, path) => {
      requestMethod = method;
      requestPath = path;
      return {
        ok: true,
        status: 200,
        data: {
          revision: 10,
          session: {
            sessionId: 'ses_1',
            directory: '/workspace/ember',
            sendingId: null,
            items: [],
          },
          item: {
            id: 'queued-1',
            createdAt: 100,
            content: 'Steer this',
            text: 'Steer this',
            attachments: [{
              filename: 'log.txt',
              mimeType: 'text/plain',
              dataUrl: 'data:text/plain;base64,bG9n',
            }],
            context: [{
              kind: 'context',
              text: 'Diff context',
              metadata: { source: 'pin' },
              instructions: 'Read this first',
            }],
            sendConfig: { providerID: 'anthropic', modelID: 'claude-sonnet', agent: 'build', variant: 'high' },
            agentMention: 'reviewer',
          },
        },
      };
    });

    const response = await takeQueuedMessage('local', 'ses_1', 'queued-1');
    expect(response.ok).toBe(true);
    expect(requestMethod).toBe('POST');
    expect(requestPath).toBe('/api/message-queue/sessions/ses_1/items/queued-1/take');
    expect(response.data?.item).toEqual(expect.objectContaining({
      id: 'queued-1',
      text: 'Steer this',
      agentMention: 'reviewer',
      attachments: [expect.objectContaining({ dataUrl: 'data:text/plain;base64,bG9n' })],
      context: [expect.objectContaining({ kind: 'context', text: 'Diff context', instructions: 'Read this first' })],
      sendConfig: expect.objectContaining({ agent: 'build', variant: 'high' }),
    }));
  });

  test('reorders queued messages through the server queue endpoint', async () => {
    let requestMethod = '';
    let requestPath = '';
    let requestBody: unknown;
    setRequest(async (_instanceId, method, path, body) => {
      requestMethod = method;
      requestPath = path;
      requestBody = body;
      return {
        ok: true,
        status: 200,
        data: {
          revision: 11,
          session: {
            sessionId: 'ses_1',
            directory: '/workspace/ember',
            sendingId: null,
            items: [
              {
                id: 'queued-2',
                createdAt: 101,
                content: 'Second',
                text: 'Second',
                attachments: [],
                sendConfig: { providerID: 'anthropic', modelID: 'claude-sonnet' },
              },
              {
                id: 'queued-1',
                createdAt: 100,
                content: 'First',
                text: 'First',
                attachments: [],
                sendConfig: { providerID: 'anthropic', modelID: 'claude-sonnet' },
              },
            ],
          },
        },
      };
    });

    const response = await reorderQueuedMessages('local', 'ses_1', ['queued-2', 'queued-1']);
    expect(response.ok).toBe(true);
    expect(response.data?.session.items.map((item) => item.id)).toEqual(['queued-2', 'queued-1']);
    expect(requestMethod).toBe('PUT');
    expect(requestPath).toBe('/api/message-queue/sessions/ses_1/order');
    expect(requestBody).toEqual({ itemIds: ['queued-2', 'queued-1'] });
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

  test('reconstructs a taken queued message for immediate steering', async () => {
    let requestPath = '';
    let requestBody: unknown;
    setRequest(async (_instanceId, _method, path, body) => {
      requestPath = path;
      requestBody = body;
      return { ok: true, status: 204, data: null };
    });

    await sendPrompt('local', 'session', {
      text: 'Steer this',
      model: queueModel,
      mode: 'build',
      variant: 'high',
      attachments: [{ filename: 'log.txt', mime: 'text/plain', url: 'data:text/plain;base64,bG9n' }],
      queuedContext: [{
        kind: 'context',
        text: 'Diff context',
        metadata: { source: 'pin' },
        instructions: 'Read this first',
      }],
      agentMention: 'reviewer',
    }, '/workspace/ember', 'msg_123');

    expect(requestPath).toBe('/api/session/session/prompt_async?directory=%2Fworkspace%2Fember');
    expect(requestBody).toEqual({
      parts: [
        { type: 'text', text: 'Steer this' },
        { type: 'file', mime: 'text/plain', filename: 'log.txt', url: 'data:text/plain;base64,bG9n' },
        { type: 'text', text: 'Read this first', synthetic: true },
        { type: 'text', text: 'Diff context', synthetic: true, metadata: { source: 'pin' } },
        { type: 'agent', name: 'reviewer' },
      ],
      model: { providerID: 'anthropic', modelID: 'claude-sonnet' },
      agent: 'build',
      variant: 'high',
      messageID: 'msg_123',
    });
  });
});
