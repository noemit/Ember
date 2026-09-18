import type { EmberBridge, EmberSettings, EmberSettingsPatch } from './types';

type ApiResponse = { ok: boolean; status: number; data: unknown };

const request = async (
  path: string,
  init?: RequestInit
): Promise<Response> => fetch(path, { ...init, credentials: 'same-origin' });

const statsRequest = async (path: string, method = 'GET', body?: unknown) => {
  const response = await request(path, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok || response.redirected) throw new Error('Could not save model experience. Check your remote connection.');
  return response.json();
};

const bridge: EmberBridge = {
  getModelStats: () => statsRequest('/remote/model-stats'),
  observeModels: (observations) => statsRequest('/remote/model-stats', 'POST', observations),
  rateModel: async (id, rating) => { await statsRequest('/remote/model-rating', 'POST', { id, rating }); },
  clearModelStats: async () => { await statsRequest('/remote/model-stats', 'DELETE'); },
  capabilities: { dockIcon: false },
  listInstances: async (refresh = true) => (await request(`/remote/instances?refresh=${refresh}`)).json(),
  getSettings: async () => (await request('/remote/settings')).json() as Promise<EmberSettings>,
  setSettings: async (patch: EmberSettingsPatch) =>
    (await request('/remote/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })).json() as Promise<EmberSettings>,
  openExternal: async () => false,
  setDockIcon: async () => undefined,
  request: async (instanceId: string, method: string, path: string, body?: unknown): Promise<ApiResponse> =>
    (await request('/remote/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId, method, path, body }),
    })).json() as Promise<ApiResponse>,
  // EventSource reconnects on its own and sends the session cookie, so the relay's auth holds.
  // The relay replays each instance's live status first, so no separate eventStatus is needed.
  onEvent: (listener) => {
    const source = new EventSource('/remote/events');
    source.onmessage = (message) => {
      try {
        listener(JSON.parse(message.data));
      } catch {
        // A malformed frame is the relay's bug, not a reason to drop the subscription.
      }
    };
    return () => source.close();
  },
};

window.ember = bridge;
