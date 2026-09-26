import { sessionKey } from './types';
import { shareValue } from './lib/structuralSharing';
import { canonicalVariant, selectedModelError } from './lib/modelSelection';
import type {
  BallState,
  ChatMessage,
  FileAttachment,
  Instance,
  MessagePart,
  MessageQueueMutation,
  MessageQueueSession,
  MessageQueueSnapshot,
  MessageQueueTakeMutation,
  ModelDetails,
  ModelOption,
  ModelRef,
  PermissionReply,
  PermissionRequest,
  Project,
  QuestionAnswers,
  QuestionRequest,
  QueuedMessage,
  Session,
  ToolCall,
  TokenUsage,
  ToolStatus,
} from './types';

export type ModelList = {
  models: ModelOption[];
  defaultModelId: string | null;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const errorMessageOf = (value: unknown, depth = 0): string | undefined => {
  if (typeof value === 'string') return value.trim().slice(0, 4000) || undefined;
  if (!value || typeof value !== 'object' || depth > 3) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ['message', 'detail', 'reason', 'responseBody']) {
    const message = errorMessageOf(record[key], depth + 1);
    if (message) return message;
  }
  for (const key of ['error', 'data', 'cause']) {
    const message = errorMessageOf(record[key], depth + 1);
    if (message) return message;
  }
  if (typeof record.name === 'string') {
    return record.name.replace(/([a-z])([A-Z])/g, '$1 $2').trim().slice(0, 4000) || undefined;
  }
  if (typeof record._tag === 'string') {
    return record._tag.replace(/([a-z])([A-Z])/g, '$1 $2').trim().slice(0, 4000) || undefined;
  }
  return undefined;
};

const nonNegative = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

/** `info.tokens` as OpenCode reports it: `{ input, output, reasoning, cache: { read, write } }`. */
const toTokenUsage = (value: unknown): TokenUsage | undefined => {
  const raw = asRecord(value);
  const cache = asRecord(raw.cache);
  const usage = {
    input: nonNegative(raw.input),
    output: nonNegative(raw.output),
    cacheRead: nonNegative(cache.read),
    cacheWrite: nonNegative(cache.write),
  };
  // Providers that don't report usage send zeros or nothing; treat that as "unknown", not "0".
  return usage.input + usage.output + usage.cacheRead + usage.cacheWrite > 0 ? usage : undefined;
};

const isAbortError = (value: unknown): boolean => {
  const record = asRecord(value);
  const name = `${record.name ?? ''} ${record._tag ?? ''} ${record.type ?? ''} ${record.message ?? ''} ${typeof value === 'string' ? value : ''}`;
  return /abort|interrupt/i.test(name);
};

const baseName = (value: string): string => {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed.split('/').pop() || trimmed;
};

export const listInstances = async (refresh = true): Promise<Instance[]> =>
  asArray(await window.ember.listInstances(refresh)) as Instance[];

/** `null` means the request failed; callers keep whatever they already had. */
export const loadProjects = async (instanceId: string): Promise<Project[] | null> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/config/settings');
  if (!response.ok) return null;
  const root = asRecord(response.data);
  const paths = new Set<string>();

  return asArray(root.projects)
    .map((entry, index) => {
      const item = asRecord(entry);
      const path = typeof item.path === 'string' ? item.path : undefined;
      const id = String(item.id ?? path ?? `project-${index}`);
      const label = typeof item.label === 'string' && item.label ? item.label : undefined;
      const name = typeof item.name === 'string' && item.name ? item.name : undefined;

      const lastOpenedAt = typeof item.lastOpenedAt === 'number' ? item.lastOpenedAt : undefined;
      return { id, name: label ?? name ?? (path ? baseName(path) : id), path, lastOpenedAt };
    })
    .filter((project) => {
      if (!project.path) return true;
      if (paths.has(project.path)) return false;
      paths.add(project.path);
      return true;
    });
};

const SESSION_PAGE_SIZE = 200;
const SESSION_MAX_PAGES = 10;
const partialSessionLists = new WeakSet<Session[]>();
export const isPartialSessionList = (sessions: Session[]): boolean => partialSessionLists.has(sessions);

const toSession = (instanceId: string, entry: unknown, index: number): Session => {
  const item = asRecord(entry);
  const time = asRecord(item.time);
  const location = asRecord(item.location);
  const updated =
    typeof time.updated === 'number'
      ? time.updated
      : typeof time.created === 'number'
        ? time.created
        : undefined;

  const model = asRecord(item.model);
  const modelID = typeof model.id === 'string' ? model.id : typeof model.modelID === 'string' ? model.modelID : '';
  const providerID = typeof model.providerID === 'string' ? model.providerID : '';
  const variant = typeof model.variant === 'string' && model.variant ? model.variant : undefined;
  const agent = typeof item.agent === 'string' && item.agent ? item.agent : undefined;
  // OpenCode 2 scopes the session to `location.directory`; the flat `directory` field is the
  // v1 spelling kept for any proxy that still sends it.
  const directory = optionalString(location.directory) ?? optionalString(item.directory);

  return {
    id: String(item.id ?? `session-${index}`),
    instanceId,
    title: typeof item.title === 'string' ? item.title : undefined,
    directory,
    updated,
    archived: typeof time.archived === 'number' && time.archived > 0 ? time.archived : undefined,
    model: modelID && providerID ? { providerID, modelID, variant } : undefined,
    agent,
    parentId: typeof item.parentID === 'string' && item.parentID ? item.parentID : undefined,
  };
};

/**
 * Sessions including archived ones. OpenCode 2's list always includes archived rows and
 * carries `time.archived` on each record (OpenChamber folds its own archive store back in),
 * so the active/archived split still happens client-side.
 *
 * Pages are walked with the opaque `cursor.next` the server returns in `{ data, cursor }`;
 * `parentID=null` keeps subagent sessions out at the source, and the client filter stays as
 * a backstop.
 */
const payloadArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const root = asRecord(value);
  return asArray((root.data ?? root.sessions ?? root.messages ?? root.permissions) as unknown);
};

/** Opaque continuation token from a `{ data, cursor: { next } }` list envelope. */
const nextCursorOf = (value: unknown): string | undefined =>
  optionalString(asRecord(asRecord(value).cursor).next);

export const loadSessions = async (
  instanceId: string,
  directory?: string,
  maxPages = SESSION_MAX_PAGES
): Promise<Session[] | null> => {
  const sessions: Session[] = [];
  let complete = false;
  const seen = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const query = cursor
      ? `cursor=${encodeURIComponent(cursor)}${directory ? `&directory=${encodeURIComponent(directory)}` : ''}`
      : `limit=${SESSION_PAGE_SIZE}&order=desc&parentID=null${directory ? `&directory=${encodeURIComponent(directory)}` : ''}`;
    const response = await window.ember.request(instanceId, 'GET', `/api/session?${query}`);
    if (!response.ok) {
      if (page === 0) return null;
      partialSessionLists.add(sessions);
      return sessions;
    }

    const batch = payloadArray(response.data);
    batch.forEach((entry, index) => {
      const session = toSession(instanceId, entry, sessions.length + index);
      // Subagent sessions belong to their parent's transcript; `parentID=null` should keep
      // them out already, but the filter stays so odd pages can't leak them in.
      if (session.parentId || seen.has(session.id)) return;
      seen.add(session.id);
      sessions.push(session);
    });

    const next = nextCursorOf(response.data);
    if (!next || next === cursor || batch.length === 0) { complete = true; break; }
    cursor = next;
  }

  if (!complete) partialSessionLists.add(sessions);
  return sessions;
};

