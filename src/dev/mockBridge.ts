/**
 * Dev-only stand-in for the Electron preload bridge so the renderer can run under
 * plain `vite` in a browser. Loaded from main.tsx only when `window.ember` is absent.
 */
import type { EmberBridge, EmberSettings } from '../types';

type MockSession = {
  id: string;
  title: string;
  directory: string;
  updated: number;
  status: string;
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
};

const minutes = (n: number) => Date.now() - n * 60_000;

const instances = [
  { id: 'local', label: 'MacBook', kind: 'local', url: 'http://127.0.0.1:3000', status: 'ready', attachable: true },
  { id: 'studio', label: 'Studio (ssh)', kind: 'ssh', url: 'http://127.0.0.1:3101', status: 'ready', attachable: true },
  { id: 'relay', label: 'Private relay', kind: 'relay', status: 'unsupported', attachable: false },
];

const sessions: Record<string, MockSession[]> = {
  local: [
    { id: 'ses_a1', title: 'Youtube Manager', directory: '/workspace/channels', updated: minutes(2), status: 'busy', messages: [
      { role: 'user', text: 'Manage YouTube for Noemi Titarenco at your discretion.' },
      { role: 'assistant', text: 'On it. Pulled the latest analytics; the LongCat video is trending above baseline.' },
    ] },
    { id: 'ses_a2', title: 'Habit QA', directory: '/workspace/habit', updated: minutes(14), status: 'idle', messages: [
      { role: 'user', text: 'QA for Habit.am, the guide flow.' },
      { role: 'assistant', text: 'Found two regressions in the onboarding checklist. Filing them now.' },
    ] },
    { id: 'ses_a3', title: 'Ember redesign', directory: '/workspace/ember', updated: minutes(240), status: 'waiting_input', messages: [
      { role: 'user', text: 'Update this app to use shadcn so the animations are smooth.' },
      { role: 'assistant', text: 'Which blob style do you want as default?' },
    ] },
  ],
  studio: [
    { id: 'ses_b1', title: 'Habit distribution', directory: '/workspace/habit', updated: minutes(6), status: 'idle', messages: [
      { role: 'user', text: 'Distribution for Habit.am, outreach list.' },
      { role: 'assistant', text: 'Drafted 12 outreach emails and queued them for review.' },
    ] },
    { id: 'ses_b2', title: 'QA Engineer', directory: '/workspace/agent', updated: minutes(35), status: 'error', messages: [
      { role: 'user', text: 'Click through every new GitHub deploy and report issues.' },
      { role: 'assistant', text: 'Deploy #142 failed to load: 502 from the edge.' },
    ] },
    { id: 'ses_b3', title: 'Habit Instagram', directory: '/workspace/habit', updated: minutes(1500), status: 'idle', messages: [
      { role: 'user', text: 'Posts Instagram carousels for Habit.am.' },
    ] },
  ],
};

const projects: Record<string, unknown[]> = {
  local: [
    { id: 'p1', path: '/workspace/channels', label: 'channels' },
    { id: 'p2', path: '/workspace/habit', label: 'habit' },
    { id: 'p3', path: '/workspace/ember', label: 'ember' },
  ],
  studio: [
    { id: 'p4', path: '/workspace/habit', label: 'habit' },
    { id: 'p5', path: '/workspace/agent', label: 'agent' },
  ],
};

let settings: EmberSettings = { theme: 'ember', blobStyle: 'grok' };
const mru: Record<string, string[]> = {};

const delay = <T,>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const ok = (data: unknown) => ({ ok: true, status: 200, data });

const bridge: EmberBridge = {
  listInstances: () => delay(instances, 300),
  getSettings: () => delay(settings),
  setSettings: (patch) => {
    settings = { ...settings, ...patch };
    return delay(settings);
  },
  modelsGet: (instanceId) => delay(mru[instanceId] ?? []),
  modelsSet: (instanceId, order) => {
    mru[instanceId] = order;
    return delay(null);
  },
  request: async (instanceId, method, path, body) => {
    const list = sessions[instanceId] ?? [];
    if (path === '/api/config/settings') return delay(ok({ projects: projects[instanceId] ?? [] }));
    if (path === '/api/session' && method === 'GET') {
      return delay(ok(list.map((s) => ({ id: s.id, title: s.title, directory: s.directory, time: { updated: s.updated } }))));
    }
    if (path === '/api/session' && method === 'POST') {
      const created: MockSession = {
        id: `ses_${Math.random().toString(36).slice(2, 8)}`,
        title: 'New agent',
        directory: String((body as { directory?: string })?.directory ?? ''),
        updated: Date.now(),
        status: 'idle',
        messages: [],
      };
      list.unshift(created);
      return delay(ok({ id: created.id, title: created.title }));
    }
    if (path === '/api/sessions/status') {
      return delay(ok({ sessions: Object.fromEntries(list.map((s) => [s.id, { status: s.status }])) }));
    }
    const messageMatch = path.match(/^\/api\/session\/([^/]+)\/message$/);
    if (messageMatch) {
      const session = list.find((s) => s.id === decodeURIComponent(messageMatch[1]));
      return delay(ok((session?.messages ?? []).map((m, i) => ({ info: { id: `${session?.id}-${i}`, role: m.role }, parts: [{ type: 'text', text: m.text }] }))));
    }
    const promptMatch = path.match(/^\/api\/session\/([^/]+)\/prompt_async$/);
    if (promptMatch) {
      const session = list.find((s) => s.id === decodeURIComponent(promptMatch[1]));
      const text = String((body as { parts?: Array<{ text?: string }> })?.parts?.[0]?.text ?? '');
      if (session) {
        session.messages.push({ role: 'user', text });
        session.updated = Date.now();
        session.status = 'busy';
        setTimeout(() => {
          session.messages.push({ role: 'assistant', text: `Echo from ${instanceId}: ${text}` });
          session.status = 'idle';
        }, 1800);
      }
      return delay(ok({}));
    }
    if (path === '/api/provider') {
      return delay(ok({
        connected: ['anthropic', 'openai'],
        all: [
          { id: 'anthropic', name: 'Anthropic', models: { 'claude-sonnet': { id: 'claude-sonnet', name: 'Claude Sonnet' }, 'claude-opus': { id: 'claude-opus', name: 'Claude Opus' } } },
          { id: 'openai', name: 'OpenAI', models: { 'gpt-5': { id: 'gpt-5', name: 'GPT-5' } } },
        ],
        default: { providerID: 'anthropic', modelID: 'claude-sonnet' },
      }));
    }
    return { ok: false, status: 404, data: null };
  },
};

window.ember = bridge;
