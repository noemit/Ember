import { contextBridge, ipcRenderer } from 'electron';

type ApiResponse = { ok: boolean; status: number; data: unknown };

const ember = {
  listInstances: (): Promise<unknown> => ipcRenderer.invoke('ember:instances'),
  windowInstance: (): Promise<string | null> => ipcRenderer.invoke('ember:window-instance'),
  openInstance: (instanceId: string, mode: 'replace' | 'new'): Promise<null> =>
    ipcRenderer.invoke('ember:open', { instanceId, mode }),
  getTheme: (instanceId: string): Promise<string> =>
    ipcRenderer.invoke('ember:theme:get', { instanceId }),
  setTheme: (instanceId: string, themeId: string): Promise<null> =>
    ipcRenderer.invoke('ember:theme:set', { instanceId, themeId }),
  request: (
    instanceId: string,
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse> => ipcRenderer.invoke('ember:api', { instanceId, method, path, body }),
  onInstanceChanged: (handler: (instanceId: string) => void): (() => void) => {
    const listener = (_event: unknown, instanceId: string) => handler(instanceId);
    ipcRenderer.on('ember:instance-changed', listener);
    return () => ipcRenderer.removeListener('ember:instance-changed', listener);
  },
};

contextBridge.exposeInMainWorld('ember', ember);
