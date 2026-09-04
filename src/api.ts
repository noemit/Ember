import { sessionKey } from './types';
import type {
  BallState,
  ChatMessage,
  FileAttachment,
  Instance,
  MessagePart,
  ModelDetails,
  ModelOption,
  PermissionReply,
  PermissionRequest,
  Project,
  QuestionAnswers,
  QuestionRequest,
  Session,
  ToolCall,
  ToolStatus,
} from './types';

export type ModelList = {
  models: ModelOption[];
  defaultModelId: string | null;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

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

const baseName = (value: string): string => {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed.split('/').pop() || trimmed;
};

export const listInstances = async (): Promise<Instance[]> =>
  asArray(await window.ember.listInstances()) as Instance[];

export const loadProjects = async (instanceId: string): Promise<Project[]> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/config/settings');
  const root = asRecord(response.data);
  const paths = new Set<string>();

  return asArray(root.projects)
    .map((entry, index) => {
      const item = asRecord(entry);
      const path = typeof item.path === 'string' ? item.path : undefined;
      const id = String(item.id ?? path ?? `project-${index}`);
      const label = typeof item.label === 'string' && item.label ? item.label : undefined;
      const name = typeof item.name === 'string' && item.name ? item.name : undefined;

      return { id, name: label ?? name ?? (path ? baseName(path) : id), path };
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

const toSession = (instanceId: string, entry: unknown, index: number): Session => {
  const item = asRecord(entry);
  const time = asRecord(item.time);
  const updated =
    typeof time.updated === 'number'
      ? time.updated
      : typeof time.created === 'number'
        ? time.created
        : undefined;

  const model = asRecord(item.model);
  const modelID = typeof model.id === 'string' ? model.id : typeof model.modelID === 'string' ? model.modelID : '';
  const providerID = typeof model.providerID === 'string' ? model.providerID : '';

  return {
    id: String(item.id ?? `session-${index}`),
    instanceId,
    title: typeof item.title === 'string' ? item.title : undefined,
    directory: typeof item.directory === 'string' ? item.directory : undefined,
    updated,
    archived: typeof time.archived === 'number' && time.archived > 0 ? time.archived : undefined,
    model: modelID && providerID ? { providerID, modelID } : undefined,
    parentId: typeof item.parentID === 'string' && item.parentID ? item.parentID : undefined,
  };
};

/**
 * Sessions including archived ones. OpenCode's `archived` flag means "also include
 * archived", so `time.archived` on each record tells the two apart. Restored sessions
 * carry `archived: 0`, which is why the split happens client-side.
 *
 * Pages are walked with `cursor` = last `time.updated` (the server's cursor semantics
 * are "updated strictly before"), since the bridge doesn't surface response headers.
 */
const payloadArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const root = asRecord(value);
  return asArray((root.data ?? root.sessions ?? root.messages) as unknown);
};

export const loadSessions = async (
  instanceId: string,
  directory?: string
): Promise<Session[] | null> => {
  const sessions: Session[] = [];
  const seen = new Set<string>();
  let cursor: number | undefined;

  for (let page = 0; page < SESSION_MAX_PAGES; page += 1) {
    const directoryParam = directory ? `&directory=${encodeURIComponent(directory)}` : '';
    const query = `archived=true&limit=${SESSION_PAGE_SIZE}${cursor ? `&cursor=${cursor}` : ''}${directoryParam}`;
    const response = await window.ember.request(
      instanceId,
      'GET',
      `/api/experimental/session?${query}`
    );
    if (!response.ok) return page === 0 ? null : sessions;

    const batch = payloadArray(response.data);
    batch.forEach((entry, index) => {
      const session = toSession(instanceId, entry, sessions.length + index);
      // Subagent sessions belong to their parent's transcript; the list endpoint returns
      // them alongside top-level ones and the TUI hides them the same way.
      if (session.parentId || seen.has(session.id)) return;
      seen.add(session.id);
      sessions.push(session);
    });

    const lastItem = asRecord(batch[batch.length - 1]);
    const lastTime = asRecord(lastItem.time);
    const nextCursor =
      typeof lastTime.updated === 'number'
        ? lastTime.updated
        : typeof lastTime.created === 'number'
          ? lastTime.created
          : undefined;
    if (batch.length < SESSION_PAGE_SIZE || !nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }

  return sessions;
};

/**
 * Archive (or restore) a session on its OpenChamber instance. OpenCode treats
 * `archived: 0` as restored, so both directions go through the same PATCH.
 */
export const setSessionArchived = async (
  session: Session,
  archived: boolean
): Promise<boolean> => {
  const query = session.directory ? `?directory=${encodeURIComponent(session.directory)}` : '';
  const response = await window.ember.request(
    session.instanceId,
    'PATCH',
    `/api/session/${encodeURIComponent(session.id)}${query}`,
    { time: { archived: archived ? Date.now() : 0 } }
  );
  return response.ok;
};

/**
 * Load sessions from every instance. Returns a map keyed by instance id so a failing
 * instance leaves its previous sessions untouched instead of erasing them.
 */
export const loadAllSessions = async (
  instanceIds: string[],
  directoryHints: Record<string, string[]> = {}
): Promise<Record<string, Session[]>> => {
  const results = await Promise.all(
    instanceIds.map(async (instanceId) => {
      const directories = directoryHints[instanceId] ?? [];
      const lists = await Promise.all([
        loadSessions(instanceId),
        ...directories.map((directory) => loadSessions(instanceId, directory)),
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
      return [instanceId, merged] as const;
    })
  );
  return Object.fromEntries(
    results.filter((entry): entry is readonly [string, Session[]] => entry !== null)
  );
};

export const loadAllProjects = async (
  instanceIds: string[]
): Promise<Record<string, Project[]>> => {
  const results = await Promise.all(
    instanceIds.map(async (instanceId) => [instanceId, await loadProjects(instanceId)] as const)
  );
  return Object.fromEntries(results);
};

export type ScheduledIdentityData = {
  bindings: Record<string, string>;
  taskNames: Record<string, string>;
};

export const scheduledTaskKey = (instanceId: string, projectId: string, taskId: string): string =>
  `task:${instanceId}::${projectId}::${taskId}`;

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
      return asArray(root.tasks ?? response.data).map((entry) => {
        const task = asRecord(entry);
        const state = asRecord(task.state);
        const id = optionalString(task.id);
        if (!id) return null;
        const key = scheduledTaskKey(instanceId, project.id, id);
        return {
          key,
          name: optionalString(task.name) ?? id,
          sessionId: optionalString(state.lastSessionId),
        };
      });
    })
  );
  const bindings: Record<string, string> = {};
  const taskNames: Record<string, string> = {};
  results.flat().forEach((entry) => {
    if (!entry) return;
    taskNames[entry.key] = entry.name;
    if (entry.sessionId) {
      bindings[sessionKey({ instanceId, sessionId: entry.sessionId })] = entry.key;
    }
  });
  return { bindings, taskNames };
};

export const createSession = async (
  instanceId: string,
  directory?: string
): Promise<Session | null> => {
  const query = directoryQuery(directory);
  const body: Record<string, unknown> = directory ? { directory } : {};
  const response = await window.ember.request(instanceId, 'POST', `/api/session${query}`, body);
  if (!response.ok) return null;

  const root = asRecord(response.data);
  const item = asRecord(root.data ?? response.data);
  const id = typeof item.id === 'string' ? item.id : '';
  if (!id) return null;

  return {
    id,
    instanceId,
    title: typeof item.title === 'string' ? item.title : undefined,
    directory,
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
    value.includes('work')
  ) {
    return 'active';
  }
  return 'idle';
};

/** Ball states keyed by `sessionKey` so they can be merged across instances. */
export const loadSessionStates = async (
  instanceId: string
): Promise<Record<string, BallState> | null> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/sessions/status');
  if (!response.ok) return null;
  const sessions = asRecord(asRecord(response.data).sessions);
  const states: Record<string, BallState> = {};

  Object.entries(sessions).forEach(([id, value]) => {
    const entry = asRecord(value);
    states[sessionKey({ instanceId, sessionId: id })] = statusToState(entry.status ?? entry.state);
  });

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

export const loadMessages = async (
  instanceId: string,
  sessionId: string,
  directory?: string
): Promise<ChatMessage[]> => {
  const response = await window.ember.request(
    instanceId,
    'GET',
    `/api/session/${encodeURIComponent(sessionId)}/message${directoryQuery(directory)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load messages for ${sessionId}: ${response.status}`);
  }

  const list = payloadArray(response.data);

  return list
    .map((entry, index) => {
      const item = asRecord(entry);
      const info = asRecord(
        item.info ?? item.message ?? (typeof item.id === 'string' ? entry : {})
      );
      const rawRole = info.role ?? item.role ?? info.type ?? item.type ?? 'assistant';
      const role: ChatMessage['role'] = rawRole === 'user' ? 'user' : 'assistant';
      const id = String(info.id ?? item.id ?? `msg-${index}`);
      const partList = asArray(
        (item.parts ?? info.parts ??
          (Array.isArray(info.content) ? info.content : undefined) ??
          (Array.isArray(item.content) ? item.content : undefined) ??
          []) as unknown
      );
      const parts = partList
        .map((part, partIndex) => toMessagePart(part, `${id}-${partIndex}`))
        .filter((part): part is MessagePart => part !== null);
      const fallback = optionalString(info.text) ?? optionalString(item.text) ?? '';
      if (parts.length === 0 && fallback) {
        parts.push({ type: 'text', id: `${id}-0`, text: fallback });
      }
      const text = parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
      const time = asRecord(info.time);
      const rawModel = asRecord(info.model);
      const providerID = optionalString(info.providerID) ?? optionalString(rawModel.providerID);
      const modelID = optionalString(info.modelID) ?? optionalString(rawModel.modelID) ?? optionalString(rawModel.id);
      const model = providerID && modelID ? { providerID, modelID } : undefined;
      const createdAt = typeof time.created === 'number' ? time.created : undefined;
      const completedAt = typeof time.completed === 'number' ? time.completed : undefined;
      const error = role === 'assistant' ? errorMessageOf(info.error ?? item.error) : undefined;
      // User messages have no completion timestamp; assistants get one when the turn ends.
      const completed = role === 'user' || completedAt !== undefined || error !== undefined;
      return { id, role, text, parts, model, error, createdAt, completedAt, completed };
    })
    .filter((message) => message.parts.length > 0 || message.error);
};

