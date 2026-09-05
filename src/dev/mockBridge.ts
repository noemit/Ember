/**
 * Dev-only stand-in for the Electron preload bridge so the renderer can run under
 * plain `vite` in a browser. Loaded from main.tsx only when `window.ember` is absent.
 */
import type { EmberBridge, EmberSettings, EmberSettingsPatch } from '../types';

type MockTool = {
  tool: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  title?: string;
  error?: string;
  input?: Record<string, unknown>;
  output?: string;
  diff?: string;
};

type MockMessage = {
  role: 'user' | 'assistant';
  text: string;
  reasoning?: string;
  error?: string;
  files?: Array<{ filename: string; mime: string; url: string }>;
  tools?: MockTool[];
  /** Assistant turn still streaming. */
  open?: boolean;
};

type MockQuestion = {
  id: string;
  sessionID: string;
  questions: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description: string }>;
    multiple?: boolean;
    custom?: boolean;
  }>;
};

type MockSession = {
  id: string;
  title: string;
  directory: string;
  updated: number;
  archived?: number;
  model?: { id: string; providerID: string };
  status: string;
  messages: MockMessage[];
};

type MockPermission = {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
};

const minutes = (n: number) => Date.now() - n * 60_000;

const instances = [
  { id: 'local', label: 'MacBook', kind: 'local', url: 'http://127.0.0.1:3000', status: 'ready', attachable: true },
  { id: 'studio', label: 'Studio (ssh)', kind: 'ssh', url: 'http://127.0.0.1:3101', status: 'ready', attachable: true },
  { id: 'relay', label: 'Private relay', kind: 'relay', status: 'unsupported', attachable: false },
];

