import { contextBridge, ipcRenderer } from 'electron';

type ApiResponse = { ok: boolean; status: number; data: unknown };

type BlobStyle = 'gem' | 'grok';
type EmberSettings = { theme: string; blobStyle: BlobStyle };

const ember = {
  listInstances: (): Promise<unknown> => ipcRenderer.invoke('ember:instances'),
  getSettings: (): Promise<EmberSettings> => ipcRenderer.invoke('ember:settings:get'),
  setSettings: (patch: Partial<EmberSettings>): Promise<EmberSettings> =>
    ipcRenderer.invoke('ember:settings:set', patch),
  modelsGet: (instanceId: string): Promise<string[]> =>
    ipcRenderer.invoke('ember:models:get', { instanceId }),
  modelsSet: (instanceId: string, order: string[]): Promise<null> =>
    ipcRenderer.invoke('ember:models:set', { instanceId, order }),
  request: (
    instanceId: string,
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse> => ipcRenderer.invoke('ember:api', { instanceId, method, path, body }),
};

contextBridge.exposeInMainWorld('ember', ember);