const outgoingMessageSignature = (message: ChatMessage): string | null => {
  if (message.role !== 'user') return null;
  const files = message.parts
    .filter((part) => part.type === 'file')
    .map((part) => [part.file.mime, part.file.filename]);
  return JSON.stringify([message.text, files]);
};

export const reconcilePolledMessages = (
  current: ChatMessage[],
  polled: ChatMessage[],
  pendingIds: ReadonlySet<string>
): ChatMessage[] => {
  const pending = current.filter((message) => pendingIds.has(message.id));
  if (pending.length === 0) return polled;

  const knownIds = new Set(
    current.filter((message) => !pendingIds.has(message.id)).map((message) => message.id)
  );
  const candidates = polled.filter((message) => !knownIds.has(message.id));
  const consumed = new Set<number>();
  const unmatched = pending.filter((message) => {
    if (polled.some((candidate) => candidate.id === message.id)) return false;
    const signature = outgoingMessageSignature(message);
    const index = candidates.findIndex(
      (candidate, candidateIndex) =>
        !consumed.has(candidateIndex) && outgoingMessageSignature(candidate) === signature
    );
    if (index < 0) return true;
    consumed.add(index);
    return false;
  });

  return [...polled, ...unmatched];
};

const TOOL_STATUSES: ToolStatus[] = ['pending', 'running', 'completed', 'error'];
const TOOL_OUTPUT_LIMIT = 20_000;

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