/**
 * Archive (or restore) a session. OpenCode 2 has no route that sets `time.archived`, so
 * OpenChamber owns archive state itself in a per-instance store and folds it back into the
 * session records it proxies. Both directions are batched calls; `failedIds` reports rejects.
 */
export const setSessionArchived = async (
  session: Session,
  archived: boolean
): Promise<boolean> => {
  const response = await window.ember.request(
    session.instanceId,
    'POST',
    `/api/openchamber/sessions/${archived ? 'archive' : 'unarchive'}`,
    { ids: [session.id] }
  );
  if (!response.ok) return false;
  const failed = asArray(asRecord(response.data).failedIds).map(String);
  return !failed.includes(session.id);
};

/** Rename a session on its OpenChamber instance (`PATCH /api/session/:id` `{ title }`). */
export const renameSession = async (session: Session, title: string): Promise<boolean> => {
  const response = await window.ember.request(
    session.instanceId,
    'PATCH',
    `/api/session/${encodeURIComponent(session.id)}`,
    { title }
  );
  return response.ok;
};

/**
 * Compact a session's context (`POST /api/session/:id/compact`): older turns are summarized and
 * a recent tail kept, per the instance's `compaction` config. OpenCode 2 runs it as an inbox
 * item with the session's own model, so no provider/model is passed. Returns whether the
 * instance accepted it; the transcript updates when the next poll sees the compaction.
 */
export const compactSession = async (
  session: Session,
  _model?: ModelRef
): Promise<boolean> => {
  const response = await window.ember.request(
    session.instanceId,
    'POST',
    `/api/session/${encodeURIComponent(session.id)}/compact`,
    {}
  );
  return response.ok;
};

/** Seeded into a forked session so the agent opens the new one with a written handoff brief. */
export const HANDOFF_PROMPT =
  'You are continuing in a new session forked from a previous one. Before we carry on, write a concise handoff summary: what we were working on, the tools and skills you used, and the current state plus the next step. Then stop and wait for my instruction.';

/**
 * Fork a session into a new one (`POST /api/session/:id/fork`) and seed it with a handoff
 * prompt — OpenCode 2's fork only copies history, so the prompt is a separate call. The source
 * session is left untouched while the new session carries the summarized context. Returns the
 * new session id.
 */
export const forkSession = async (session: Session, prompt: string): Promise<string | null> => {
  const response = await window.ember.request(
    session.instanceId,
    'POST',
    `/api/session/${encodeURIComponent(session.id)}/fork`,
    {}
  );
  if (!response.ok) return null;
  const forked = asRecord(asRecord(response.data).data);
  const forkedId = optionalString(forked.id);
  if (!forkedId) return null;
  const seeded = await window.ember.request(
    session.instanceId,
    'POST',
    `/api/session/${encodeURIComponent(forkedId)}/prompt`,
    { text: prompt }
  );
  return seeded.ok ? forkedId : null;
};

/**
 * Load sessions from every instance. Returns a map keyed by instance id so a failing
 * instance leaves its previous sessions untouched instead of erasing them.
 */
export const loadAllSessions = async (
  instanceIds: string[],
  directoryHints: Record<string, string[]> = {},
  maxPages = SESSION_MAX_PAGES
): Promise<Record<string, Session[]>> => {
  const results = await Promise.all(
    instanceIds.map(async (instanceId) => {
      const directories = directoryHints[instanceId] ?? [];
      const lists = await Promise.all([
        loadSessions(instanceId, undefined, maxPages),
        ...directories.map((directory) => loadSessions(instanceId, directory, maxPages)),
      ]);
      const successful = lists.filter((list): list is Session[] => list !== null);
      if (successful.length === 0) return null;

      const seen = new Set<string>();
      const merged: Session[] = [];
      successful
        .flat()
        .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
        .forEach((session) => {
          if (seen.has(session.id)) return;
          seen.add(session.id);
          merged.push(session);
        });
      if (successful.length !== lists.length || successful.some(isPartialSessionList)) partialSessionLists.add(merged);
      return [instanceId, merged] as const;
    })
  );
  return Object.fromEntries(
    results.filter((entry): entry is readonly [string, Session[]] => entry !== null)
  );
};

const newerSession = (a: Session, b: Session): Session =>
  (b.updated ?? 0) > (a.updated ?? 0) ? b : shareValue(b, a);

/**
 * Applies a poll result on top of the current lists. The poll is authoritative for which
 * sessions exist, but a local optimistic bump (send, archive, create) may be newer than what
 * the server has indexed yet, so per session the copy with the later `updated` wins.
 * `preserved` sessions are kept even when the poll doesn't list them.
 */
export const mergePolledSessions = (
  current: Record<string, Session[]>,
  polled: Record<string, Session[]>,
  preserved: Session[]
): Record<string, Session[]> => {
  const merged: Record<string, Session[]> = { ...current };
  Object.entries(polled).forEach(([instanceId, list]) => {
    const previous = new Map((current[instanceId] ?? []).map((session) => [session.id, session]));
    merged[instanceId] = list.map((session) => {
      const local = previous.get(session.id);
      previous.delete(session.id);
      return local ? newerSession(session, local) : session;
    });
    if (isPartialSessionList(list)) merged[instanceId].push(...previous.values());
  });
  preserved.forEach((session) => {
    const list = merged[session.instanceId] ?? [];
    const index = list.findIndex((entry) => entry.id === session.id);
    merged[session.instanceId] =
      index === -1
        ? [session, ...list]
        : list.map((entry, i) => (i === index ? newerSession(entry, session) : entry));
  });
  return shareValue(current, merged);
};

/** Only instances that answered are present; a failed instance keeps its previous projects. */
export const loadAllProjects = async (
  instanceIds: string[]
): Promise<Record<string, Project[]>> => {
  const results = await Promise.all(
    instanceIds.map(async (instanceId) => [instanceId, await loadProjects(instanceId)] as const)
  );
  return Object.fromEntries(
    results.filter((entry): entry is readonly [string, Project[]] => entry[1] !== null)
  );
};

export type ScheduledTaskState = {
  lastSessionId?: string;
  lastStatus?: string;
  lastError?: string;
  lastRunAt?: number;
  nextRunAt?: number;
};

/**
 * A task as OpenChamber stores it. `raw` is the instance's own JSON, replayed verbatim on update
 * so fields Ember doesn't model (schedule, goal, auto-accept, loop provenance) survive a write.
 */
export type ScheduledTask = {
  key: string;
  instanceId: string;
  projectId: string;
  projectName?: string;
  id: string;
  name: string;
  enabled: boolean;
  model?: ModelRef;
  state: ScheduledTaskState;
  raw: Record<string, unknown>;
};

export type ScheduledIdentityData = {
  bindings: Record<string, string>;
  taskNames: Record<string, string>;
  tasks: ScheduledTask[];
};