const sessions: Record<string, MockSession[]> = {
  local: [
    { id: 'ses_a1', title: 'Daily channel brief · scheduled', directory: '/workspace/channels', updated: minutes(2), model: { id: 'gpt-5', providerID: 'openai' }, status: 'busy', messages: [
      { role: 'user', text: 'Run the scheduled morning channel brief: summarize analytics, comments, and today’s publishing queue.' },
      { role: 'assistant', text: 'On it. Pulled the latest analytics; the LongCat video is trending above baseline.', tools: [
        { tool: 'webfetch', status: 'completed', title: 'https://studio.youtube.com/analytics' },
        { tool: 'read', status: 'completed', title: 'channels/schedule.md' },
      ] },
      { role: 'assistant', text: 'Drafting the pinned comment now.', open: true, tools: [
        { tool: 'bash', status: 'error', title: 'yt-dlp --dump-json', error: 'exit 1: network unreachable' },
        { tool: 'bash', status: 'running', title: 'bun run scripts/pin-comment.ts --video LongCat' },
      ] },
    ] },
    { id: 'ses_a2', title: 'Habit onboarding QA', directory: '/workspace/habit', updated: minutes(14), model: { id: 'claude-opus', providerID: 'anthropic' }, status: 'idle', messages: [
      { role: 'user', text: 'QA for Habit.am, the guide flow.' },
      {
        role: 'assistant',
        reasoning: 'The guide flow has three steps. I should check each checklist item renders and that the CTA is wired.',
        text: 'Found **two regressions** in the onboarding checklist:\n\n1. The `Continue` button stays disabled after the last item — see `/workspace/habit/src/Checklist.tsx`\n2. Step counter shows `3/2`\n\n```ts\nconst done = items.filter((i) => i.checked).length;\n```\n\nFiling them now.',
        tools: [
          { tool: 'read', status: 'completed', title: 'src/Checklist.tsx', input: { filePath: '/workspace/habit/src/Checklist.tsx' }, output: 'export function Checklist({ items }) {\n  const done = items.filter((i) => i.checked).length;\n  return <Progress value={done} max={items.length - 1} />;\n}' },
          { tool: 'edit', status: 'completed', title: 'src/Checklist.tsx', diff: '--- a/src/Checklist.tsx\n+++ b/src/Checklist.tsx\n@@ -2,3 +2,3 @@\n   const done = items.filter((i) => i.checked).length;\n-  return <Progress value={done} max={items.length - 1} />;\n+  return <Progress value={done} max={items.length} />;' },
        ],
      },
    ] },
    { id: 'ses_a3', title: 'Ember mobile polish', directory: '/workspace/ember', updated: minutes(240), status: 'waiting_input', messages: [
      { role: 'user', text: 'Update this app to use shadcn so the animations are smooth.' },
      { role: 'assistant', text: 'Happy to. One decision first.', open: true, tools: [
        { tool: 'question', status: 'running', title: 'Which blob style?' },
      ] },
    ] },
    { id: 'ses_a4', title: 'Habit preview cleanup', directory: '/workspace/habit', updated: minutes(1), model: { id: 'claude-sonnet', providerID: 'anthropic' }, status: 'busy', messages: [
      { role: 'user', text: 'Remove the stale preview deployments.' },
      { role: 'assistant', text: 'Found 6 stale previews. Removing them.', open: true, tools: [
        { tool: 'bash', status: 'completed', title: 'vercel ls habit --meta stale=true' },
        { tool: 'bash', status: 'pending', title: 'vercel rm habit-preview-* --yes' },
      ] },
    ] },
    { id: 'ses_a5', title: 'Sponsor pipeline research', directory: '/workspace/channels', updated: minutes(48), model: { id: 'gpt-5', providerID: 'openai' }, status: 'idle', messages: [
      { role: 'user', text: 'Research developer-tool sponsors that fit the channel and rank the best five.' },
      { role: 'assistant', text: 'Shortlisted five strong fits and added audience overlap, contact details, and suggested angles to `partners/sponsor-pipeline.md`.' },
    ] },
    { id: 'ses_a6', title: 'Ember remote access hardening', directory: '/workspace/ember', updated: minutes(75), model: { id: 'claude-sonnet', providerID: 'anthropic' }, status: 'idle', messages: [
      { role: 'user', text: 'Review the Tailscale web access path and tighten authentication.' },
      { role: 'assistant', text: 'Added password hashing, rate-limited login attempts, and short-lived authenticated sessions. The listener remains bound only to the Tailscale interface.' },
    ] },
    { id: 'ses_a7', title: 'Daily channel brief · yesterday', directory: '/workspace/channels', updated: minutes(1440), model: { id: 'gpt-5', providerID: 'openai' }, status: 'idle', messages: [
      { role: 'user', text: 'Run the scheduled morning channel brief.' },
      { role: 'assistant', text: 'Yesterday’s brief is complete: views were up 18%, subscriber conversion held steady, and two comments were flagged for a reply.' },
    ] },
  ],
  studio: [
    { id: 'ses_b1', title: 'Habit partner outreach', directory: '/workspace/habit', updated: minutes(6), status: 'idle', messages: [
      { role: 'user', text: 'Distribution for Habit.am, outreach list.' },
      { role: 'assistant', text: 'Drafted 12 outreach emails and queued them for review.' },
    ] },
    { id: 'ses_b2', title: 'Agent deploy smoke test', directory: '/workspace/agent', updated: minutes(35), status: 'error', messages: [
      { role: 'user', text: 'Click through every new GitHub deploy and report issues.' },
      { role: 'assistant', text: '', error: 'Invalid request Error' },
    ] },
    { id: 'ses_b3', title: 'Habit Instagram carousel', directory: '/workspace/habit', updated: minutes(1500), status: 'idle', messages: [
      { role: 'user', text: 'Posts Instagram carousels for Habit.am.' },
    ] },
    { id: 'ses_b4', title: 'Old landing page', directory: '/workspace/habit', updated: minutes(4000), archived: minutes(3000), status: 'idle', messages: [
      { role: 'user', text: 'Rewrite the landing page hero copy.' },
      { role: 'assistant', text: 'Done, three variants attached.' },
    ] },
  ],
};

const projects: Record<string, unknown[]> = {
  local: [
    { id: 'p1', path: '/workspace/channels', label: 'Creator Studio' },
    { id: 'p2', path: '/workspace/habit', label: 'Habit' },
    { id: 'p3', path: '/workspace/ember', label: 'Ember' },
  ],
  studio: [
    { id: 'p4', path: '/workspace/habit', label: 'Habit' },
    { id: 'p5', path: '/workspace/agent', label: 'Agent Platform' },
  ],
};

const scheduledTasks: Record<string, unknown[]> = {
  p1: [{ id: 'daily-channel-brief', name: 'Daily channel brief', state: { lastSessionId: 'ses_a1' } }],
};

