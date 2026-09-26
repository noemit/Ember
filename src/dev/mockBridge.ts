/**
 * Dev-only stand-in for the Electron preload bridge so the renderer can run under
 * plain `vite` in a browser. Loaded from main.tsx only when `window.ember` is absent.
 */
import type { EmberBridge, EmberSettings, EmberSettingsPatch } from '../types';
import type { ModelObservation } from '../lib/modelStats';

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

/** OpenCode 2 `Form.Info` — the pending "questions" a session asks are keyed form fields. */
type MockForm = {
  id: string;
  sessionID: string;
  fields: Array<{
    key: string;
    type: string;
    title: string;
    description?: string;
    header?: string;
    options?: Array<{ value: string; label: string; description?: string }>;
  }>;
};

type MockSession = {
  id: string;
  title: string;
  directory: string;
  updated: number;
  archived?: number;
  model?: { id: string; providerID: string; variant?: string };
  status: string;
  messages: MockMessage[];
};

/** OpenCode 2 `Permission.Request` — the action asked for plus the resources it wants. */
type MockPermission = {
  id: string;
  sessionID: string;
  action: string;
  resources: string[];
  message?: string;
  metadata: Record<string, unknown>;
};

type MockQueuedMessage = {
  id: string;
  createdAt: number;
  content: string;
  text: string;
  attachments: Array<{
    id?: string;
    filename: string;
    mimeType: string;
    size?: number;
    source?: string;
    dataUrl?: string;
  }>;
  sendConfig: { providerID: string; modelID: string; agent?: string; variant?: string };
  context?: Array<{
    kind: string;
    text: string;
    metadata?: Record<string, unknown>;
    instructions?: string;
  }>;
  agentMention?: string;
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
    // Extra channels sessions so a project card overflows into a `+N` chip, for testing the
    // bulk-archive menu (two older than a day, one recent).
    { id: 'ses_c1', title: 'Old thumbnail notes', directory: '/workspace/channels', updated: minutes(2000), status: 'idle', messages: [
      { role: 'assistant', text: 'Thumbnail notes from last week.' },
    ] },
    { id: 'ses_c2', title: 'Old sponsor shortlist', directory: '/workspace/channels', updated: minutes(2800), status: 'idle', messages: [
      { role: 'assistant', text: 'An old sponsor shortlist.' },
    ] },
    { id: 'ses_c3', title: 'Recent collab idea', directory: '/workspace/channels', updated: minutes(20), status: 'idle', messages: [
      { role: 'assistant', text: 'A recent collaboration idea.' },
    ] },
    // Trailing tool-only turns plus a streaming final message, for exercising bounded tails and
    // the progressive preview's tool-only skip: the final turn has no text yet, so a preview must
    // walk back to an older turn.
    { id: 'ses_a8', title: 'CI failure triage', directory: '/workspace/agent', updated: minutes(3), model: { id: 'claude-sonnet', providerID: 'anthropic' }, status: 'busy', messages: [
      { role: 'user', text: 'Find the failing test in the last CI run and fix it.' },
      { role: 'assistant', text: 'Reading the run log now.' },
      { role: 'assistant', text: '', tools: [
        { tool: 'read', status: 'completed', title: 'ci/run-4821.log', input: { filePath: '/workspace/agent/ci/run-4821.log' } },
        { tool: 'grep', status: 'completed', title: 'FAIL', input: { pattern: 'FAIL' } },
      ] },
      { role: 'assistant', text: '', open: true, reasoning: 'The failing assertion is in the retry test; checking the helper before patching.', tools: [
        { tool: 'read', status: 'running', title: 'src/lib/retry.test.ts' },
      ] },
    ] },
  ],
  studio: [
    { id: 'ses_b1', title: 'Habit partner outreach', directory: '/workspace/habit', updated: minutes(6), status: 'idle', messages: [
      { role: 'user', text: 'Distribution for Habit.am, outreach list.' },
      { role: 'assistant', text: 'Drafted 12 outreach emails and queued them for review.' },
    ] },
    // Real OpenChamber only reports idle/busy/retry; the error state must come from the transcript.
    { id: 'ses_b2', title: 'Agent deploy smoke test', directory: '/workspace/agent', updated: minutes(35), status: 'idle', messages: [
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
    { id: 'p6', path: '/workspace/vacant', label: 'Vacant' },
  ],
  studio: [
    { id: 'p4', path: '/workspace/habit', label: 'Habit' },
    { id: 'p5', path: '/workspace/agent', label: 'Agent Platform' },
  ],
};

const scheduledTasks: Record<string, unknown[]> = {
  p1: [{
    id: 'daily-channel-brief',
    name: 'Daily channel brief',
    enabled: true,
    schedule: { kind: 'daily', times: ['09:00'] },
    execution: { prompt: 'Run the scheduled morning channel brief.', providerID: 'openai', modelID: 'gpt-5' },
    state: { lastSessionId: 'ses_a1', lastStatus: 'error', lastError: 'Provider timed out' },
  }],
};

const permissions: Record<string, MockPermission[]> = {
  local: [
    {
      id: 'perm_1',
      sessionID: 'ses_a4',
      action: 'bash',
      resources: ['vercel rm habit-preview-* --yes'],
      message: 'Delete stale preview deployments',
      metadata: { command: 'vercel rm habit-preview-* --yes' },
    },
  ],
  studio: [],
};

const forms: Record<string, MockForm[]> = {
  local: [
    {
      id: 'form_1',
      sessionID: 'ses_a3',
      fields: [
        {
          key: 'blob-style',
          type: 'select',
          header: 'Blob style',
          title: 'Which blob style should be the default?',
          options: [
            { value: 'buddy', label: 'Buddy (flat)', description: 'Solid colour, softer shapes.' },
            { value: 'glyph', label: 'Glyph (icons)', description: 'Hand-drawn icons on a colour disc.' },
          ],
        },
        {
          key: 'animations',
          type: 'multiselect',
          header: 'Animations',
          title: 'Which animations should stay on?',
          options: [
            { value: 'reorder', label: 'Reorder', description: 'Sessions slide when order changes.' },
            { value: 'enter-exit', label: 'Enter/exit', description: 'Fade for menus and dialogs.' },
            { value: 'idle-wobble', label: 'Idle wobble', description: 'Blobs breathe while idle.' },
          ],
        },
      ],
    },
  ],
  studio: [],
};

const queuedMessages: Record<string, Record<string, MockQueuedMessage[]>> = {};
let queueRevision = 0;
const autoAccept: Record<string, boolean> = { ses_a1: true };
let autoAcceptRevision = 1;

const queueSnapshot = (instanceId: string) => ({
  revision: queueRevision,
  sessions: Object.entries(queuedMessages[instanceId] ?? {}).map(([sessionId, items]) => ({
    sessionId,
    directory: sessions[instanceId]?.find((session) => session.id === sessionId)?.directory ?? '',
    items,
    sendingId: null,
  })),
});

let settings: EmberSettings = {
  theme: 'stone',
  blobStyle: 'buddy',
  sessionWindowHours: 48,
  hideToolCalls: false,
  reasoningDisplay: 'collapsed',
  instanceDefaults: {
    local: { markerColor: 0 },
    studio: { markerColor: 7 },
  },
  pinnedMessages: [
    'local::ses_a2::ses_a2-0',
    'local::ses_a2::ses_a2-1',
  ],
  sessionNotes: {
    'local::ses_a2': [
      { id: 'verify-narrow', text: 'Verify the fix on a narrow viewport.' },
      { id: 'regression-test', text: 'Add a regression test for the completed checklist state.' },
      { id: 'progress-decision', text: 'Decision: keep the progress indicator visible after onboarding.' },
    ],
  },
  composerDrafts: {},
  scheduledSessionBindings: {
    'local::ses_a1': 'task:local::p1::daily-channel-brief',
    'local::ses_a7': 'task:local::p1::daily-channel-brief',
  },
  autoArchiveScheduledRuns: true,
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
  openSessions: [],
  activeSession: null,
  minimizedSessions: [],
  remoteAccessEnabled: false,
  remotePasswordConfigured: false,
};

/**
 * OpenCode 2 `Session.Message.Info` content entries: text/reasoning/tool parts inside
 * `content[]`, tool output as `state.content[]` rather than a flat `output` string.
 */
const toParts = (message: MockMessage, messageId: string) => [
  ...(message.reasoning ? [{ id: `${messageId}-reasoning`, type: 'reasoning', text: message.reasoning }] : []),
  ...(message.text ? [{ id: `${messageId}-text`, type: 'text', text: message.text }] : []),
  ...(message.tools ?? []).map((tool, index) => ({
    id: `${messageId}-tool-${index}`,
    type: 'tool',
    name: tool.tool,
    callID: `${messageId}-call-${index}`,
    executed: tool.status === 'completed' || tool.status === 'error',
    state: {
      status: tool.status,
      input: tool.input ?? {},
      title: tool.title,
      error: tool.error ? { type: 'ToolError', message: tool.error } : undefined,
      content: tool.output ? [{ type: 'text', text: tool.output }] : undefined,
      metadata: tool.diff ? { diff: tool.diff } : {},
    },
  })),
];

const delay = <T,>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const ok = (data: unknown) => ({ ok: true, status: 200, data });

const queueMutation = (instanceId: string, sessionId: string, itemId?: string) => ({
  revision: queueRevision,
  itemId,
  session: queueSnapshot(instanceId).sessions.find((session) => session.sessionId === sessionId) ?? {
    sessionId,
    directory: sessions[instanceId]?.find((session) => session.id === sessionId)?.directory ?? '',
    items: [],
    sendingId: null,
  },
});

const deliverQueuedMessage = (instanceId: string, sessionId: string) => {
  const session = sessions[instanceId]?.find((entry) => entry.id === sessionId);
  const item = queuedMessages[instanceId]?.[sessionId]?.[0];
  if (!session || !item || session.status === 'busy') return;
  queuedMessages[instanceId][sessionId].shift();
  if (queuedMessages[instanceId][sessionId].length === 0) delete queuedMessages[instanceId][sessionId];
  queueRevision += 1;
  session.messages.push({
    role: 'user',
    text: item.text,
    files: item.attachments
      .filter((file) => file.dataUrl)
      .map((file) => ({ filename: file.filename, mime: file.mimeType, url: file.dataUrl! })),
  });
  session.model = { id: item.sendConfig.modelID, providerID: item.sendConfig.providerID, variant: item.sendConfig.variant };
  session.updated = Date.now();
  session.status = 'busy';
  setTimeout(() => {
    session.messages.push({ role: 'assistant', text: `Queued message delivered: ${item.text}` });
    session.status = 'idle';
    session.updated = Date.now();
    setTimeout(() => deliverQueuedMessage(instanceId, sessionId), 100);
  }, 1200);
};

/**
 * Synthetic event stream. Rather than instrumenting every place the mock mutates state, a
 * watcher diffs each session's status/message count/pending prompts and emits the hint an
 * OpenChamber instance would. Only `local` streams; `studio` stays on the fast-poll fallback.
 */
const STREAMING_INSTANCES = new Set(['local']);
type EventListener = (event: unknown) => void;
const eventListeners = new Set<EventListener>();
const emit = (event: unknown) => eventListeners.forEach((listener) => listener(event));

// Streaming scenario for the triage session: grow the open final turn one chunk at a time without
// changing the message count, so the watcher emits `message.part.updated` and the renderer
// exercises bounded tail fetches. It resets once the text gets long, keeping the mock bounded.
const STREAM_CHUNKS = ['Checking ', 'the retry ', 'helper… ', 'the assertion ', 'looks off by one. '];
let streamTick = 0;
const advanceStreamingScenario = () => {
  streamTick += 1;
  if (streamTick % 4 !== 0) return;
  const session = (sessions.local ?? []).find((entry) => entry.id === 'ses_a8');
  const last = session?.messages[session.messages.length - 1];
  if (!session || !last?.open) return;
  last.text = last.text.length > 160 ? '' : `${last.text}${STREAM_CHUNKS[streamTick % STREAM_CHUNKS.length]}`;
  session.updated = Date.now();
};

let watcher: number | undefined;
const watchForChanges = () => {
  const snapshot = new Map<string, string>();
  // Include a content signature so a streaming turn that grows a message without adding one still
  // emits a `message.part.updated` hint (the message count would not change).
  const contentSignature = (s: MockSession): string =>
    s.messages
      .map((m) => `${(m.text ?? '').length}:${m.reasoning?.length ?? 0}:${m.open ? 1 : 0}:${m.error ?? ''}:${m.tools?.length ?? 0}`)
      .join(',');
  const fingerprint = (instanceId: string) =>
    JSON.stringify({
      sessions: (sessions[instanceId] ?? []).map((s) => [
        s.id,
        s.status,
        s.messages.length,
        s.archived ?? 0,
        contentSignature(s),
      ]),
      permissions: (permissions[instanceId] ?? []).map((p) => p.id),
      forms: (forms[instanceId] ?? []).map((q) => q.id),
    });
  STREAMING_INSTANCES.forEach((instanceId) => snapshot.set(instanceId, fingerprint(instanceId)));
  watcher = window.setInterval(() => {
    advanceStreamingScenario();
    STREAMING_INSTANCES.forEach((instanceId) => {
      const before = JSON.parse(snapshot.get(instanceId) ?? '{}') as ReturnType<typeof JSON.parse>;
      const nowPrint = fingerprint(instanceId);
      if (nowPrint === snapshot.get(instanceId)) return;
      snapshot.set(instanceId, nowPrint);
      const after = JSON.parse(nowPrint);
      const previous = new Map<string, unknown[]>((before.sessions ?? []).map((row: unknown[]) => [String(row[0]), row]));
      (after.sessions as unknown[][]).forEach((row) => {
        const [id, status, count] = row as [string, string, number];
        const prior = previous.get(id) as [string, string, number, number, string] | undefined;
        if (!prior) emit({ instanceId, type: 'session.created', sessionId: id });
        else {
          if (prior[1] !== status) {
            emit({
              instanceId,
              type: status === 'idle' ? 'session.idle' : 'session.execution.started',
              sessionId: id,
            });
          }
          if (prior[2] !== count) emit({ instanceId, type: 'session.text.ended', sessionId: id });
          else if (prior[4] !== row[4]) emit({ instanceId, type: 'session.text.delta', sessionId: id });
        }
      });
      if (JSON.stringify(before.permissions) !== JSON.stringify(after.permissions)) emit({ instanceId, type: 'permission.asked' });
      if (JSON.stringify(before.forms) !== JSON.stringify(after.forms)) emit({ instanceId, type: 'form.created' });
    });
  }, 400);
};

const performanceFixture = new URLSearchParams(window.location.search).get('fixture') === 'performance';
if (performanceFixture) {
  sessions.local = Array.from({ length: 85 }, (_, index) => ({
    id: `perf-${index}`, title: `Performance session ${index}`, directory: '/workspace/habit',
    updated: Date.now() - index * 1000, status: 'idle', model: { id: 'claude-sonnet', providerID: 'anthropic' },
    messages: Array.from({ length: index === 0 ? 10_000 : 2 }, (_, message) => ({
      role: message % 2 ? 'assistant' as const : 'user' as const,
      text: new URLSearchParams(window.location.search).has('varied') && message % 7 === 1
        ? `Synthetic message ${message}\n\n${'A longer paragraph that wraps across several lines in a narrow column. '.repeat(12)}\n\n- one\n- two\n- three`
        : `Synthetic message ${message}`,
    })),
  }));
  permissions.local = [];
  forms.local = [];
  if (new URLSearchParams(window.location.search).has('busy')) sessions.local[0].status = 'busy';
  if (new URLSearchParams(window.location.search).has('waiting')) permissions.local = [{
    id: 'archive-permission', sessionID: 'perf-0', action: 'bash', resources: ['echo pending'], metadata: {},
  }];
  settings = { ...settings, openSessions: ['local::perf-0', 'local::perf-1'], activeSession: 'local::perf-0', minimizedSessions: [] };
  const saved = sessionStorage.getItem('ember-performance-settings');
  if (saved) settings = { ...settings, ...JSON.parse(saved) };
}

const slowInstanceFixture = new URLSearchParams(window.location.search).has('slowInstance');
let instanceSnapshot = slowInstanceFixture ? instances.map((instance) => instance.id === 'studio' ? { ...instance, status: 'checking', attachable: false } : instance) : instances;
let releaseSlow = () => {};
const slowInstanceReady = new Promise<void>((resolve) => { releaseSlow = resolve; });
export const releaseSlowInstance = () => {
  instanceSnapshot = instances;
  emit({ instanceId: '*', type: 'ember:instances-updated' });
  releaseSlow();
};

/** `silent` skips the stream hint, like an event lost to a dropped connection. */
export const appendFixtureMessage = (text: string, sessionId = 'perf-0', silent = false) => {
  if (!performanceFixture) return;
  const session = sessions.local.find((entry) => entry.id === sessionId);
  if (!session) return;
  session.messages.push({ role: 'assistant', text });
  session.updated = Date.now();
  if (!silent) emit({ instanceId: 'local', type: 'session.text.delta', sessionId });
};

let modelObservations: ModelObservation[] = JSON.parse(sessionStorage.getItem('ember-mock-model-stats') ?? '[]');
let modelStatsClearedAt = Number(sessionStorage.getItem('ember-mock-model-stats-cleared') ?? 0);
const saveModelObservations = () => sessionStorage.setItem('ember-mock-model-stats', JSON.stringify(modelObservations));
const bridge: EmberBridge = {
  getModelStats: async () => modelObservations,
  observeModels: async (observations) => {
    const merged = new Map(modelObservations.map((record) => [record.id, record]));
    for (const record of observations) {
      if (record.completedAt <= modelStatsClearedAt) continue;
      merged.set(record.id, { ...record, rating: merged.get(record.id)?.rating });
    }
    modelObservations = [...merged.values()].sort((a, b) => b.completedAt - a.completedAt).slice(0, 10_000);
    saveModelObservations();
    const retained = new Map(modelObservations.map((record) => [record.id, record]));
    return [...new Set(observations.map((record) => record.id))].flatMap((id) => retained.has(id) ? [retained.get(id)!] : []);
  },
  rateModel: async (id, rating) => {
    modelObservations = modelObservations.map((record) => record.id === id ? { ...record, rating: rating ?? undefined } : record);
    saveModelObservations();
  },
  clearModelStats: async () => {
    modelObservations = [];
    modelStatsClearedAt = Date.now();
    sessionStorage.setItem('ember-mock-model-stats-cleared', String(modelStatsClearedAt));
    saveModelObservations();
  },
  capabilities: { dockIcon: !new URLSearchParams(window.location.search).has('noDock') },
  onEvent: (listener) => {
    eventListeners.add(listener);
    if (watcher === undefined) watchForChanges();
    instances.forEach((instance) =>
      listener({ instanceId: instance.id, type: 'ember:stream-status', connected: STREAMING_INSTANCES.has(instance.id) })
    );
    return () => {
      eventListeners.delete(listener);
    };
  },
  eventStatus: async () =>
    Object.fromEntries(instances.map((instance) => [instance.id, STREAMING_INSTANCES.has(instance.id)])),
  listInstances: (refresh = true) => {
    if (!refresh) return Promise.resolve(instanceSnapshot);
    if (slowInstanceFixture) {
      window.setTimeout(() => emit({ instanceId: '*', type: 'ember:instances-updated' }), 30);
      return slowInstanceReady.then(() => instances);
    }
    return delay(instances, 300);
  },
  getSettings: () => delay(settings),
  setSettings: (patch: EmberSettingsPatch) => {
    const { remotePassword, composerDraftChanges, ...safePatch } = patch;
    const drafts = { ...settings.composerDrafts };
    for (const [key, draft] of Object.entries(composerDraftChanges ?? {})) {
      if (draft === null) delete drafts[key];
      else drafts[key] = draft;
    }
    settings = {
      ...settings,
      ...safePatch,
      ...(composerDraftChanges ? { composerDrafts: drafts } : {}),
      ...(remotePassword !== undefined
        ? { remotePasswordConfigured: typeof remotePassword === 'string' && remotePassword.length >= 8 }
        : {}),
    };
    if (performanceFixture) sessionStorage.setItem('ember-performance-settings', JSON.stringify(settings));
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
    if (url.pathname === '/api/message-queue' && method === 'GET') {
      return delay(ok(queueSnapshot(instanceId)));
    }
    const queueMatch = url.pathname.match(/^\/api\/message-queue\/sessions\/([^/]+)\/items$/);
    if (queueMatch && method === 'POST') {
      const sessionId = decodeURIComponent(queueMatch[1]);
      const session = list.find((entry) => entry.id === sessionId);
      const item = (body as { item?: Omit<MockQueuedMessage, 'id' | 'createdAt'> })?.item;
      if (!session || !item?.sendConfig) return { ok: false, status: 404, data: null };
      const queued: MockQueuedMessage = {
        ...item,
        id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
      };
      queuedMessages[instanceId] ??= {};
      queuedMessages[instanceId][sessionId] = [...queuedMessages[instanceId][sessionId] ?? [], queued].slice(-20);
      queueRevision += 1;
      if (session.status !== 'busy') setTimeout(() => deliverQueuedMessage(instanceId, sessionId), 150);
      return delay(ok(queueMutation(instanceId, sessionId, queued.id)));
    }
    const queuedItemMatch = url.pathname.match(/^\/api\/message-queue\/sessions\/([^/]+)\/items\/([^/]+)$/);
    if (queuedItemMatch && method === 'DELETE') {
      const sessionId = decodeURIComponent(queuedItemMatch[1]);
      const itemId = decodeURIComponent(queuedItemMatch[2]);
      const items = queuedMessages[instanceId]?.[sessionId] ?? [];
      queuedMessages[instanceId] ??= {};
      queuedMessages[instanceId][sessionId] = items.filter((item) => item.id !== itemId);
      if (queuedMessages[instanceId][sessionId].length === 0) delete queuedMessages[instanceId][sessionId];
      queueRevision += 1;
      return delay(ok(queueMutation(instanceId, sessionId)));
    }
    const queuedItemTakeMatch = url.pathname.match(/^\/api\/message-queue\/sessions\/([^/]+)\/items\/([^/]+)\/take$/);
    if (queuedItemTakeMatch && method === 'POST') {
      const sessionId = decodeURIComponent(queuedItemTakeMatch[1]);
      const itemId = decodeURIComponent(queuedItemTakeMatch[2]);
      const items = queuedMessages[instanceId]?.[sessionId] ?? [];
      const index = items.findIndex((item) => item.id === itemId);
      if (index === -1) return { ok: false, status: 404, data: null };
      const [item] = items.splice(index, 1);
      if (items.length === 0) delete queuedMessages[instanceId][sessionId];
      queueRevision += 1;
      return delay(ok({ ...queueMutation(instanceId, sessionId), item }));
    }
    const queueOrderMatch = url.pathname.match(/^\/api\/message-queue\/sessions\/([^/]+)\/order$/);
    if (queueOrderMatch && method === 'PUT') {
      const sessionId = decodeURIComponent(queueOrderMatch[1]);
      const items = queuedMessages[instanceId]?.[sessionId] ?? [];
      const itemIds = (body as { itemIds?: string[] })?.itemIds ?? [];
      const byId = new Map(items.map((item) => [item.id, item]));
      if (itemIds.length !== items.length || itemIds.some((id) => !byId.has(id))) {
        return { ok: false, status: 400, data: null };
      }
      queuedMessages[instanceId] ??= {};
      queuedMessages[instanceId][sessionId] = itemIds.map((id) => byId.get(id)!);
      queueRevision += 1;
      return delay(ok(queueMutation(instanceId, sessionId)));
    }
    if (path === '/api/config/settings') return delay(ok({ projects: projects[instanceId] ?? [] }));
    const scheduledMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/scheduled-tasks$/);
    if (scheduledMatch && method === 'GET') {
      return delay(ok({ tasks: scheduledTasks[decodeURIComponent(scheduledMatch[1])] ?? [] }));
    }
    if (scheduledMatch && method === 'PUT') {
      const projectId = decodeURIComponent(scheduledMatch[1]);
      const task = (body as { task?: Record<string, unknown> })?.task;
      if (!task || typeof task.id !== 'string') return { ok: false, status: 400, data: { error: 'task is required' } };
      const tasks = scheduledTasks[projectId] ?? (scheduledTasks[projectId] = []);
      const index = tasks.findIndex((entry) => (entry as { id?: string }).id === task.id);
      if (index === -1) tasks.push(task);
      else tasks[index] = task;
      return delay(ok({ tasks, task, created: index === -1 }));
    }
    const scheduledRunMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/scheduled-tasks\/([^/]+)\/run$/);
    if (scheduledRunMatch && method === 'POST') {
      const tasks = scheduledTasks[decodeURIComponent(scheduledRunMatch[1])] ?? [];
      const task = tasks.find((entry) => (entry as { id?: string }).id === decodeURIComponent(scheduledRunMatch[2]));
      if (!task) return { ok: false, status: 404, data: { error: 'Task not found or disabled' } };
      return delay(ok({ ok: true, sessionId: 'ses_a1' }));
    }
    /** v2 `Session.Info` wire record — `location.directory`, `time.*`, `Model.Ref` fields. */
    const sessionInfo = (session: MockSession) => ({
      id: session.id,
      title: session.title,
      location: { directory: session.directory },
      time: { created: session.updated - session.messages.length * 5000, updated: session.updated, archived: session.archived },
      model: session.model ? { id: session.model.id, providerID: session.model.providerID, variant: session.model.variant } : undefined,
    });
    if (url.pathname === '/api/session' && method === 'GET') {
      const directory = url.searchParams.get('directory');
      const filtered = [...list]
        .filter((s) => !directory || s.directory === directory)
        .sort((a, b) => b.updated - a.updated);
      const offset = Number(url.searchParams.get('cursor')?.replace('off:', '') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 50);
      const page = filtered.slice(offset, offset + limit);
      const next = offset + limit < filtered.length ? `off:${offset + limit}` : undefined;
      return delay(ok({ data: page.map(sessionInfo), cursor: { next: next ?? null } }));
    }
    const updateMatch = url.pathname.match(/^\/api\/session\/([^/]+)$/);
    if (updateMatch && method === 'PATCH') {
      const session = list.find((s) => s.id === decodeURIComponent(updateMatch[1]));
      if (!session) return { ok: false, status: 404, data: null };
      // OpenCode 2's PATCH updates the title; archiving lives on OpenChamber's own routes.
      const title = (body as { title?: string })?.title;
      if (typeof title === 'string' && title.trim()) session.title = title.trim();
      session.updated = Date.now();
      return delay(ok({ data: sessionInfo(session) }));
    }
    if (url.pathname === '/api/session' && method === 'POST') {
      const directory =
        String((body as { location?: { directory?: string } })?.location?.directory ?? '') ||
        String((body as { directory?: string })?.directory ?? '');
      const created: MockSession = {
        id: `ses_${Math.random().toString(36).slice(2, 8)}`,
        title: 'New agent',
        directory,
        updated: Date.now(),
        status: 'idle',
        messages: [],
      };
      list.unshift(created);
      return delay(ok({ data: sessionInfo(created) }));
    }
    const forkMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/fork$/);
    if (forkMatch && method === 'POST') {
      const source = list.find((s) => s.id === decodeURIComponent(forkMatch[1]));
      if (!source) return { ok: false, status: 404, data: null };
      // OpenCode 2's fork only copies history; the handoff prompt arrives as a separate prompt.
      const forked: MockSession = {
        id: `ses_${Math.random().toString(36).slice(2, 8)}`,
        title: `${source.title ?? source.id} (handoff)`,
        directory: source.directory,
        updated: Date.now(),
        status: 'idle',
        model: source.model,
        messages: [...source.messages],
      };
      list.unshift(forked);
      return delay(ok({ data: sessionInfo(forked) }));
    }
    const archiveMatch = url.pathname.match(/^\/api\/openchamber\/sessions\/(archive|unarchive)$/);
    if (archiveMatch && method === 'POST') {
      const archiving = archiveMatch[1] === 'archive';
      const ids = ((body as { ids?: unknown[] })?.ids ?? []).map(String);
      const failedIds: string[] = [];
      const changed: string[] = [];
      ids.forEach((id) => {
        const session = list.find((s) => s.id === id);
        if (!session) { failedIds.push(id); return; }
        session.archived = archiving ? Date.now() : undefined;
        changed.push(id);
      });
      return delay(ok(archiving ? { archived: changed, failedIds } : { restored: changed, failedIds }));
    }
    if (path === '/api/sessions/status') {
      return delay(ok({ sessions: Object.fromEntries(list.map((s) => [s.id, { status: s.status }])) }));
    }
    if (url.pathname === '/api/session/active' && method === 'GET') {
      return delay(ok({
        data: Object.fromEntries(
          list.filter((s) => s.status === 'busy').map((s) => [s.id, { type: 'running' }])
        ),
      }));
    }
    // Server-side YOLO policy. The ssh instance plays an older OpenChamber without the route so
    // the local-override fallback stays exercised.
    if (url.pathname === '/api/permission-auto-accept' && method === 'GET') {
      if (instanceId !== 'local') return { ok: false, status: 404, data: null };
      return delay(ok({ sessions: { ...autoAccept }, revision: autoAcceptRevision }));
    }
    const autoAcceptMatch = url.pathname.match(/^\/api\/permission-auto-accept\/sessions\/([^/]+)$/);
    if (autoAcceptMatch && method === 'PUT') {
      if (instanceId !== 'local') return { ok: false, status: 404, data: null };
      const enabled = (body as { enabled?: unknown } | undefined)?.enabled;
      if (typeof enabled !== 'boolean') return { ok: false, status: 400, data: { error: 'enabled must be a boolean' } };
      autoAccept[decodeURIComponent(autoAcceptMatch[1])] = enabled;
      autoAcceptRevision += 1;
      return delay(ok({ sessions: { ...autoAccept }, revision: autoAcceptRevision }));
    }
    // Pending forms (v2 "questions"): { location, data: Form.Info[] } scoped by location[directory].
    if (url.pathname === '/api/form' && method === 'GET') {
      const directory = url.searchParams.get('location[directory]') ?? undefined;
      const data = (forms[instanceId] ?? []).map((form) => ({
        id: form.id,
        sessionID: form.sessionID,
        fields: form.fields,
      }));
      return delay(ok({ location: { directory: directory ?? null }, data }));
    }
    const formMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/form\/([^/]+)(\/reply)?$/);
    if (formMatch && (method === 'POST' || method === 'DELETE')) {
      const sessionId = decodeURIComponent(formMatch[1]);
      const formId = decodeURIComponent(formMatch[2]);
      const isReply = Boolean(formMatch[3]);
      if ((method === 'POST') !== isReply) return { ok: false, status: 404, data: null };
      const pending = forms[instanceId] ?? [];
      const index = pending.findIndex((q) => q.id === formId && q.sessionID === sessionId);
      if (index === -1) return { ok: false, status: 404, data: null };
      const [request] = pending.splice(index, 1);
      const session = list.find((s) => s.id === request.sessionID);
      const last = session?.messages[session.messages.length - 1];
      const tool = last?.tools?.find((t) => t.tool === 'question');
      if (tool) tool.status = isReply ? 'completed' : 'error';
      if (session && last) {
        last.open = false;
        const answer = (body as { answer?: Record<string, unknown> })?.answer;
        session.messages.push({
          role: 'assistant',
          text: answer ? `Got it: ${Object.values(answer).flat().join(' / ')}.` : 'Okay, skipping that.',
        });
        session.status = 'idle';
      }
      return delay(ok({}));
    }
    const interruptMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/interrupt$/);
    if (interruptMatch && method === 'POST') {
      const session = list.find((s) => s.id === decodeURIComponent(interruptMatch[1]));
      const last = session?.messages[session.messages.length - 1];
      if (session && last) {
        last.open = false;
        last.tools?.forEach((t) => { if (t.status === 'running' || t.status === 'pending') { t.status = 'error'; t.error = 'Aborted'; } });
        session.status = 'idle';
      }
      return delay(ok({}));
    }
    const compactMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/compact$/);
    if (compactMatch && method === 'POST') {
      const session = list.find((s) => s.id === decodeURIComponent(compactMatch[1]));
      if (session && session.messages.length > 2) {
        // Summarize the older turns and keep the tail, mirroring what the server does.
        session.messages = [
          { role: 'assistant', text: 'Compacted the earlier turns into a summary to free up context.' },
          ...session.messages.slice(-2),
        ];
      }
      return delay(ok({}));
    }
    // Pending permission requests: { location, data: Permission.Request[] }.
    if (url.pathname === '/api/permission/request' && method === 'GET') {
      const directory = url.searchParams.get('location[directory]') ?? undefined;
      return delay(ok({
        location: { directory: directory ?? null },
        data: permissions[instanceId] ?? [],
      }));
    }
    const permissionReplyMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/permission\/([^/]+)\/reply$/);
    if (permissionReplyMatch && method === 'POST') {
      const sessionId = decodeURIComponent(permissionReplyMatch[1]);
      const requestId = decodeURIComponent(permissionReplyMatch[2]);
      const pending = permissions[instanceId] ?? [];
      const index = pending.findIndex((p) => p.id === requestId && p.sessionID === sessionId);
      if (index === -1) return { ok: false, status: 404, data: null };
      const [request] = pending.splice(index, 1);
      const session = list.find((s) => s.id === request.sessionID);
      const approved = (body as { decision?: string })?.decision !== 'reject';
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
      return delay(ok({}));
    }
    const messageMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/message$/);
    if (messageMatch && method === 'GET') {
      const session = list.find((s) => s.id === decodeURIComponent(messageMatch[1]));
      const records = (session?.messages ?? []).map((m, i, all) => {
        const id = `${session?.id}-${i}`;
        const created = (session?.updated ?? Date.now()) - (all.length - i) * 5000;
        const model = session?.model ?? { id: 'claude-sonnet', providerID: 'anthropic' };
        const modelRef = { providerID: model.providerID, id: model.id, variant: model.variant };
        if (m.role === 'user') {
          return {
            id,
            type: 'user' as const,
            sessionID: session?.id,
            time: { created },
            text: m.text,
            model: modelRef,
            files: (m.files ?? []).map((file) => ({
              name: file.filename,
              mime: file.mime,
              source: { uri: file.url },
            })),
          };
        }
        return {
          id,
          type: 'assistant' as const,
          sessionID: session?.id,
          time: m.open ? { created } : { created, completed: created + 2400 },
          model: modelRef,
          content: toParts(m, id),
          error: m.error ? { name: 'APIError', data: { message: m.error, statusCode: 400 } } : undefined,
          // First assistant turn writes the prefix; later ones read it back, like a real provider.
          tokens: m.open || m.error
            ? undefined
            : i <= 1
              ? { input: 1800, output: 240, reasoning: 0, cache: { read: 0, write: 9200 } }
              : { input: 400 + i * 60, output: 180, reasoning: 0, cache: { read: 9200 + i * 300, write: 0 } },
          // A plausible per-turn USD cost so the footer's cost/tok-s fields are exercised.
          cost: m.open || m.error ? undefined : 0.0123,
        };
      });
      // v2 pagination: `order` picks the first page's direction, `cursor` continues it.
      const ordered = url.searchParams.get('order') === 'desc' ? [...records].reverse() : records;
      const cursor = url.searchParams.get('cursor');
      const offset = Number(cursor?.replace('off:', '') ?? 0);
      const limitParam = Number(url.searchParams.get('limit'));
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : ordered.length;
      const page = ordered.slice(offset, offset + limit);
      const next = offset + limit < ordered.length ? `off:${offset + limit}` : null;
      return delay(ok({ data: page, cursor: { next } }));
    }
    // Sticky session settings in v2: model/agent are pushed before the prompt lands.
    const modelMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/model$/);
    if (modelMatch && method === 'POST') {
      const session = list.find((s) => s.id === decodeURIComponent(modelMatch[1]));
      const ref = (body as { model?: { providerID?: string; id?: string; variant?: string } })?.model;
      if (!session || !ref?.providerID || !ref?.id) return { ok: false, status: 400, data: { error: 'model ref required' } };
      session.model = { id: ref.id, providerID: ref.providerID, variant: ref.variant };
      return delay(ok({}));
    }
    const agentMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/agent$/);
    if (agentMatch && method === 'POST') {
      const session = list.find((s) => s.id === decodeURIComponent(agentMatch[1]));
      if (!session) return { ok: false, status: 404, data: null };
      return delay(ok({}));
    }
    const syntheticMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/synthetic$/);
    if (syntheticMatch && method === 'POST') {
      const session = list.find((s) => s.id === decodeURIComponent(syntheticMatch[1]));
      if (!session) return { ok: false, status: 404, data: null };
      return delay(ok({}));
    }
    const promptMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/prompt$/);
    if (promptMatch && method === 'POST') {
      const session = list.find((s) => s.id === decodeURIComponent(promptMatch[1]));
      const prompt = body as {
        id?: string;
        text?: string;
        files?: Array<{ uri?: string; name?: string }>;
        agents?: Array<{ name?: string }>;
      };
      const text = prompt?.text ?? '';
      const files = (prompt?.files ?? []).map((file) => ({
        filename: file.name ?? 'file',
        mime: '',
        url: file.uri ?? '',
      }));
      if (session) {
        session.messages.push({ role: 'user', text, files });
        session.updated = Date.now();
        session.status = 'busy';
        setTimeout(() => {
          session.messages.push({ role: 'assistant', text: `Echo from ${instanceId}: ${text}` });
          session.status = 'idle';
          setTimeout(() => deliverQueuedMessage(instanceId, session.id), 100);
        }, 1800);
      }
      return delay(ok({}));
    }
    // v2 provider list: `Provider.Info[]` with display names.
    if (path === '/api/provider') {
      return delay(ok({
        data: [
          { id: 'anthropic', name: 'Anthropic', activation: 'enabled', package: 'opencode' },
          { id: 'openai', name: 'OpenAI', activation: 'enabled', package: 'opencode' },
          { id: 'router', name: 'Router', activation: 'enabled', package: 'opencode' },
          { id: 'unused', name: 'Unused', activation: 'enabled', package: 'opencode' },
        ],
      }));
    }
    // v2 model catalogue: flat `Model.Info[]` under `data`; the default is a separate route.
    if (path === '/api/model' || path === '/api/model/default') {
      const model = (providerID: string, id: string, name: string, extra: Record<string, unknown> = {}) => ({
        providerID,
        id,
        modelID: id,
        name,
        family: name.split(' ')[0],
        status: 'active',
        time: { released: Date.parse('2026-05-01') },
        enabled: true,
        capabilities: { tools: true, input: ['text', 'image'], output: ['text'] },
        cost: [{ input: 3, output: 15, cache: { read: 0.3, write: 3.75 } }],
        limit: { context: 200_000, output: 64_000 },
        variants: [{ id: 'low' }, { id: 'medium' }, { id: 'high' }],
        ...extra,
      });
      const catalogue = [
        model('anthropic', 'claude-sonnet', 'Claude Sonnet'),
        model('anthropic', 'claude-opus', 'Claude Opus', { cost: [{ input: 15, output: 75, cache: { read: 1.5, write: 18.75 } }], limit: { context: 1_000_000, output: 128_000 } }),
        model('openai', 'gpt-5', 'GPT-5', { capabilities: { tools: true, input: ['text'], output: ['text'] } }),
        ...Array.from({ length: 60 }, (_, i) =>
          model('router', `router-${i}`, `Router Model ${i}`, { cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }], variants: [], status: i % 20 === 7 ? 'beta' : 'active' })
        ),
        // Disabled entries exist in the catalogue but never reach the picker.
        model('unused', 'x', 'Should not appear', { enabled: false }),
      ];
      const missing = performanceFixture ? new URLSearchParams(window.location.search).get('missingModel') : null;
      const visible = missing
        ? catalogue.filter((entry) => `${entry.providerID}/${entry.id}` !== missing)
        : catalogue;
      if (path === '/api/model/default') {
        return delay(ok({ data: { providerID: 'anthropic', id: 'claude-sonnet' } }));
      }
      return delay(ok({ data: visible }));
    }
    return { ok: false, status: 404, data: null };
  },
};

declare global {
  interface Window {
    emberFixture?: { releaseSlowInstance: () => void; appendMessage: (text: string, sessionId?: string, silent?: boolean) => void };
  }
}
if (performanceFixture) window.emberFixture = { releaseSlowInstance, appendMessage: appendFixtureMessage };
window.ember = bridge;