export const scheduledTaskKey = (instanceId: string, projectId: string, taskId: string): string =>
  `task:${instanceId}::${projectId}::${taskId}`;

const toScheduledTask = (
  instanceId: string,
  projectId: string,
  projectName: string | undefined,
  entry: unknown
): ScheduledTask | null => {
  const task = asRecord(entry);
  const id = optionalString(task.id);
  if (!id) return null;
  const execution = asRecord(task.execution);
  const state = asRecord(task.state);
  const providerID = optionalString(execution.providerID);
  const modelID = optionalString(execution.modelID);
  const variant = optionalString(execution.variant);
  const lastRunAt = state.lastRunAt;
  const nextRunAt = state.nextRunAt;
  const model: ModelRef | undefined =
    providerID && modelID ? { providerID, modelID, ...(variant ? { variant } : {}) } : undefined;
  return {
    key: scheduledTaskKey(instanceId, projectId, id),
    instanceId,
    projectId,
    projectName,
    id,
    name: optionalString(task.name) ?? id,
    enabled: task.enabled !== false,
    model,
    state: {
      lastSessionId: optionalString(state.lastSessionId),
      lastStatus: optionalString(state.lastStatus),
      lastError: optionalString(state.lastError),
      lastRunAt: typeof lastRunAt === 'number' ? lastRunAt : undefined,
      nextRunAt: typeof nextRunAt === 'number' ? nextRunAt : undefined,
    },
    raw: task,
  };
};

export const loadScheduledIdentityData = async (
  instanceId: string,
  projects: Project[]
): Promise<ScheduledIdentityData> => {
  const results = await Promise.all(
    projects.map(async (project) => {
      const response = await window.ember.request(
        instanceId,
        'GET',
        `/api/projects/${encodeURIComponent(project.id)}/scheduled-tasks`
      );
      if (!response.ok) return [];
      const root = asRecord(response.data);
      return asArray(root.tasks ?? response.data)
        .map((entry) => toScheduledTask(instanceId, project.id, project.name, entry))
        .filter((task): task is ScheduledTask => Boolean(task));
    })
  );
  const bindings: Record<string, string> = {};
  const taskNames: Record<string, string> = {};
  const tasks = results.flat();
  tasks.forEach((task) => {
    taskNames[task.key] = task.name;
    if (task.state.lastSessionId) {
      bindings[sessionKey({ instanceId, sessionId: task.state.lastSessionId })] = task.key;
    }
  });
  return { bindings, taskNames, tasks };
};

/**
 * Start a task immediately (`POST …/scheduled-tasks/:id/run`). The server creates a fresh session
 * with the task's prompt and model, so this is the only way to "rerun" a scheduled task.
 */
export const runScheduledTask = async (
  instanceId: string,
  task: ScheduledTask
): Promise<{ ok: boolean; sessionId?: string; error?: string }> => {
  const response = await window.ember.request(
    instanceId,
    'POST',
    `/api/projects/${encodeURIComponent(task.projectId)}/scheduled-tasks/${encodeURIComponent(task.id)}/run`
  );
  if (!response.ok) {
    return { ok: false, error: errorMessageOf(response.data) ?? 'Could not run the scheduled task.' };
  }
  return { ok: true, sessionId: optionalString(asRecord(response.data).sessionId) };
};

/**
 * Change a task's model (and reasoning variant) by replaying its own JSON with a patched
 * `execution`. Returns the task the server stored, or an error message to surface.
 */
export const updateScheduledTaskModel = async (
  instanceId: string,
  task: ScheduledTask,
  model: ModelRef
): Promise<{ ok: boolean; task?: ScheduledTask; error?: string }> => {
  const execution: Record<string, unknown> = {
    ...asRecord(task.raw.execution),
    providerID: model.providerID,
    modelID: model.modelID,
  };
  if (model.variant) execution.variant = model.variant;
  else delete execution.variant;
  const response = await window.ember.request(
    instanceId,
    'PUT',
    `/api/projects/${encodeURIComponent(task.projectId)}/scheduled-tasks`,
    { task: { ...task.raw, execution } }
  );
  if (!response.ok) {
    return { ok: false, error: errorMessageOf(response.data) ?? 'Could not update the scheduled task.' };
  }
  const updated = toScheduledTask(instanceId, task.projectId, task.projectName, asRecord(response.data).task);
  return { ok: true, task: updated ?? undefined };
};

export const createSession = async (
  instanceId: string,
  directory?: string
): Promise<Session | null> => {
  // OpenCode 2 takes the working directory as a structured `location` object in the body.
  const response = await window.ember.request(
    instanceId,
    'POST',
    '/api/session',
    directory ? { location: { directory } } : {}
  );
  if (!response.ok) return null;

  const root = asRecord(response.data);
  const item = asRecord(root.data ?? response.data);
  const id = typeof item.id === 'string' ? item.id : '';
  if (!id) return null;

  return {
    id,
    instanceId,
    title: typeof item.title === 'string' ? item.title : undefined,
    directory: optionalString(asRecord(item.location).directory) ?? directory,
    updated: Date.now(),
  };
};

const statusToState = (raw: unknown): BallState => {
  const value = String(raw ?? '').toLowerCase();
  if (value.includes('error') || value.includes('fail')) return 'error';
  if (value.includes('attention') || value.includes('input') || value.includes('wait')) {
    return 'needs-input';
  }
  if (
    value.includes('busy') ||
    value.includes('active') ||
    value.includes('run') ||
    value.includes('work') ||
    value.includes('retry')
  ) {
    return 'active';
  }
  return 'idle';
};

/**
 * Ball states keyed by `sessionKey` so they can be merged across instances. Two sources are
 * merged: OpenChamber's `/api/sessions/status` (its own tracker — `pending` marks sessions
 * blocked on a permission or form) and OpenCode 2's `/api/session/active` (the running set).
 */
export const loadSessionStates = async (
  instanceId: string
): Promise<Record<string, BallState> | null> => {
  const [statusResponse, activeResponse] = await Promise.all([
    window.ember.request(instanceId, 'GET', '/api/sessions/status'),
    window.ember.request(instanceId, 'GET', '/api/session/active'),
  ]);
  if (!statusResponse.ok && !activeResponse.ok) return null;
  const states: Record<string, BallState> = {};

  const keyFor = (id: string) => sessionKey({ instanceId, sessionId: id });
  if (activeResponse.ok) {
    const active = asRecord(asRecord(activeResponse.data).data);
    Object.keys(active).forEach((id) => {
      states[keyFor(id)] = 'active';
    });
  }
  if (statusResponse.ok) {
    const root = asRecord(statusResponse.data);
    Object.entries(asRecord(root.sessions)).forEach(([id, value]) => {
      const entry = asRecord(value);
      const state = statusToState(entry.status ?? entry.state);
      // An "idle" verdict doesn't clear a busier state already seen elsewhere.
      if (state !== 'idle' || !states[keyFor(id)]) states[keyFor(id)] = state;
    });
    Object.keys(asRecord(root.pending)).forEach((id) => {
      states[keyFor(id)] = 'needs-input';
    });
  }

  return states;
};