const permissions: Record<string, MockPermission[]> = {
  local: [
    {
      id: 'perm_1',
      sessionID: 'ses_a4',
      permission: 'bash',
      patterns: ['vercel rm *'],
      metadata: { command: 'vercel rm habit-preview-* --yes', description: 'Delete stale preview deployments' },
      always: ['vercel rm *'],
    },
  ],
  studio: [],
};

const questions: Record<string, MockQuestion[]> = {
  local: [
    {
      id: 'q_1',
      sessionID: 'ses_a3',
      questions: [
        {
          header: 'Blob style',
          question: 'Which blob style should be the default?',
          options: [
            { label: 'Buddy (flat)', description: 'Solid colour, softer shapes.' },
            { label: 'Gem (faceted)', description: 'Low-poly look with highlights.' },
          ],
        },
        {
          header: 'Animations',
          question: 'Which animations should stay on?',
          multiple: true,
          options: [
            { label: 'Reorder', description: 'Sessions slide when order changes.' },
            { label: 'Enter/exit', description: 'Fade for menus and dialogs.' },
            { label: 'Idle wobble', description: 'Blobs breathe while idle.' },
          ],
        },
      ],
    },
  ],
  studio: [],
};

let settings: EmberSettings = {
  theme: 'stone',
  blobStyle: 'grok',
  sessionWindowHours: 48,
  instanceDefaults: {
    local: { markerColor: 0 },
    studio: { markerColor: 7 },
  },
  pinnedMessages: [
    'local::ses_a2::ses_a2-0',
    'local::ses_a2::ses_a2-1',
  ],
  sessionNotes: {
    'local::ses_a2': 'Next prompts:\n- Verify the fix on a narrow viewport\n- Add a regression test for the completed checklist state\n\nDecision: keep the progress indicator visible after onboarding.',
  },
  scheduledSessionBindings: {
    'local::ses_a1': 'task:local::p1::daily-channel-brief',
    'local::ses_a7': 'task:local::p1::daily-channel-brief',
  },
  avatarOverrides: {
    'task:local::p1::daily-channel-brief': { shapeName: 'dumpling' },
    'session:local::ses_a5': { shapeName: 'splat' },
    'session:local::ses_a2': { shapeName: 'jelly' },
    'session:local::ses_a4': { shapeName: 'puddle' },
    'session:local::ses_a3': { shapeName: 'bounce' },
    'session:local::ses_a6': { shapeName: 'lopsided' },
  },
  projectColorAssignments: {
    'project:local::p1': 0,
    'project:local::p2': 1,
    'project:local::p3': 2,
    'project:studio::p4': 3,
    'project:studio::p5': 4,
  },
  remoteAccessEnabled: false,
  remotePasswordConfigured: false,
};

const toParts = (message: MockMessage, messageId: string) => [
  ...(message.reasoning ? [{ id: `${messageId}-reasoning`, type: 'reasoning', text: message.reasoning }] : []),
  ...(message.files ?? []).map((file, index) => ({ id: `${messageId}-file-${index}`, type: 'file', ...file })),
  ...(message.text ? [{ id: `${messageId}-text`, type: 'text', text: message.text }] : []),
  ...(message.tools ?? []).map((tool, index) => ({
    id: `${messageId}-tool-${index}`,
    type: 'tool',
    callID: `${messageId}-call-${index}`,
    tool: tool.tool,
    state: {
      status: tool.status,
      input: tool.input ?? {},
      title: tool.title,
      error: tool.error,
      output: tool.output,
      metadata: tool.diff ? { diff: tool.diff } : {},
    },
  })),
];

const delay = <T,>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const ok = (data: unknown) => ({ ok: true, status: 200, data });

