const API_METHODS = new Set(['GET', 'POST', 'PATCH']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const DEFAULT_LOCAL_PORT = 57123;

export type ApiMethod = 'GET' | 'POST' | 'PATCH';

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

export const parseColorAssignments = (value: unknown, colorCount = 64): Record<string, number> => {
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

export const parseSessionNotes = (value: unknown): Record<string, string> => {
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
          entry[1].length <= 20_000
      )
      .slice(0, 2000)
  );
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
        const colorIndex = Number.isInteger(entry.colorIndex) && Number(entry.colorIndex) >= 0 && Number(entry.colorIndex) < 64
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
