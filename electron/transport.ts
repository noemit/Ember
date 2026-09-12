const API_METHODS = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const DEFAULT_LOCAL_PORT = 57123;

/** Mirrors AVATAR_COLOR_COUNT in src/blob/contrast.ts (the two tsconfig roots can't share it). */
const AVATAR_COLOR_COUNT = 22;

export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const parseHttpUrl = (value: string): URL | null => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.search = '';
    url.hash = '';
    return url;
  } catch {
    return null;
  }
};

export const isLocalHttpUrl = (value: string): boolean => {
  const url = parseHttpUrl(value);
  return Boolean(url && LOCAL_HOSTS.has(url.hostname.toLowerCase()));
};

export const localInstanceUrl = (settings: Record<string, unknown>): string | null => {
  const configuredPort = settings.desktopLocalPort;
  if (configuredPort !== undefined) {
    if (
      typeof configuredPort !== 'number' ||
      !Number.isInteger(configuredPort) ||
      configuredPort < 1 ||
      configuredPort > 65_535
    ) {
      return null;
    }
    return `http://127.0.0.1:${configuredPort}`;
  }
  return typeof settings.desktopLocalClientToken === 'string' && settings.desktopLocalClientToken.trim()
    ? `http://127.0.0.1:${DEFAULT_LOCAL_PORT}`
    : null;
};

export const normalizeApiMethod = (value: unknown): ApiMethod | null => {
  if (typeof value !== 'string') return null;
  const method = value.toUpperCase();
  return API_METHODS.has(method) ? (method as ApiMethod) : null;
};

export const resolveApiUrl = (baseValue: string, apiPath: unknown): string | null => {
  const base = parseHttpUrl(baseValue);
  if (
    !base ||
    typeof apiPath !== 'string' ||
    !/^\/api(?:[/?]|$)/.test(apiPath) ||
    apiPath.startsWith('//') ||
    // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
    /[\\\u0000-\u001f\u007f]/.test(apiPath)
  ) {
    return null;
  }

  const basePath = base.pathname.replace(/\/+$/, '');
  const apiRoot = `${basePath}/api`;
  const resolved = new URL(`${base.origin}${basePath}${apiPath}`);
  if (
    resolved.origin !== base.origin ||
    (resolved.pathname !== apiRoot && !resolved.pathname.startsWith(`${apiRoot}/`))
  ) {
    return null;
  }
  return resolved.toString();
};

export type StoredAvatarOverride = {
  colorIndex?: number;
  shapeName?: string;
};

const UNSAFE_RECORD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const parseStringRecord = (value: unknown, limit = 2000): Record<string, string> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        (entry): entry is [string, string] =>
          !UNSAFE_RECORD_KEYS.has(entry[0]) &&
          entry[0].length > 0 &&
          entry[0].length <= 500 &&
          typeof entry[1] === 'string' &&
          entry[1].length > 0 &&
          entry[1].length <= 500
      )
      .slice(0, limit)
  );
};

export const parseColorAssignments = (value: unknown, colorCount = AVATAR_COLOR_COUNT): Record<string, number> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        (entry): entry is [string, number] =>
          !UNSAFE_RECORD_KEYS.has(entry[0]) &&
          entry[0].length > 0 &&
          entry[0].length <= 500 &&
          Number.isInteger(entry[1]) &&
          Number(entry[1]) >= 0 &&
          Number(entry[1]) < colorCount
      )
      .slice(0, 4000)
  );
};

export type StoredSessionNote = {
  id: string;
  text: string;
};

const MAX_SESSION_NOTES = 100;

const toStoredSessionNote = (value: unknown, fallbackId: string): StoredSessionNote | null => {
  if (typeof value === 'string') {
    return value.trim() && value.length <= 20_000 ? { id: fallbackId, text: value } : null;
  }
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  const text = typeof entry.text === 'string' ? entry.text : '';
  if (!text.trim() || text.length > 20_000) return null;
  const id = typeof entry.id === 'string' && /^[a-z0-9_-]{1,120}$/i.test(entry.id)
    ? entry.id
    : fallbackId;
  return { id, text };
};

/** Notes saved per session; a lone string (or legacy single-note map) becomes one entry. */
export const parseSessionNotes = (value: unknown): Record<string, StoredSessionNote[]> => {
  if (!value || typeof value !== 'object') return {};
  const notes: Record<string, StoredSessionNote[]> = {};
  Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !UNSAFE_RECORD_KEYS.has(key) && key.length > 0 && key.length <= 500)
    .slice(0, 2000)
    .forEach(([key, raw]) => {
      const parsed = (Array.isArray(raw) ? raw : [raw])
        .slice(0, MAX_SESSION_NOTES)
        .map((entry, index) => toStoredSessionNote(entry, index === 0 ? 'legacy' : `legacy-${index}`))
        .filter((entry): entry is StoredSessionNote => Boolean(entry));
      if (parsed.length) notes[key] = parsed;
    });
  return notes;
};

