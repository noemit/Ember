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

export type ModelRef = {
  providerID: string;
  modelID: string;
};

export type AgentMode = 'build' | 'plan';

export type InstanceDefaults = {
  directory?: string;
  agent?: AgentMode;
  model?: ModelRef;
  bypass?: boolean;
  markerColor?: number;
};

export type NewSessionOptions = {
  instanceId: string;
  directory: string;
  agent: AgentMode;
  model?: ModelRef;
  bypass: boolean;
};

export const modelRefKey = (ref: ModelRef): string => `${ref.providerID}/${ref.modelID}`;
export const DEFAULT_MODEL = 'default';

export type Session = {
  id: string;
  instanceId: string;
  title?: string;
  directory?: string;
  updated?: number;
  /** Model the session last ran with, as reported by the instance. */
  model?: ModelRef;
  /** Epoch ms when the session was archived on its OpenChamber instance; unset/0 means active. */
  archived?: number;
  /** Set on subagent sessions spawned by another session (OpenCode's `parentID`). */
  parentId?: string;
};

export type SessionRef = {
  instanceId: string;
  sessionId: string;
};

/** Stable key for a session across instances (session ids are only unique per instance). */
export const sessionKey = (ref: SessionRef | Session): string =>
  `${ref.instanceId}::${'sessionId' in ref ? ref.sessionId : ref.id}`;

export type BallState = 'idle' | 'active' | 'needs-input' | 'error';

/** Where the open session's transcript is: first fetch in flight, failed (poll keeps retrying), or loaded. */
export type MessagesStatus = 'loading' | 'error' | 'ready';

export type BlobStyle = 'gem' | 'grok' | 'glyph' | 'critter';

export type AvatarOverride = {
  colorIndex?: number;
  shapeName?: string;
};

export type AvatarIdentity = {
  sessionKey: string;
  projectKey?: string;
  taskKey?: string;
  colorSeed: string;
  shapeSeed: string;
  motionSeed: string;
  colorIndex?: number;
  shapeName?: string;
};

export type ToolStatus = 'pending' | 'running' | 'completed' | 'error';

export type ToolCall = {
  id: string;
  tool: string;
  status: ToolStatus;
  /** Server-provided summary of the call, e.g. the bash command or file path. */
  title?: string;
  error?: string;
  input?: Record<string, unknown>;
  /** Tool output, truncated by the API layer so a chatty command can't bloat the transcript. */
  output?: string;
  /** Unified diff for edit/write tools when the server provides one. */
  diff?: string;
};

export type FileAttachment = {
  filename: string;
  mime: string;
  /** `data:` URL for outgoing attachments; whatever the server stored for history. */
  url: string;
};

/** Message content in the order it was produced; text, reasoning, files and tool calls interleave. */
export type MessagePart =
  | { type: 'text'; id: string; text: string }
  | { type: 'reasoning'; id: string; text: string }
  | { type: 'file'; id: string; file: FileAttachment }
  | { type: 'tool'; id: string; call: ToolCall };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  /** Concatenated text parts, kept for previews and search. */
  text: string;
  parts: MessagePart[];
  model?: ModelRef;
  error?: string;
  createdAt?: number;
  completedAt?: number;
  /** False while the assistant is still producing this message. */
  completed: boolean;
};

export type PermissionReply = 'once' | 'always' | 'reject';

export type PermissionRequest = {
  id: string;
  instanceId: string;
  sessionId: string;
  /** Tool or capability being requested, e.g. `bash`, `edit`, `webfetch`. */
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
};

export type QuestionOption = {
  label: string;
  description: string;
};

export type QuestionInfo = {
  /** Short tab label, e.g. "Auth method". */
  header: string;
  question: string;
  options: QuestionOption[];
  multiple?: boolean;
  /** Whether a free-text answer is allowed. OpenCode defaults this to true. */
  custom?: boolean;
};

export type QuestionRequest = {
  id: string;
  instanceId: string;
  sessionId: string;
  questions: QuestionInfo[];
};

/** One answer per question: the chosen option labels, or a single custom string. */
export type QuestionAnswers = string[][];

export type ModelDetails = {
  name: string;
  providerName: string;
  family?: string;
  releaseDate?: string;
  /** 'active' | 'beta' | 'deprecated' | … as reported by the provider catalogue. */
  status?: string;
  contextTokens?: number;
  outputTokens?: number;
  /** USD per million tokens. */
  costInput?: number;
  costOutput?: number;
  reasoning: boolean;
  toolcall: boolean;
  attachment: boolean;
  /** Input modalities beyond text, e.g. ['image', 'pdf']. */
  inputs: string[];
  /** Reasoning-effort variants the model accepts, e.g. ['low', 'high']. */
  variants: string[];
};

export type ModelOption = ModelRef & {
  label: string;
  details: ModelDetails;
};

export type EmberSettings = {
  theme: string;
  blobStyle: BlobStyle;
  /** Only list sessions active within this many hours; 0 means show everything. */
  sessionWindowHours: number;
  instanceDefaults: Record<string, InstanceDefaults>;
  pinnedMessages: string[];
  sessionNotes: Record<string, string>;
  scheduledSessionBindings: Record<string, string>;
  avatarOverrides: Record<string, AvatarOverride>;
  projectColorAssignments: Record<string, number>;
  remoteAccessEnabled: boolean;
  remotePasswordConfigured: boolean;
};

export type EmberSettingsPatch = Partial<EmberSettings> & {
  /** Plaintext is accepted only transiently and is hashed by Electron before persistence. */
  remotePassword?: string | null;
};

export const SESSION_WINDOWS: Array<{ hours: number; label: string }> = [
  { hours: 5, label: 'Last 5 hours' },
  { hours: 24, label: 'Last day' },
  { hours: 48, label: 'Last 2 days' },
  { hours: 120, label: 'Last 5 days' },
  { hours: 24 * 14, label: 'Last 2 weeks' },
  { hours: 0, label: 'All time' },
];

export type EmberBridge = {
  listInstances(): Promise<unknown>;
  getSettings(): Promise<EmberSettings>;
  setSettings(patch: EmberSettingsPatch): Promise<EmberSettings>;
  /** Open an http(s) URL in the default browser or reveal a local path in Finder. */
  openExternal(target: string): Promise<boolean>;
  /** Replace the Dock icon with a PNG data URL (macOS only; a no-op elsewhere). */
  setDockIcon(dataUrl: string): Promise<void>;
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