/** Text, reasoning, file and tool parts; step markers, patches and snapshots are skipped. */
const toMessagePart = (raw: unknown, fallbackId: string): MessagePart | null => {
  const part = asRecord(raw);
  const id = String(part.id ?? fallbackId);
  if (part.type === 'text' || part.type === 'reasoning') {
    if (asRecord(part.metadata).emberReplyContext === true) return null;
    const text = typeof part.text === 'string' ? part.text : '';
    return text ? { type: part.type, id, text } : null;
  }
  if (part.type === 'file') {
    const url = optionalString(part.url);
    if (!url) return null;
    return {
      type: 'file',
      id,
      file: {
        url,
        mime: optionalString(part.mime) ?? 'application/octet-stream',
        filename: optionalString(part.filename) ?? 'attachment',
      },
    };
  }
  if (part.type === 'tool') {
    const state = asRecord(part.state);
    const metadata = asRecord(state.metadata);
    const input = asRecord(state.input);
    const status = TOOL_STATUSES.find((entry) => entry === state.status) ?? 'pending';
    const output = optionalString(state.output) ?? optionalString(state.result);
    const call: ToolCall = {
      id: String(part.callID ?? id),
      tool: String(part.tool ?? part.name ?? 'tool'),
      status,
      title: optionalString(state.title) ?? toolTitleFromInput(input),
      error: optionalString(state.error),
      input: Object.keys(input).length > 0 ? input : undefined,
      output: output && output.length > TOOL_OUTPUT_LIMIT ? `${output.slice(0, TOOL_OUTPUT_LIMIT)}\n… (truncated)` : output,
      diff: optionalString(metadata.diff) ?? optionalString(metadata.patch),
    };
    return { type: 'tool', id, call };
  }
  return null;
};

