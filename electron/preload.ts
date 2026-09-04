import { contextBridge, ipcRenderer } from 'electron';

type ApiResponse = { ok: boolean; status: number; data: unknown };

type BlobStyle = 'gem' | 'grok' | 'glyph' | 'critter';
type InstanceDefaults = {
  directory?: string;
  agent?: 'build' | 'plan';
  model?: { providerID: string; modelID: string };
  bypass?: boolean;
};
type AvatarOverride = { colorIndex?: number; shapeName?: string };
type EmberSettings = {
  theme: string;
  blobStyle: BlobStyle;
  sessionWindowHours: number;
  instanceDefaults: Record<string, InstanceDefaults>;
  pinnedMessages: string[];
  scheduledSessionBindings: Record<string, string>;
  avatarOverrides: Record<string, AvatarOverride>;
  remoteAccessEnabled: boolean;
  remotePasswordConfigured: boolean;
};

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
