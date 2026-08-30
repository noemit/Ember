import type { BallState, ChatMessage, Instance, ModelOption, Project, Session } from './types';

export type ModelList = {
  models: ModelOption[];
  defaultModelId: string | null;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const baseName = (value: string): string => {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed.split('/').pop() || trimmed;
};

export const listInstances = async (): Promise<Instance[]> =>
  asArray(await window.ember.listInstances()) as Instance[];

export const loadProjects = async (instanceId: string): Promise<Project[]> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/config/settings');
  const root = asRecord(response.data);

  return asArray(root.projects).map((entry, index) => {
    const item = asRecord(entry);
    const path = typeof item.path === 'string' ? item.path : undefined;
    const id = String(item.id ?? path ?? `project-${index}`);
    const label = typeof item.label === 'string' && item.label ? item.label : undefined;
    const name = typeof item.name === 'string' && item.name ? item.name : undefined;

    return { id, name: label ?? name ?? (path ? baseName(path) : id), path };
  });
};

export const loadSessions = async (instanceId: string): Promise<Session[]> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/session');

  return asArray(response.data).map((entry, index) => {
    const item = asRecord(entry);
    const time = asRecord(item.time);
    const updated =
      typeof time.updated === 'number'
        ? time.updated
        : typeof time.created === 'number'
          ? time.created
          : undefined;

    return {
      id: String(item.id ?? `session-${index}`),
      title: typeof item.title === 'string' ? item.title : undefined,
      directory: typeof item.directory === 'string' ? item.directory : undefined,
      updated,
    };
  });
};

export const createSession = async (
  instanceId: string,
  directory?: string
): Promise<Session | null> => {
  const body: Record<string, unknown> = directory ? { directory } : {};
  const response = await window.ember.request(instanceId, 'POST', '/api/session', body);
  if (!response.ok) return null;

  const item = asRecord(response.data);
  const id = typeof item.id === 'string' ? item.id : '';
  if (!id) return null;

  return {
    id,
    title: typeof item.title === 'string' ? item.title : undefined,
    directory,
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

export const loadSessionStates = async (instanceId: string): Promise<Record<string, BallState>> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/sessions/status');
  const sessions = asRecord(asRecord(response.data).sessions);
  const states: Record<string, BallState> = {};

  Object.entries(sessions).forEach(([id, value]) => {
    const entry = asRecord(value);
    states[id] = statusToState(entry.status ?? entry.state);
  });

  return states;
};

export const loadMessages = async (
  instanceId: string,
  sessionId: string
): Promise<ChatMessage[]> => {
  const response = await window.ember.request(
    instanceId,
    'GET',
    `/api/session/${encodeURIComponent(sessionId)}/message`
  );
  const list = Array.isArray(response.data)
    ? response.data
    : asArray(asRecord(response.data).messages);

  return list
    .map((entry, index) => {
      const item = asRecord(entry);
      const info = asRecord(item.info ?? item.message);
      const role: ChatMessage['role'] =
        String(info.role ?? item.role ?? 'assistant') === 'user' ? 'user' : 'assistant';
      const parts = asArray(item.parts ?? info.parts);
      const text =
        parts.map((part) => String(asRecord(part).text ?? '')).join('') ||
        String(item.content ?? item.text ?? '');
      return { id: String(info.id ?? item.id ?? `msg-${index}`), role, text };
    })
    .filter((message) => message.text.length > 0);
};

export const loadSessionPreview = async (
  instanceId: string,
  sessionId: string
): Promise<string> => {
  const messages = await loadMessages(instanceId, sessionId);
  const last = messages[messages.length - 1];
  if (!last) return '';
  return last.text.replace(/\s+/g, ' ').trim().slice(0, 160);
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
      models.push({
        providerID,
        modelID,
        label: `${providerName} / ${String(modelItem.name ?? modelID)}`,
      });
    });
  });

  models.sort((a, b) => a.label.localeCompare(b.label));

  const defaults = asRecord(root.default);
  let defaultModelId: string | null = null;

  const pairProvider = typeof defaults.providerID === 'string' ? defaults.providerID : '';
  const pairModel = typeof defaults.modelID === 'string' ? defaults.modelID : '';
  if (pairProvider && pairModel) {
    defaultModelId = `${pairProvider}/${pairModel}`;
  } else {
    const entry = Object.entries(defaults).find(
      ([, value]) => typeof value === 'string' && Boolean(value)
    );
    if (entry) defaultModelId = `${entry[0]}/${String(entry[1])}`;
  }

  return { models, defaultModelId };
};

export const loadModelMru = async (instanceId: string): Promise<string[]> => {
  const data = await window.ember.modelsGet(instanceId);
  return Array.isArray(data) ? data.filter((value): value is string => typeof value === 'string') : [];
};

export const saveModelMru = async (instanceId: string, order: string[]): Promise<void> => {
  await window.ember.modelsSet(instanceId, order);
};

export const sendPrompt = async (
  instanceId: string,
  sessionId: string,
  text: string,
  model?: ModelOption,
  mode?: string
): Promise<{ ok: boolean; status: number; data: unknown }> => {
  const body: Record<string, unknown> = { parts: [{ type: 'text', text }] };
  if (model) body.model = { providerID: model.providerID, modelID: model.modelID };
  if (mode) body.agent = mode;

  return window.ember.request(
    instanceId,
    'POST',
    `/api/session/${encodeURIComponent(sessionId)}/prompt_async`,
    body
  );
};