/** Best-effort one-liner for a tool call before the server assigns a title. */
const toolTitleFromInput = (input: Record<string, unknown>): string | undefined => {
  for (const key of ['command', 'filePath', 'path', 'pattern', 'url', 'query', 'description']) {
    const value = input[key];
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
};

/** Pending permission requests across every session on an instance. */
export const loadPermissions = async (instanceId: string): Promise<PermissionRequest[] | null> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/permission');
  if (!response.ok) return null;
  return asArray(response.data).map((entry) => {
    const item = asRecord(entry);
    return {
      id: String(item.id ?? ''),
      instanceId,
      sessionId: String(item.sessionID ?? item.sessionId ?? ''),
      permission: String(item.permission ?? item.type ?? 'tool'),
      patterns: asArray(item.patterns).map(String),
      metadata: asRecord(item.metadata),
    };
  }).filter((request) => request.id && request.sessionId);
};

export const loadAllPermissions = async (
  instanceIds: string[]
): Promise<Record<string, PermissionRequest[]>> => {
  const results = await Promise.all(
    instanceIds.map(async (instanceId) => [instanceId, await loadPermissions(instanceId)] as const)
  );
  const map: Record<string, PermissionRequest[]> = {};
  results.forEach(([instanceId, list]) => {
    if (list) map[instanceId] = list;
  });
  return map;
};

/**
 * Answer a permission request. The `directory` routes the reply to the OpenCode
 * instance that owns the session, mirroring what OpenChamber does. Older servers only
 * know the session-scoped route, so fall back to it on 404.
 */
export const replyPermission = async (
  request: PermissionRequest,
  reply: PermissionReply,
  directory?: string
): Promise<boolean> => {
  const query = directory ? `?directory=${encodeURIComponent(directory)}` : '';
  const response = await window.ember.request(
    request.instanceId,
    'POST',
    `/api/permission/${encodeURIComponent(request.id)}/reply${query}`,
    { reply }
  );
  if (response.ok || response.status !== 404) return response.ok;

  const legacy = await window.ember.request(
    request.instanceId,
    'POST',
    `/api/session/${encodeURIComponent(request.sessionId)}/permissions/${encodeURIComponent(request.id)}${query}`,
    { response: reply }
  );
  return legacy.ok;
};

const directoryQuery = (directory?: string): string =>
  directory ? `?directory=${encodeURIComponent(directory)}` : '';

/** Pending agent questions (the `question` tool) across every session on an instance. */
export const loadQuestions = async (
  instanceId: string,
  directory?: string
): Promise<QuestionRequest[] | null> => {
  const response = await window.ember.request(
    instanceId,
    'GET',
    `/api/question${directoryQuery(directory)}`
  );
  if (!response.ok) return null;
  return payloadArray(response.data)
    .map((entry) => {
      const item = asRecord(entry);
      return {
        id: String(item.id ?? ''),
        instanceId,
        sessionId: String(item.sessionID ?? item.sessionId ?? ''),
        questions: asArray(item.questions).map((raw) => {
          const question = asRecord(raw);
          return {
            header: String(question.header ?? ''),
            question: String(question.question ?? ''),
            options: asArray(question.options).map((option) => {
              const record = asRecord(option);
              return { label: String(record.label ?? ''), description: String(record.description ?? '') };
            }),
            multiple: question.multiple === true,
            custom: question.custom !== false,
          };
        }),
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
      const seen = new Set<string>();
      const merged = successful.flat().filter((request) => {
        if (seen.has(request.id)) return false;
        seen.add(request.id);
        return true;
      });
      return [instanceId, merged] as const;
    })
  );
  return Object.fromEntries(
    results.filter((entry): entry is readonly [string, QuestionRequest[]] => entry !== null)
  );
};

export const replyQuestion = async (
  request: QuestionRequest,
  answers: QuestionAnswers,
  directory?: string
): Promise<boolean> => {
  const response = await window.ember.request(
    request.instanceId,
    'POST',
    `/api/question/${encodeURIComponent(request.id)}/reply${directoryQuery(directory)}`,
    { answers }
  );
  return response.ok;
};

export const rejectQuestion = async (request: QuestionRequest, directory?: string): Promise<boolean> => {
  const response = await window.ember.request(
    request.instanceId,
    'POST',
    `/api/question/${encodeURIComponent(request.id)}/reject${directoryQuery(directory)}`
  );
  return response.ok;
};

