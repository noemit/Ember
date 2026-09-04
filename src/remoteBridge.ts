import type { EmberBridge, EmberSettings, EmberSettingsPatch } from './types';

type ApiResponse = { ok: boolean; status: number; data: unknown };

const request = async (
  path: string,
  init?: RequestInit
): Promise<Response> => fetch(path, { ...init, credentials: 'same-origin' });

const bridge: EmberBridge = {
  listInstances: async () => (await request('/remote/instances')).json(),
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
};

window.ember = bridge;
