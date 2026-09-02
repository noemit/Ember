export type InstanceKind = 'local' | 'remote' | 'ssh' | 'relay';

export type InstanceStatus = 'ready' | 'unreachable' | 'unsupported';

export type Instance = {
  id: string;
  label: string;
  kind: InstanceKind;
  url?: string;
  status: InstanceStatus;
  attachable: boolean;
};

export type Project = {
  id: string;
  name: string;
  path?: string;
};

export type Session = {
  id: string;
  instanceId: string;
  title?: string;
  directory?: string;
  updated?: number;
};

export type SessionRef = {
  instanceId: string;
  sessionId: string;
};

/** Stable key for a session across instances (session ids are only unique per instance). */
export const sessionKey = (ref: SessionRef | Session): string =>
  `${ref.instanceId}::${'sessionId' in ref ? ref.sessionId : ref.id}`;

export type BallState = 'idle' | 'active' | 'needs-input' | 'error';

export type BlobStyle = 'gem' | 'grok';

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

export type EmberSettings = {
  theme: string;
  blobStyle: BlobStyle;
};

export type EmberBridge = {
  listInstances(): Promise<unknown>;
  getSettings(): Promise<EmberSettings>;
  setSettings(patch: Partial<EmberSettings>): Promise<EmberSettings>;
  modelsGet(instanceId: string): Promise<string[]>;
  modelsSet(instanceId: string, order: string[]): Promise<null>;
  request(
    instanceId: string,
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ ok: boolean; status: number; data: unknown }>;
};

declare global {
  interface Window {
    ember: EmberBridge;
  }
}
