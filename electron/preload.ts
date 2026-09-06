import { contextBridge, ipcRenderer } from 'electron';
import type { EmberSettings } from './transport';

type ApiResponse = { ok: boolean; status: number; data: unknown };

const ember = {
  listInstances: (): Promise<unknown> => ipcRenderer.invoke('ember:instances'),
  getSettings: (): Promise<EmberSettings> => ipcRenderer.invoke('ember:settings:get'),
  setSettings: (patch: Partial<EmberSettings>): Promise<EmberSettings> =>
    ipcRenderer.invoke('ember:settings:set', patch),
  openExternal: (target: string): Promise<boolean> => ipcRenderer.invoke('ember:open', { target }),
  setDockIcon: (dataUrl: string): Promise<void> => ipcRenderer.invoke('ember:dock-icon', { dataUrl }),
  request: (
    instanceId: string,
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse> => ipcRenderer.invoke('ember:api', { instanceId, method, path, body }),
};

contextBridge.exposeInMainWorld('ember', ember);