export const loadAllSessionStates = async (
  instanceIds: string[]
): Promise<Record<string, Record<string, BallState>>> => {
  const results = await Promise.all(
    instanceIds.map(async (instanceId) => [instanceId, await loadSessionStates(instanceId)] as const)
  );
  const map: Record<string, Record<string, BallState>> = {};
  results.forEach(([instanceId, states]) => {
    if (states) map[instanceId] = states;
  });
  return map;
};

/** How many records a token-driven tail fetch asks for. Older servers may return more. */
export const MESSAGE_TAIL_LIMIT = 8;
/** Page size for full transcript loads; pages continue while `cursor.next` is set. */
const MESSAGE_PAGE_SIZE = 500;
const MESSAGE_MAX_PAGES = 40;

const messagesPath = (sessionId: string, params: URLSearchParams): string => {
  const query = params.toString();
  return `/api/session/${encodeURIComponent(sessionId)}/message${query ? `?${query}` : ''}`;
};

/**
 * OpenCode 2 returns `Session.Message.Info` records discriminated on `type`. Chat surfaces
 * `user` and `assistant` turns; `system`, `synthetic`, `skill`, `idle`, `compaction` and the
 * `*-switched` markers are context plumbing or lifecycle stamps and never render as bubbles.
 */
const normalizeMessages = (data: unknown): ChatMessage[] => {
  const list = payloadArray(data);
  return list
    .map((entry, index): ChatMessage | null => {
      const item = asRecord(entry);
      const type = optionalString(item.type) ?? optionalString(asRecord(item.info).role) ?? 'assistant';
      if (type !== 'user' && type !== 'assistant') return null;
      const role: ChatMessage['role'] = type === 'user' ? 'user' : 'assistant';
      const id = String(item.id ?? `msg-${index}`);
      const time = asRecord(item.time);
      const createdAt = typeof time.created === 'number' ? time.created : undefined;
      const completedAt = typeof time.completed === 'number' ? time.completed : undefined;

      const parts: MessagePart[] = [];
      if (role === 'user') {
        const text = optionalString(item.text) ?? '';
        if (text) parts.push({ type: 'text', id: `${id}-0`, text });
        asArray(item.files).forEach((file, fileIndex) => {
          const raw = asRecord(file);
          const source = asRecord(raw.source);
          const url =
            optionalString(source.uri) ??
            (optionalString(raw.data)
              ? `data:${optionalString(raw.mime) ?? 'application/octet-stream'};base64,${raw.data}`
              : undefined);
          if (!url) return;
          parts.push({
            type: 'file',
            id: `${id}-file-${fileIndex}`,
            file: {
              url,
              mime: optionalString(raw.mime) ?? 'application/octet-stream',
              filename: optionalString(raw.name) ?? 'attachment',
            },
          });
        });
      } else {
        asArray(item.content ?? item.parts).forEach((part, partIndex) => {
          const mapped = toMessagePart(part, `${id}-${partIndex}`);
          if (mapped) parts.push(mapped);
        });
      }

      const text = parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
      const rawModel = asRecord(item.model);
      const providerID = optionalString(rawModel.providerID);
      const modelID = optionalString(rawModel.id) ?? optionalString(rawModel.modelID);
      const variant = optionalString(rawModel.variant);
      const model = providerID && modelID ? { providerID, modelID, ...(variant ? { variant } : {}) } : undefined;
      const rawError = item.error;
      const error = role === 'assistant' ? errorMessageOf(rawError) : undefined;
      // A user-initiated stop is recorded as an error by OpenCode, but it isn't one for the rail.
      const aborted = error !== undefined && isAbortError(rawError);
      // User messages have no completion timestamp; assistants get one when the turn ends.
      const completed = role === 'user' || completedAt !== undefined || error !== undefined;
      const tokens = role === 'assistant' ? toTokenUsage(item.tokens) : undefined;
      const cost =
        role === 'assistant' && typeof item.cost === 'number' && Number.isFinite(item.cost)
          ? item.cost
          : undefined;
      return { id, role, text, parts, model, tokens, cost, error, aborted, createdAt, completedAt, completed };
    })
    .filter((message): message is ChatMessage => message !== null && (message.parts.length > 0 || Boolean(message.error)));
};

export const loadMessages = async (
  instanceId: string,
  sessionId: string,
  _directory?: string
): Promise<ChatMessage[]> => {
  const messages: ChatMessage[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < MESSAGE_MAX_PAGES; page += 1) {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    else {
      params.set('order', 'asc');
      params.set('limit', String(MESSAGE_PAGE_SIZE));
    }
    const response = await window.ember.request(instanceId, 'GET', messagesPath(sessionId, params));
    if (!response.ok) {
      if (page === 0) throw new Error(`Failed to load messages for ${sessionId}: ${response.status}`);
      return messages;
    }
    normalizeMessages(response.data).forEach((message) => {
      if (seen.has(message.id)) return;
      seen.add(message.id);
      messages.push(message);
    });
    const next = nextCursorOf(response.data);
    if (!next || next === cursor) break;
    cursor = next;
  }
  return messages;
};

/**
 * The latest `limit` records only: `order=desc` returns newest-first pages, which are flipped
 * back to chronological order for display.
 */
export const loadMessageTail = async (
  instanceId: string,
  sessionId: string,
  _directory?: string,
  limit = MESSAGE_TAIL_LIMIT
): Promise<ChatMessage[]> => {
  const params = new URLSearchParams();
  params.set('order', 'desc');
  params.set('limit', String(limit));
  const response = await window.ember.request(instanceId, 'GET', messagesPath(sessionId, params));
  if (!response.ok) {
    throw new Error(`Failed to load messages for ${sessionId}: ${response.status}`);
  }
  return normalizeMessages(response.data).slice(0, limit).reverse();
};

const TOOL_STATUSES: ToolStatus[] = ['pending', 'running', 'completed', 'error'];
const TOOL_OUTPUT_LIMIT = 20_000;

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

/**
 * Text, reasoning, file and tool parts; step markers, patches and snapshots are skipped.
 * OpenCode 2 tool parts carry a discriminated `state` (`streaming`→`running`→`completed`|
 * `error`) whose output is a `Tool.Content` list rather than a flat `output` string.
 */
