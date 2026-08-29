export type InstanceKind = 'local' | 'remote' | 'ssh' | 'relay';

export type Instance = {
  id: string;
  label: string;
  kind: InstanceKind;
  url?: string;
  attachable: boolean;
};

export type Project = {
  id: string;
  name: string;
  path?: string;
};

export type Session = {
  id: string;
  title?: string;
  directory?: string;
  updated?: number;
};

export type BallState = 'idle' | 'active' | 'needs-input' | 'error';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export type ModelOption = {
  providerID: string;
  modelID: string;
  label: string;
};

export type EmberBridge = {
  listInstances(): Promise<unknown>;
  windowInstance(): Promise<string | null>;
  openInstance(instanceId: string, mode: 'replace' | 'new'): Promise<null>;
  getTheme(instanceId: string): Promise<string>;
  setTheme(instanceId: string, themeId: string): Promise<null>;
  request(
    instanceId: string,
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ ok: boolean; status: number; data: unknown }>;
  onInstanceChanged(handler: (instanceId: string) => void): () => void;
};

declare global {
  interface Window {
    ember: EmberBridge;
  }
}