const bridge: EmberBridge = {
  listInstances: () => delay(instances, 300),
  getSettings: () => delay(settings),
  setSettings: (patch: EmberSettingsPatch) => {
    const { remotePassword, ...safePatch } = patch;
    settings = {
      ...settings,
      ...safePatch,
      ...(remotePassword !== undefined
        ? { remotePasswordConfigured: typeof remotePassword === 'string' && remotePassword.length >= 8 }
        : {}),
    };
    return delay(settings);
  },
  openExternal: async (target) => {
    if (/^https?:\/\//i.test(target)) window.open(target, '_blank', 'noopener');
    else console.info('[mock] would reveal in Finder:', target);
    return true;
  },
  // No Dock in a browser; the tab favicon is the closest stand-in.
  setDockIcon: async (dataUrl) => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = dataUrl;
  },
  request: async (instanceId, method, path, body) => {
    const list = sessions[instanceId] ?? [];
    const url = new URL(path, 'http://mock');
    if (path === '/api/config/settings') return delay(ok({ projects: projects[instanceId] ?? [] }));
    const scheduledMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/scheduled-tasks$/);
    if (scheduledMatch && method === 'GET') {
      return delay(ok({ tasks: scheduledTasks[decodeURIComponent(scheduledMatch[1])] ?? [] }));
    }
    if (url.pathname === '/api/experimental/session' && method === 'GET') {
      const includeArchived = url.searchParams.get('archived') === 'true';
      const cursor = Number(url.searchParams.get('cursor') ?? Infinity);
      const limit = Number(url.searchParams.get('limit') ?? Infinity);
      const page = [...list]
        .filter((s) => (includeArchived || !s.archived) && s.updated < cursor)
        .sort((a, b) => b.updated - a.updated)
        .slice(0, limit);
      return delay(ok(page.map((s) => ({ id: s.id, title: s.title, directory: s.directory, model: s.model, time: { updated: s.updated, archived: s.archived } }))));
    }
    const updateMatch = url.pathname.match(/^\/api\/session\/([^/]+)$/);
    if (updateMatch && method === 'PATCH') {
      const session = list.find((s) => s.id === decodeURIComponent(updateMatch[1]));
      if (!session) return { ok: false, status: 404, data: null };
      const archived = (body as { time?: { archived?: number } })?.time?.archived;
      if (typeof archived === 'number') session.archived = archived || undefined;
      return delay(ok({ id: session.id, title: session.title, time: { updated: session.updated, archived: session.archived } }));
    }
    if (url.pathname === '/api/session' && method === 'POST') {
      const directory =
        String((body as { directory?: string })?.directory ?? '') ||
        (url.searchParams.get('directory') ?? '');
      const created: MockSession = {
        id: `ses_${Math.random().toString(36).slice(2, 8)}`,
        title: 'New agent',
        directory,
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
    if (url.pathname === '/api/question' && method === 'GET') return delay(ok(questions[instanceId] ?? []));
    const questionMatch = url.pathname.match(/^\/api\/question\/([^/]+)\/(reply|reject)$/);
    if (questionMatch && method === 'POST') {
      const pending = questions[instanceId] ?? [];
      const index = pending.findIndex((q) => q.id === decodeURIComponent(questionMatch[1]));
      if (index === -1) return { ok: false, status: 404, data: null };
      const [request] = pending.splice(index, 1);
      const session = list.find((s) => s.id === request.sessionID);
      const last = session?.messages[session.messages.length - 1];
      const tool = last?.tools?.find((t) => t.tool === 'question');
      if (tool) tool.status = questionMatch[2] === 'reply' ? 'completed' : 'error';
      if (session && last) {
        last.open = false;
        const answers = (body as { answers?: string[][] })?.answers;
        session.messages.push({ role: 'assistant', text: answers ? `Got it: ${answers.map((a) => a.join(', ')).join(' / ')}.` : 'Okay, skipping that.' });
        session.status = 'idle';
      }
      return delay(ok(true));
    }
    const abortMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/abort$/);
    if (abortMatch && method === 'POST') {
      const session = list.find((s) => s.id === decodeURIComponent(abortMatch[1]));
      const last = session?.messages[session.messages.length - 1];
      if (session && last) {
        last.open = false;
        last.tools?.forEach((t) => { if (t.status === 'running' || t.status === 'pending') { t.status = 'error'; t.error = 'Aborted'; } });
        session.status = 'idle';
      }
      return delay(ok(true));
    }
    if (url.pathname === '/api/permission' && method === 'GET') return delay(ok(permissions[instanceId] ?? []));
    const replyMatch = url.pathname.match(/^\/api\/permission\/([^/]+)\/reply$/);
    if (replyMatch && method === 'POST') {
      const pending = permissions[instanceId] ?? [];
      const index = pending.findIndex((p) => p.id === decodeURIComponent(replyMatch[1]));
      if (index === -1) return { ok: false, status: 404, data: null };
      const [request] = pending.splice(index, 1);
      const session = list.find((s) => s.id === request.sessionID);
      const approved = (body as { reply?: string })?.reply !== 'reject';
      const last = session?.messages[session.messages.length - 1];
      const pendingTool = last?.tools?.find((t) => t.status === 'pending');
      if (pendingTool) pendingTool.status = approved ? 'running' : 'error';
      if (pendingTool && !approved) pendingTool.error = 'Denied by user';
      if (session && last && !approved) { last.open = false; session.status = 'idle'; }
      if (session && last && approved) {
        setTimeout(() => {
          if (pendingTool) pendingTool.status = 'completed';
          last.open = false;
          session.messages.push({ role: 'assistant', text: 'All 6 previews removed.' });
          session.status = 'idle';
        }, 2500);
      }
      return delay(ok(true));
    }
    const messageMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/message$/);
    if (messageMatch) {
      const session = list.find((s) => s.id === decodeURIComponent(messageMatch[1]));
      return delay(ok((session?.messages ?? []).map((m, i, all) => {
        const id = `${session?.id}-${i}`;
        const created = (session?.updated ?? Date.now()) - (all.length - i) * 5000;
        const time = m.role === 'assistant' && !m.open ? { created, completed: created + 2400 } : { created };
        const model = session?.model ?? { id: 'claude-sonnet', providerID: 'anthropic' };
        const info = m.role === 'user'
          ? { id, role: m.role, time, model: { providerID: model.providerID, modelID: model.id } }
          : {
              id,
              role: m.role,
              time,
              providerID: model.providerID,
              modelID: model.id,
              error: m.error ? { name: 'APIError', data: { message: m.error, statusCode: 400 } } : undefined,
            };
        return { info, parts: toParts(m, id) };
      })));
    }
    const promptMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/prompt_async$/);
    if (promptMatch) {
      const session = list.find((s) => s.id === decodeURIComponent(promptMatch[1]));
      const prompt = body as {
        parts?: Array<{
          type: string;
          text?: string;
          filename?: string;
          mime?: string;
          url?: string;
          metadata?: { emberReplyContext?: boolean };
        }>;
        model?: { providerID: string; modelID: string };
      };
      const parts = prompt?.parts ?? [];
      const text = parts
        .filter((part) => part.type === 'text' && part.metadata?.emberReplyContext !== true)
        .map((part) => part.text ?? '')
        .join('');
      const files = parts.filter((p) => p.type === 'file').map((p) => ({ filename: p.filename ?? 'file', mime: p.mime ?? '', url: p.url ?? '' }));
      if (session) {
        session.messages.push({ role: 'user', text, files });
        if (prompt.model) {
          session.model = { id: prompt.model.modelID, providerID: prompt.model.providerID };
        }
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
      const model = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
        id,
        name,
        family: name.split(' ')[0],
        status: 'active',
        release_date: '2026-05-01',
        capabilities: { reasoning: true, toolcall: true, attachment: true, input: { text: true, image: true, pdf: false, audio: false, video: false } },
        cost: { input: 3, output: 15 },
        limit: { context: 200_000, output: 64_000 },
        variants: { low: {}, medium: {}, high: {} },
        ...extra,
      });
      const bulk = Object.fromEntries(
        Array.from({ length: 60 }, (_, i) => [`router-${i}`, model(`router-${i}`, `Router Model ${i}`, { cost: { input: 0, output: 0 }, variants: {}, status: i % 20 === 7 ? 'beta' : 'active' })])
      );
      return delay(ok({
        connected: ['anthropic', 'openai', 'router'],
        all: [
          { id: 'anthropic', name: 'Anthropic', models: {
            'claude-sonnet': model('claude-sonnet', 'Claude Sonnet'),
            'claude-opus': model('claude-opus', 'Claude Opus', { cost: { input: 15, output: 75 }, limit: { context: 1_000_000, output: 128_000 } }),
          } },
          { id: 'openai', name: 'OpenAI', models: { 'gpt-5': model('gpt-5', 'GPT-5', { capabilities: { reasoning: true, toolcall: true, attachment: false, input: { text: true } } }) } },
          { id: 'router', name: 'Router', models: bulk },
          { id: 'unused', name: 'Unused provider', models: { x: model('x', 'Should not appear') } },
        ],
        default: { 'unused': 'x', 'anthropic': 'claude-sonnet' },
      }));
    }
    return { ok: false, status: 404, data: null };
  },
};

window.ember = bridge;