const toMessagePart = (raw: unknown, fallbackId: string): MessagePart | null => {
  const part = asRecord(raw);
  const id = String(part.id ?? fallbackId);
  if (part.type === 'text' || part.type === 'reasoning') {
    if (asRecord(part.metadata).emberReplyContext === true) return null;
    const text = typeof part.text === 'string' ? part.text : '';
    return text ? { type: part.type, id, text } : null;
  }
  if (part.type === 'file') {
    const url = optionalString(part.url) ?? optionalString(part.uri);
    if (!url) return null;
    return {
      type: 'file',
      id,
      file: {
        url,
        mime: optionalString(part.mime) ?? 'application/octet-stream',
        filename: optionalString(part.filename) ?? optionalString(part.name) ?? 'attachment',
      },
    };
  }
  if (part.type === 'tool') {
    const state = asRecord(part.state);
    const metadata = asRecord(state.metadata);
    // `streaming` states carry `input` as a raw JSON fragment; object input starts at `running`.
    const input = asRecord(state.input);
    const rawStatus = String(state.status ?? 'pending');
    const status: ToolStatus =
      rawStatus === 'streaming'
        ? 'running'
        : (TOOL_STATUSES.find((entry) => entry === rawStatus) ?? 'pending');
    const output = toolContentText(state.content) ?? optionalString(state.output) ?? optionalString(state.result);
    const stateError = asRecord(state.error);
    const call: ToolCall = {
      id: String(part.callID ?? part.id ?? id),
      tool: String(part.name ?? part.tool ?? 'tool'),
      status,
      title: optionalString(state.title) ?? optionalString(metadata.title) ?? toolTitleFromInput(input),
      error: optionalString(stateError.message) ?? optionalString(state.error),
      input: Object.keys(input).length > 0 ? input : undefined,
      output: output && output.length > TOOL_OUTPUT_LIMIT ? `${output.slice(0, TOOL_OUTPUT_LIMIT)}\n… (truncated)` : output,
      diff: optionalString(metadata.diff) ?? optionalString(metadata.patch),
    };
    return { type: 'tool', id, call };
  }
  return null;
};

/** `Tool.Content` entries are `{ type: 'text', text }` or `{ type: 'file', uri, mime, name }`. */
const toolContentText = (value: unknown): string | undefined => {
  const chunks = asArray(value)
    .map((entry) => {
      const item = asRecord(entry);
      if (item.type === 'text') return optionalString(item.text) ?? '';
      if (item.type === 'file') {
        const name = optionalString(item.name) ?? optionalString(item.uri);
        return name ? `[file] ${name}` : '';
      }
      return optionalString(item.text) ?? '';
    })
    .filter((chunk) => chunk.length > 0);
  return chunks.length > 0 ? chunks.join('\n') : undefined;
};

/** Best-effort one-liner for a tool call before the server assigns a title. */
const toolTitleFromInput = (input: Record<string, unknown>): string | undefined => {
  for (const key of ['command', 'filePath', 'path', 'pattern', 'url', 'query', 'description']) {
    const value = input[key];
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
};

/**
 * OpenChamber's server-side permission auto-accept policy ("YOLO mode" in Ember): per session,
 * the server itself approves permission prompts, so it keeps working when Ember isn't looking.
 * `null` means the request failed; `{ supported: false }` means this instance predates the feature.
 */
export type AutoAcceptPolicy = { supported: boolean; sessions: Record<string, boolean> };

export const loadAutoAcceptPolicy = async (instanceId: string): Promise<AutoAcceptPolicy | null> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/permission-auto-accept');
  if (response.status === 404) return { supported: false, sessions: {} };
  if (!response.ok) return null;
  const raw = asRecord(asRecord(response.data).sessions);
  const sessions: Record<string, boolean> = {};
  Object.entries(raw).forEach(([sessionId, enabled]) => {
    if (typeof enabled === 'boolean') sessions[sessionId] = enabled;
  });
  return { supported: true, sessions };
};

export const loadAllAutoAcceptPolicies = async (
  instanceIds: string[]
): Promise<Record<string, AutoAcceptPolicy>> => {
  const results = await Promise.all(
    instanceIds.map(async (instanceId) => [instanceId, await loadAutoAcceptPolicy(instanceId)] as const)
  );
  return Object.fromEntries(
    results.filter((entry): entry is readonly [string, AutoAcceptPolicy] => entry[1] !== null)
  );
};

export const setAutoAccept = async (
  instanceId: string,
  sessionId: string,
  enabled: boolean,
  directory?: string
): Promise<{ ok: boolean; status: number }> => {
  const response = await window.ember.request(
    instanceId,
    'PUT',
    `/api/permission-auto-accept/sessions/${encodeURIComponent(sessionId)}`,
    { enabled, directory }
  );
  return { ok: response.ok, status: response.status };
};

/** Location-scoped list query — OpenCode 2 nests location filters as `location[directory]=`. */
const locationQuery = (directory?: string): string =>
  directory ? `?location[directory]=${encodeURIComponent(directory)}` : '';

/**
 * Pending permission requests across sessions in an instance or location scope.
 * OpenCode 2 answers `{ location, data: Permission.Request[] }` — each request is session-scoped
 * (`sessionID`), carries the permission `action` (e.g. `bash`), the concrete `resources` it wants
 * and a human-readable `message`.
 */
export const loadPermissions = async (
  instanceId: string,
  directory?: string
): Promise<PermissionRequest[] | null> => {
  const response = await window.ember.request(
    instanceId,
    'GET',
    `/api/permission/request${locationQuery(directory)}`
  );
  if (!response.ok) return null;
  const location = asRecord(asRecord(response.data).location);
  return payloadArray(response.data).map((entry) => {
    const item = asRecord(entry);
    const metadata = asRecord(item.metadata);
    const message = optionalString(item.message);
    return {
      id: String(item.id ?? ''),
      instanceId,
      sessionId: String(item.sessionID ?? item.sessionId ?? ''),
      directory: optionalString(location.directory) ?? optionalString(item.directory) ?? directory,
      permission: String(item.action ?? item.permission ?? item.type ?? 'tool'),
      patterns: asArray(item.resources ?? item.patterns).map(String),
      metadata: message ? { ...metadata, message } : metadata,
    };
  }).filter((request) => request.id && request.sessionId);
};

export const loadAllPermissions = async (
  instanceIds: string[],
  directoryHints: Record<string, string[]> = {}
): Promise<Record<string, PermissionRequest[]>> => {
  const results = await Promise.all(
    instanceIds.map(async (instanceId) => {
      const directories = [...new Set(directoryHints[instanceId] ?? [])];
      const lists = await Promise.all([
        loadPermissions(instanceId),
        ...directories.map((directory) => loadPermissions(instanceId, directory)),
      ]);
      const successful = lists.filter((list): list is PermissionRequest[] => list !== null);
      if (successful.length === 0) return null;
      const byId = new Map<string, PermissionRequest>();
      successful.flat().forEach((request) => {
        const existing = byId.get(request.id);
        if (!existing || (!existing.directory && request.directory)) byId.set(request.id, request);
      });
      return [instanceId, [...byId.values()]] as const;
    })
  );
  return Object.fromEntries(
    results.filter((entry): entry is readonly [string, PermissionRequest[]] => entry !== null)
  );
};

/**
 * Answer a permission request. OpenCode 2 replies are session-scoped and carry a `decision`
 * (`once` | `always` | `reject`), matching Ember's `PermissionReply` one to one.
 */
export const replyPermission = async (
  request: PermissionRequest,
  reply: PermissionReply,
  _directory?: string
): Promise<boolean> => {
  const response = await window.ember.request(
    request.instanceId,
    'POST',
    `/api/session/${encodeURIComponent(request.sessionId)}/permission/${encodeURIComponent(request.id)}/reply`,
    { decision: reply }
  );
  return response.ok;
};

/**
 * Pending agent questions — OpenCode 2 calls them "forms". `GET /api/form` returns the pending
 * `Form.Info` records for a location; each `fields` entry maps onto one `QuestionInfo` while
 * keeping the field `key`/`type` so the reply can be encoded back into `Form.Answer`.
 */
