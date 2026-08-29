import type { BallState, ChatMessage, Instance, ModelOption, Project, Session } from './types';

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export const listInstances = async (): Promise<Instance[]> =>
  asArray(await window.ember.listInstances()) as Instance[];

export const loadProjects = async (instanceId: string): Promise<Project[]> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/config/settings');
  const root = asRecord(response.data);
  return asArray(root.projects).map((entry, index) => {
    const item = asRecord(entry);
    const id = String(item.id ?? item.path ?? `project-${index}`);
    return {
      id,
      name: String(item.name ?? item.title ?? id),
      path: typeof item.path === 'string' ? item.path : undefined,
    };
  });
};

export const loadSessions = async (instanceId: string): Promise<Session[]> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/session');
  return asArray(response.data).map((entry, index) => {
    const item = asRecord(entry);
    const time = asRecord(item.time);
    return {
      id: String(item.id ?? `session-${index}`),
      title: typeof item.title === 'string' ? item.title : undefined,
      directory: typeof item.directory === 'string' ? item.directory : undefined,
      updated: typeof time.updated === 'number' ? time.updated : undefined,
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
  const list = Array.isArray(response.data) ? response.data : asArray(asRecord(response.data).messages);

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

export const loadModels = async (instanceId: string): Promise<ModelOption[]> => {
  const response = await window.ember.request(instanceId, 'GET', '/api/config/providers');
  const root = asRecord(response.data);
  const providers = Array.isArray(response.data) ? response.data : asArray(root.providers);

  const models: ModelOption[] = [];
  providers.forEach((provider) => {
    const item = asRecord(provider);
    const providerID = String(item.id ?? item.providerID ?? item.name ?? '');
    asArray(item.models).forEach((model) => {
      const modelItem = asRecord(model);
      const modelID = String(modelItem.id ?? modelItem.modelID ?? modelItem.name ?? '');
      if (!providerID || !modelID) return;
      models.push({ providerID, modelID, label: `${providerID} / ${modelID}` });
    });
  });
  return models;
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
  if (mode) body.mode = mode;
  return window.ember.request(
    instanceId,
    'POST',
    `/api/session/${encodeURIComponent(sessionId)}/prompt_async`,
    body
  );
};