export type StoredComposerDraft = {
  text: string;
  modelId?: string;
  variant?: string;
  mode?: string;
  updatedAt: number;
};

export const parseComposerDrafts = (value: unknown): Record<string, StoredComposerDraft> => {
  if (!value || typeof value !== 'object') return {};
  const drafts: Record<string, StoredComposerDraft> = {};
  Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !UNSAFE_RECORD_KEYS.has(key) && key.length > 0 && key.length <= 500)
    .slice(-50)
    .forEach(([key, raw]) => {
      if (!raw || typeof raw !== 'object') return;
      const entry = raw as Record<string, unknown>;
      const text = typeof entry.text === 'string' ? entry.text : '';
      const modelId = typeof entry.modelId === 'string' && entry.modelId.length <= 300 ? entry.modelId : undefined;
      const variant = typeof entry.variant === 'string' && entry.variant.length <= 100 ? entry.variant : undefined;
      const mode = typeof entry.mode === 'string' && entry.mode.length <= 100 ? entry.mode : undefined;
      if ((!text.trim() && !modelId && !variant && !mode) || text.length > 200_000) return;
      const draft: StoredComposerDraft = {
        text,
        updatedAt: typeof entry.updatedAt === 'number' && entry.updatedAt > 0 ? entry.updatedAt : Date.now(),
      };
      if (modelId) draft.modelId = modelId;
      if (variant) draft.variant = variant;
      if (mode) draft.mode = mode;
      drafts[key] = draft;
    });
  return drafts;
};

export const parseAvatarOverrides = (value: unknown): Record<string, StoredAvatarOverride> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key, raw]) =>
          !UNSAFE_RECORD_KEYS.has(key) &&
          key.length > 0 &&
          key.length <= 500 &&
          raw &&
          typeof raw === 'object'
      )
      .slice(0, 2000)
      .map(([key, raw]) => {
        const entry = raw as Record<string, unknown>;
        const colorIndex = Number.isInteger(entry.colorIndex) && Number(entry.colorIndex) >= 0 && Number(entry.colorIndex) < AVATAR_COLOR_COUNT
          ? Number(entry.colorIndex)
          : undefined;
        const shapeName = typeof entry.shapeName === 'string' && /^[a-z0-9-]{1,80}$/i.test(entry.shapeName)
          ? entry.shapeName
          : undefined;
        return [key, { colorIndex, shapeName }] as const;
      })
      .filter(([, entry]) => entry.colorIndex !== undefined || entry.shapeName !== undefined)
  );
};

/*
 * Settings contract shared by the main process and the preload bridge. The renderer has its
 * own copy in src/types.ts on purpose: main parses persisted JSON into these trusted shapes,
 * and the two tsconfigs have separate roots, so they can't import each other.
 */
export type BlobStyle = 'buddy' | 'glyph';

export const BLOB_STYLES: BlobStyle[] = ['buddy', 'glyph'];
export const isBlobStyle = (value: unknown): value is BlobStyle =>
  typeof value === 'string' && (BLOB_STYLES as string[]).includes(value);

export type ReasoningDisplay = 'expanded' | 'collapsed' | 'hidden';

const REASONING_DISPLAYS: ReasoningDisplay[] = ['expanded', 'collapsed', 'hidden'];
export const isReasoningDisplay = (value: unknown): value is ReasoningDisplay =>
  typeof value === 'string' && (REASONING_DISPLAYS as string[]).includes(value);

export type InstanceDefaults = {
  directory?: string;
  agent?: string;
  model?: { providerID: string; modelID: string; variant?: string };
  variant?: string;
  bypass?: boolean;
  markerColor?: number;
};

export type EmberSettings = {
  theme: string;
  blobStyle: BlobStyle;
  /** Only list sessions active within this many hours; 0 means no limit. */
  sessionWindowHours: number;
  hideToolCalls: boolean;
  reasoningDisplay: ReasoningDisplay;
  instanceDefaults: Record<string, InstanceDefaults>;
  pinnedMessages: string[];
  sessionNotes: Record<string, StoredSessionNote[]>;
  composerDrafts: Record<string, StoredComposerDraft>;
  scheduledSessionBindings: Record<string, string>;
  avatarOverrides: Record<string, StoredAvatarOverride>;
  projectColorAssignments: Record<string, number>;
  remoteAccessEnabled: boolean;
  remotePasswordConfigured: boolean;
};