export const loadQuestions = async (
  instanceId: string,
  directory?: string
): Promise<QuestionRequest[] | null> => {
  const response = await window.ember.request(
    instanceId,
    'GET',
    `/api/form${locationQuery(directory)}`
  );
  if (!response.ok) return null;
  const location = asRecord(asRecord(response.data).location);
  return payloadArray(response.data)
    .map((entry) => {
      const item = asRecord(entry);
      return {
        id: String(item.id ?? ''),
        instanceId,
        sessionId: String(item.sessionID ?? item.sessionId ?? ''),
        directory: optionalString(location.directory) ?? optionalString(item.directory) ?? directory,
        questions: asArray(item.fields ?? item.questions)
          .map((raw): QuestionRequest['questions'][number] | null => {
            const field = asRecord(raw);
            const key = optionalString(field.key) ?? '';
            const type = optionalString(field.type) ?? 'string';
            const options = asArray(field.options).map((option) => {
              const record = asRecord(option);
              return {
                label: String(record.label ?? record.value ?? ''),
                description: String(record.description ?? ''),
                value: optionalString(record.value),
              };
            });
            if (field.hidden === true || !key) return null;
            const questionText = optionalString(field.title) ?? optionalString(field.question) ?? optionalString(field.description) ?? key;
            if (type === 'boolean') {
              return {
                key,
                valueType: 'boolean' as const,
                header: optionalString(field.header) ?? '',
                question: optionalString(field.description) ?? questionText,
                options: [
                  { label: 'Yes', description: '', value: 'true' },
                  { label: 'No', description: '', value: 'false' },
                ],
                multiple: false,
                custom: false,
              };
            }
            if (type === 'external') {
              const url = optionalString(field.url);
              return {
                key,
                valueType: 'external' as const,
                header: optionalString(field.header) ?? '',
                question: `${questionText}${url ? `\n\nOpen: ${url}` : ''}`,
                options: [],
                multiple: false,
                custom: true,
              };
            }
            return {
              key,
              valueType: type as QuestionRequest['questions'][number]['valueType'],
              header: optionalString(field.header) ?? '',
              question: optionalString(field.description) ?? questionText,
              options,
              multiple: type === 'multiselect' || field.multiple === true,
              custom: options.length === 0 || field.custom !== false,
            };
          })
          .filter((question): question is QuestionRequest['questions'][number] => question !== null),
      };
    })
    .filter((request) => request.id && request.sessionId && request.questions.length > 0);
};

export const loadAllQuestions = async (
  instanceIds: string[],
  directoryHints: Record<string, string[]> = {}
): Promise<Record<string, QuestionRequest[]>> => {
  const results = await Promise.all(
    instanceIds.map(async (instanceId) => {
      const directories = [...new Set(directoryHints[instanceId] ?? [])];
      const lists = await Promise.all([
        loadQuestions(instanceId),
        ...directories.map((directory) => loadQuestions(instanceId, directory)),
      ]);
      const successful = lists.filter((list): list is QuestionRequest[] => list !== null);
      if (successful.length === 0) return null;
      const byId = new Map<string, QuestionRequest>();
      successful.flat().forEach((request) => {
        const existing = byId.get(request.id);
        if (!existing || (!existing.directory && request.directory)) byId.set(request.id, request);
      });
      return [instanceId, [...byId.values()]] as const;
    })
  );
  return Object.fromEntries(
    results.filter((entry): entry is readonly [string, QuestionRequest[]] => entry !== null)
  );
};

/**
 * Answer a form. The UI collects one string list per field (picked option labels or a custom
 * string); this encodes it back into `Form.Answer` — option picks map to their `value`,
 * booleans/numbers are coerced, multiselect stays a list.
 */
const encodeFormAnswer = (request: QuestionRequest, answers: QuestionAnswers): Record<string, unknown> => {
  const answer: Record<string, unknown> = {};
  request.questions.forEach((question, index) => {
    const key = question.key ?? String(index);
    const picked = (answers[index] ?? []).map((label) => {
      const option = question.options.find((entry) => entry.label === label);
      return option?.value ?? label;
    });
    switch (question.valueType) {
      case 'boolean':
        answer[key] = picked[0] === 'true';
        break;
      case 'integer':
        answer[key] = Number.parseInt(picked[0] ?? '', 10) || 0;
        break;
      case 'number':
        answer[key] = Number(picked[0]) || 0;
        break;
      case 'multiselect':
        answer[key] = picked;
        break;
      default:
        answer[key] = picked.join('\n');
    }
  });
  return answer;
};

export const replyQuestion = async (
  request: QuestionRequest,
  answers: QuestionAnswers,
  _directory?: string
): Promise<boolean> => {
  const response = await window.ember.request(
    request.instanceId,
    'POST',
    `/api/session/${encodeURIComponent(request.sessionId)}/form/${encodeURIComponent(request.id)}/reply`,
    { answer: encodeFormAnswer(request, answers) }
  );
  return response.ok;
};

/** Dismiss a pending form — OpenCode 2 cancels it via `DELETE /session/:id/form/:formId`. */
export const rejectQuestion = async (request: QuestionRequest, _directory?: string): Promise<boolean> => {
  const response = await window.ember.request(
    request.instanceId,
    'DELETE',
    `/api/session/${encodeURIComponent(request.sessionId)}/form/${encodeURIComponent(request.id)}`
  );
  return response.ok;
};

const toQueuedMessage = (value: unknown): QueuedMessage | null => {
  const item = asRecord(value);
  const id = optionalString(item.id);
  if (!id) return null;
  const sendConfig = asRecord(item.sendConfig);
  const providerID = optionalString(sendConfig.providerID);
  const modelID = optionalString(sendConfig.modelID);
  if (!providerID || !modelID) return null;
  const content = typeof item.content === 'string' ? item.content : '';
  const text = typeof item.text === 'string' ? item.text : content;
  return {
    id,
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
    content,
    text,
    attachments: asArray(item.attachments)
      .map((attachment) => {
        const raw = asRecord(attachment);
        const filename = optionalString(raw.filename);
        const mimeType = optionalString(raw.mimeType);
        if (!filename || !mimeType) return null;
        const parsed: QueuedMessage['attachments'][number] = { filename, mimeType };
        const attachmentId = optionalString(raw.id);
        if (attachmentId) parsed.id = attachmentId;
        if (typeof raw.size === 'number' && raw.size >= 0) parsed.size = raw.size;
        const source = optionalString(raw.source);
        if (source) parsed.source = source;
        const dataUrl = optionalString(raw.dataUrl);
        if (dataUrl) parsed.dataUrl = dataUrl;
        return parsed;
      })
      .filter((attachment): attachment is QueuedMessage['attachments'][number] => attachment !== null),
    context: asArray(item.context)
      .map((entry) => {
        const raw = asRecord(entry);
        const text = optionalString(raw.text);
        if (!text) return null;
        const parsed: QueuedMessage['context'][number] = {
          kind: optionalString(raw.kind) ?? 'context',
          text,
        };
        if (raw.metadata && typeof raw.metadata === 'object') {
          parsed.metadata = raw.metadata as Record<string, unknown>;
        }
        const instructions = optionalString(raw.instructions);
        if (instructions) parsed.instructions = instructions;
        return parsed;
      })
      .filter((entry): entry is QueuedMessage['context'][number] => entry !== null),
    sendConfig: {
      providerID,
      modelID,
      agent: optionalString(sendConfig.agent),
      variant: optionalString(sendConfig.variant),
    },
    agentMention: optionalString(item.agentMention),
  };
};