/** Stop the agent's current turn. */
export const abortSession = async (session: Session): Promise<boolean> => {
  const response = await window.ember.request(
    session.instanceId,
    'POST',
    `/api/session/${encodeURIComponent(session.id)}/abort${directoryQuery(session.directory)}`
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

export const loadSessionPreview = async (
  instanceId: string,
  sessionId: string,
  directory?: string
): Promise<string | null> => {
  try {
    return previewOf(await loadMessages(instanceId, sessionId, directory));
  } catch {
    return null;
  }
};

export const loadModels = async (instanceId: string): Promise<ModelList> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/provider');
  const root = asRecord(response.data);
  const rawProviders = Array.isArray(response.data)
    ? response.data
    : asArray(root.all ?? root.providers);

  const connected: string[] = Array.isArray(root.connected)
    ? root.connected.map(String)
    : [];
  const providers = rawProviders.map((provider) => asRecord(provider));
  const usable = connected.length
    ? providers.filter((provider) => connected.includes(String(provider.id ?? provider.name ?? '')))
    : providers;

  const models: ModelOption[] = [];

  usable.forEach((item) => {
    const providerID = String(item.id ?? item.providerID ?? item.name ?? '');
    const providerName = String(item.name ?? item.id ?? '');

    Object.values(asRecord(item.models)).forEach((model) => {
      const modelItem = asRecord(model);
      const modelID = String(modelItem.id ?? modelItem.modelID ?? '');
      if (!providerID || !modelID) return;
      const name = String(modelItem.name ?? modelID);
      models.push({
        providerID,
        modelID,
        label: `${providerName} / ${name}`,
        details: toModelDetails(modelItem, name, providerName),
      });
    });
  });

  models.sort((a, b) => a.label.localeCompare(b.label));

  // `default` is a map of provider → model for the whole catalogue, not the instance's
  // pick; only an explicit pair tells us what OpenCode will actually use.
  const defaults = asRecord(root.default);
  const pairProvider = typeof defaults.providerID === 'string' ? defaults.providerID : '';
  const pairModel = typeof defaults.modelID === 'string' ? defaults.modelID : '';
  const defaultModelId = pairProvider && pairModel ? `${pairProvider}/${pairModel}` : null;

  return { models, defaultModelId };
};

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const toModelDetails = (
  model: Record<string, unknown>,
  name: string,
  providerName: string
): ModelDetails => {
  const capabilities = asRecord(model.capabilities);
  const input = asRecord(capabilities.input);
  const cost = asRecord(model.cost);
  const limit = asRecord(model.limit);
  return {
    name,
    providerName,
    family: optionalString(model.family),
    releaseDate: optionalString(model.release_date),
    status: optionalString(model.status),
    contextTokens: optionalNumber(limit.context),
    outputTokens: optionalNumber(limit.output),
    costInput: optionalNumber(cost.input),
    costOutput: optionalNumber(cost.output),
    reasoning: capabilities.reasoning === true,
    toolcall: capabilities.toolcall === true,
    attachment: capabilities.attachment === true,
    inputs: ['image', 'pdf', 'audio', 'video'].filter((kind) => input[kind] === true),
    variants: Object.keys(asRecord(model.variants)),
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
  model?: ModelOption;
  mode?: string;
  attachments?: FileAttachment[];
  replyContext?: string;
};

export const sendPrompt = async (
  instanceId: string,
  sessionId: string,
  { text, model, mode, attachments = [], replyContext }: PromptInput,
  directory?: string,
  messageId?: string
): Promise<{ ok: boolean; status: number; data: unknown }> => {
  const parts: unknown[] = [
    ...(replyContext
      ? [
          {
            type: 'text',
            text: `Earlier pinned message being replied to:\n\n${replyContext}`,
            synthetic: true,
            metadata: { emberReplyContext: true },
          },
        ]
      : []),
    ...attachments.map((file) => ({ type: 'file', mime: file.mime, filename: file.filename, url: file.url })),
  ];
  if (text) parts.push({ type: 'text', text });
  const body: Record<string, unknown> = { parts };
  if (model) body.model = { providerID: model.providerID, modelID: model.modelID };
  if (mode) body.agent = mode;
  if (messageId) body.messageID = messageId;

  return window.ember.request(
    instanceId,
    'POST',
    `/api/session/${encodeURIComponent(sessionId)}/prompt_async${directoryQuery(directory)}`,
    body
  );
};