const toMessageQueueSession = (value: unknown): MessageQueueSession | null => {
  const session = asRecord(value);
  const sessionId = optionalString(session.sessionId);
  if (!sessionId) return null;
  return {
    sessionId,
    directory: typeof session.directory === 'string' ? session.directory : '',
    items: asArray(session.items)
      .map(toQueuedMessage)
      .filter((item): item is QueuedMessage => item !== null),
    sendingId: optionalString(session.sendingId) ?? null,
  };
};

const toMessageQueueMutation = (value: unknown): MessageQueueMutation | null => {
  const mutation = asRecord(value);
  const session = toMessageQueueSession(mutation.session);
  if (!session) return null;
  return {
    revision: typeof mutation.revision === 'number' ? mutation.revision : 0,
    session,
    itemId: optionalString(mutation.itemId),
  };
};

const toMessageQueueTakeMutation = (value: unknown): MessageQueueTakeMutation | null => {
  const mutation = toMessageQueueMutation(value);
  const item = toQueuedMessage(asRecord(value).item);
  return mutation && item ? { ...mutation, item } : null;
};

export const loadMessageQueue = async (
  instanceId: string
): Promise<MessageQueueSnapshot | null> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/message-queue');
  if (!response.ok) return null;
  const snapshot = asRecord(response.data);
  return {
    revision: typeof snapshot.revision === 'number' ? snapshot.revision : 0,
    sessions: asArray(snapshot.sessions)
      .map(toMessageQueueSession)
      .filter((session): session is MessageQueueSession => session !== null),
  };
};

export const loadAllMessageQueues = async (
  instanceIds: string[]
): Promise<Record<string, MessageQueueSession[]>> => {
  const results = await Promise.all(
    instanceIds.map(async (instanceId) => {
      const snapshot = await loadMessageQueue(instanceId);
      return snapshot ? ([instanceId, snapshot.sessions] as const) : null;
    })
  );
  return Object.fromEntries(
    results.filter((entry): entry is readonly [string, MessageQueueSession[]] => entry !== null)
  );
};

/** Stop the agent's current turn (`POST /api/session/:id/interrupt`). */
export const abortSession = async (session: Session): Promise<boolean> => {
  const response = await window.ember.request(
    session.instanceId,
    'POST',
    `/api/session/${encodeURIComponent(session.id)}/interrupt`
  );
  return response.ok;
};

/** Enough markdown stripping for a one-line preview; not a parser. */
const stripMarkdown = (text: string): string =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|[*_~])/g, '');

/** One-line preview from the latest message that has any text (tool-only turns are skipped). */
export const previewOf = (messages: ChatMessage[]): string => {
  const last = [...messages].reverse().find(
    (message) => message.text.trim().length > 0 || Boolean(message.error)
  );
  const text = last?.text.trim() || last?.error || '';
  return stripMarkdown(text).replace(/\s+/g, ' ').trim().slice(0, 160);
};

/**
 * Parses the OpenCode 2 model catalogue. `GET /api/model` returns
 * `{ location, data: Model.Info[] }` — one flat list where every entry already knows its
 * `providerID`, `id` (the value `Model.Ref.id` expects), `name`, `variants` and `capabilities`.
 * `providerNames` maps providerID → display name from `GET /api/provider`.
 */
const parseModelList = (data: unknown, providerNames: ReadonlyMap<string, string>): ModelList => {
  const models: ModelOption[] = [];

  payloadArray(data).forEach((entry) => {
    const item = asRecord(entry);
    if (item.enabled === false) return;
    const providerID = optionalString(item.providerID) ?? '';
    // `id` is the canonical ref identifier (`Model.Ref.id`); `modelID` is the provider-side
    // name. They usually match; the ref id is what a session reports and what `/model` wants.
    const modelID = optionalString(item.id) ?? optionalString(item.modelID) ?? '';
    if (!providerID || !modelID) return;
    const name = optionalString(item.name) ?? modelID;
    const providerName = providerNames.get(providerID) ?? providerID;
    models.push({
      providerID,
      modelID,
      label: `${providerName} / ${name}`,
      details: toModelDetails(item, name, providerName),
    });
  });

  models.sort((a, b) => a.label.localeCompare(b.label));

  return { models, defaultModelId: null };
};

const parseProviderNames = (data: unknown): Map<string, string> => {
  const names = new Map<string, string>();
  payloadArray(data).forEach((entry) => {
    const item = asRecord(entry);
    const id = optionalString(item.id);
    const name = optionalString(item.name);
    if (id && name) names.set(id, name);
  });
  return names;
};

/**
 * Loads an instance's model catalogue (`GET /api/model`), provider display names
 * (`GET /api/provider`) and its configured default (`GET /api/model/default`).
 * `null` means the catalogue request failed.
 */
export const loadModels = async (instanceId: string): Promise<ModelList | null> => {
  const [listResponse, providerResponse, defaultResponse] = await Promise.all([
    window.ember.request(instanceId, 'GET', '/api/model'),
    window.ember.request(instanceId, 'GET', '/api/provider'),
    window.ember.request(instanceId, 'GET', '/api/model/default'),
  ]);
  if (!listResponse.ok) return null;
  const providerNames = providerResponse.ok ? parseProviderNames(providerResponse.data) : new Map<string, string>();
  const parsed = parseModelList(listResponse.data, providerNames);
  if (defaultResponse.ok) {
    const entry = asRecord(asRecord(defaultResponse.data).data);
    const providerID = optionalString(entry.providerID);
    const id = optionalString(entry.id) ?? optionalString(entry.modelID);
    if (providerID && id) parsed.defaultModelId = `${providerID}/${id}`;
  }
  return parsed;
};

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const toModelDetails = (
  model: Record<string, unknown>,
  name: string,
  providerName: string
): ModelDetails => {
  // v2 shapes: capabilities `{ tools, input: string[], output: string[] }`, `variants` an array of
  // `{ id }`, `cost` an array whose first entry is the base rate, `time.released` a timestamp.
  const capabilities = asRecord(model.capabilities);
  const cost = asArray(model.cost).map(asRecord);
  const base = cost[0] ?? {};
  const limit = asRecord(model.limit);
  const time = asRecord(model.time);
  const variants = asArray(model.variants)
    .map((entry) => optionalString(asRecord(entry).id) ?? optionalString(entry))
    .filter((id): id is string => Boolean(id));
  const inputKinds = asArray(capabilities.input).map(optionalString).filter((kind): kind is string => Boolean(kind));
  return {
    name,
    providerName,
    family: optionalString(model.family),
    releaseDate: typeof time.released === 'number' ? new Date(time.released).toISOString().slice(0, 10) : optionalString(model.release_date),
    status: optionalString(model.status),
    contextTokens: optionalNumber(limit.context),
    outputTokens: optionalNumber(limit.output),
    costInput: optionalNumber(base.input),
    costOutput: optionalNumber(base.output),
    reasoning: capabilities.reasoning === true || variants.length > 0,
    toolcall: capabilities.tools === true || capabilities.toolcall === true,
    attachment: inputKinds.some((kind) => kind !== 'text'),
    inputs: inputKinds.filter((kind) => kind !== 'text'),
    variants,
  };
};

const MESSAGE_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
let lastMessageTimestamp = 0;
let messageSequence = 0;

export const createClientMessageId = (timestamp = Date.now()): string => {
  if (timestamp === lastMessageTimestamp) messageSequence = (messageSequence + 1) & 0xfff;
  else {
    lastMessageTimestamp = timestamp;
    messageSequence = 1;
  }
  const time = (BigInt(timestamp) * 0x1000n + BigInt(messageSequence))
    .toString(16)
    .padStart(12, '0')
    .slice(-12);
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const random = Array.from(bytes, (byte) => MESSAGE_ID_ALPHABET[byte % MESSAGE_ID_ALPHABET.length]).join('');
  return `msg_${time}${random}`;
};

export type PromptInput = {
  text: string;
  selectedModelId?: string;
  model?: ModelOption;
  mode?: string;
  /** Reasoning-effort variant advertised by the selected model. */
  variant?: string;
  attachments?: FileAttachment[];
  replyContext?: string;
  /** Full context recovered when a queued message is sent immediately. */
  queuedContext?: QueuedMessage['context'];
  agentMention?: string;
};

export type QueueMessageInput = Omit<PromptInput, 'model'> & {
  /** OpenChamber's server-owned queue requires a concrete provider/model. */
  model: ModelOption;
};

export const enqueueMessage = async (
  instanceId: string,
  sessionId: string,
  directory: string,
  { text, model, selectedModelId, mode, variant, attachments = [], replyContext, queuedContext = [], agentMention }: QueueMessageInput
): Promise<{ ok: boolean; status: number; data: MessageQueueMutation | null }> => {
  if (selectedModelError(selectedModelId, model)) return { ok: false, status: 400, data: null };
  const sendConfig: Record<string, string> = {
    providerID: model.providerID,
    modelID: model.modelID,
  };
  if (mode) sendConfig.agent = mode;
  if (variant) sendConfig.variant = canonicalVariant(model.details.variants, variant) ?? variant;
  const item = {
    content: text.trim(),
    text,
    attachments: attachments.map((file, index) => ({
      id: `attachment-${index}`,
      filename: file.filename,
      mimeType: file.mime,
      source: 'local',
      dataUrl: file.url,
    })),
    context: queuedContext.length
      ? queuedContext
      : replyContext
        ? [{
            kind: 'synthetic',
            text: `Earlier pinned message being replied to:\n\n${replyContext}`,
          }]
        : [],
    ...(agentMention ? { agentMention } : {}),
    sendConfig,
  };
  const response = await window.ember.request(
    instanceId,
    'POST',
    `/api/message-queue/sessions/${encodeURIComponent(sessionId)}/items`,
    { directory, item }
  );
  return { ...response, data: toMessageQueueMutation(response.data) };
};

export const removeQueuedMessage = async (
  instanceId: string,
  sessionId: string,
  itemId: string
): Promise<{ ok: boolean; status: number; data: MessageQueueMutation | null }> => {
  const response = await window.ember.request(
    instanceId,
    'DELETE',
    `/api/message-queue/sessions/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemId)}`
  );
  return { ...response, data: toMessageQueueMutation(response.data) };
};

export const takeQueuedMessage = async (
  instanceId: string,
  sessionId: string,
  itemId: string
): Promise<{ ok: boolean; status: number; data: MessageQueueTakeMutation | null }> => {
  const response = await window.ember.request(
    instanceId,
    'POST',
    `/api/message-queue/sessions/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemId)}/take`
  );
  return { ...response, data: toMessageQueueTakeMutation(response.data) };
};

export const reorderQueuedMessages = async (
  instanceId: string,
  sessionId: string,
  itemIds: string[]
): Promise<{ ok: boolean; status: number; data: MessageQueueMutation | null }> => {
  const response = await window.ember.request(
    instanceId,
    'PUT',
    `/api/message-queue/sessions/${encodeURIComponent(sessionId)}/order`,
    { itemIds }
  );
  return { ...response, data: toMessageQueueMutation(response.data) };
};

/**
 * Send a prompt the OpenCode 2 way. Model and agent are sticky session settings, so an explicit
 * choice is pushed to `/model` or `/agent` first — a refusal fails the send rather than silently
 * falling back. Reply/queued context becomes `synthetic` inbox items ahead of the prompt, then
 * `POST /prompt` carries `{ id, text, files: [{ uri, name }], agents: [{ name }] }`.
 */
export const sendPrompt = async (
  instanceId: string,
  sessionId: string,
  { text, model, selectedModelId, mode, variant, attachments = [], replyContext, queuedContext = [], agentMention }: PromptInput,
  _directory?: string,
  messageId?: string
): Promise<{ ok: boolean; status: number; data: unknown }> => {
  const modelError = selectedModelError(selectedModelId, model);
  if (modelError) return { ok: false, status: 400, data: { error: modelError } };
  const sessionPath = `/api/session/${encodeURIComponent(sessionId)}`;

  if (model) {
    const ref: Record<string, unknown> = { providerID: model.providerID, id: model.modelID };
    const chosen = variant ? canonicalVariant(model.details.variants, variant) ?? variant : undefined;
    if (chosen) ref.variant = chosen;
    const switched = await window.ember.request(instanceId, 'POST', `${sessionPath}/model`, { model: ref });
    if (!switched.ok) return switched;
  }
  if (mode) {
    const switched = await window.ember.request(instanceId, 'POST', `${sessionPath}/agent`, { agent: mode });
    if (!switched.ok) return switched;
  }

  const synthetics: Array<{ text: string; metadata?: Record<string, unknown> }> = [];
  if (replyContext && queuedContext.length === 0) {
    synthetics.push({
      text: `Earlier pinned message being replied to:\n\n${replyContext}`,
      metadata: { emberReplyContext: true },
    });
  }
  queuedContext.forEach((entry) => {
    if (entry.instructions) synthetics.push({ text: entry.instructions, metadata: { emberReplyContext: true } });
    const metadata =
      entry.kind === 'context' && entry.metadata
        ? { ...entry.metadata, emberReplyContext: true }
        : { emberReplyContext: true };
    synthetics.push({ text: entry.text, metadata });
  });
  for (const synthetic of synthetics) {
    const injected = await window.ember.request(instanceId, 'POST', `${sessionPath}/synthetic`, {
      text: synthetic.text,
      metadata: synthetic.metadata ?? {},
    });
    if (!injected.ok) return injected;
  }

  const body: Record<string, unknown> = { text };
  if (messageId) body.id = messageId;
  if (attachments.length) {
    body.files = attachments.map((file) => ({ uri: file.url, name: file.filename }));
  }
  if (agentMention) body.agents = [{ name: agentMention }];

  return window.ember.request(instanceId, 'POST', `${sessionPath}/prompt`, body);
};
