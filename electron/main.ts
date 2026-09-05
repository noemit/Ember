import { app, BrowserWindow, ipcMain, nativeImage, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  isLocalHttpUrl,
  localInstanceUrl,
  normalizeApiMethod,
  parseAvatarOverrides,
  parseColorAssignments,
  parseSessionNotes,
  parseStringRecord,
  resolveApiUrl,
  type StoredAvatarOverride,
} from './transport';
import { startRemoteServer } from './remoteServer';
import { hashRemotePassword, verifyRemotePassword } from './remoteAuth';

type StoredHost = {
  id?: string;
  label?: string;
  url?: string;
  apiUrl?: string;
  token?: string;
  clientToken?: string;
  requestHeaders?: Record<string, string>;
  relay?: unknown;
};

type StoredSshInstance = {
  id?: string;
  nickname?: string;
  host?: string;
  sshParsed?: { destination?: string };
};

type InstanceStatus = 'ready' | 'unreachable' | 'unsupported';

type Instance = {
  id: string;
  label: string;
  kind: 'local' | 'remote' | 'ssh' | 'relay';
  url?: string;
  status: InstanceStatus;
  attachable: boolean;
};

type BlobStyle = 'gem' | 'grok' | 'glyph' | 'critter';

const BLOB_STYLES: BlobStyle[] = ['gem', 'grok', 'glyph', 'critter'];
const isBlobStyle = (value: unknown): value is BlobStyle =>
  typeof value === 'string' && (BLOB_STYLES as string[]).includes(value);

type InstanceDefaults = {
  directory?: string;
  agent?: 'build' | 'plan';
  model?: { providerID: string; modelID: string };
  bypass?: boolean;
  markerColor?: number;
};

type EmberSettings = {
  theme: string;
  blobStyle: BlobStyle;
  /** Only list sessions active within this many hours; 0 means no limit. */
  sessionWindowHours: number;
  instanceDefaults: Record<string, InstanceDefaults>;
  pinnedMessages: string[];
  sessionNotes: Record<string, string>;
  scheduledSessionBindings: Record<string, string>;
  avatarOverrides: Record<string, StoredAvatarOverride>;
  projectColorAssignments: Record<string, number>;
  remoteAccessEnabled: boolean;
  remotePasswordConfigured: boolean;
};

const DEFAULT_THEME_ID = 'stone';
const DEFAULT_BLOB_STYLE: BlobStyle = 'grok';
const DEFAULT_SESSION_WINDOW_HOURS = 48;

const isWindowHours = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const parseInstanceDefaults = (value: unknown): Record<string, InstanceDefaults> => {
  if (!value || typeof value !== 'object') return {};
  const defaults: Record<string, InstanceDefaults> = {};
  Object.entries(value as Record<string, unknown>).forEach(([instanceId, raw]) => {
    if (!instanceId || !raw || typeof raw !== 'object') return;
    const entry = raw as Record<string, unknown>;
    const model = entry.model && typeof entry.model === 'object'
      ? (entry.model as Record<string, unknown>)
      : {};
    const providerID = typeof model.providerID === 'string' ? model.providerID : '';
    const modelID = typeof model.modelID === 'string' ? model.modelID : '';
    defaults[instanceId] = {
      directory: typeof entry.directory === 'string' && entry.directory ? entry.directory : undefined,
      agent: entry.agent === 'build' || entry.agent === 'plan' ? entry.agent : undefined,
      model: providerID && modelID ? { providerID, modelID } : undefined,
      bypass: typeof entry.bypass === 'boolean' ? entry.bypass : undefined,
      markerColor: Number.isInteger(entry.markerColor) && Number(entry.markerColor) >= 0 && Number(entry.markerColor) < 12
        ? Number(entry.markerColor)
        : undefined,
    };
  });
  return defaults;
};

const PROBE_TIMEOUT_MS = 1500;
const API_TIMEOUT_MS = 20_000;
const MAX_API_BODY_BYTES = 32 * 1024 * 1024;
const MAX_API_RESPONSE_BYTES = 32 * 1024 * 1024;
const MAX_DOCK_ICON_BYTES = 2 * 1024 * 1024;

const openchamberSettingsPath = (): string =>
  process.env.OPENCHAMBER_DATA_DIR
    ? path.join(process.env.OPENCHAMBER_DATA_DIR, 'settings.json')
    : path.join(os.homedir(), '.config', 'openchamber', 'settings.json');

const emberSettingsPath = (): string => path.join(os.homedir(), '.config', 'ember', 'settings.json');

const readJson = (file: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const writeJson = (file: string, data: unknown): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
};

const hostId = (host: StoredHost, index: number): string => String(host.id || `host-${index}`);

const readEmberSettings = (): EmberSettings => {
  const root = readJson(emberSettingsPath());
  // Older builds stored one theme per instance; fall back to the first of those.
  const legacyThemes =
    root.instanceThemes && typeof root.instanceThemes === 'object'
      ? Object.values(root.instanceThemes as Record<string, string>)
      : [];
  const theme = typeof root.theme === 'string' && root.theme ? root.theme : legacyThemes[0];
  return {
    theme: theme || DEFAULT_THEME_ID,
    blobStyle: isBlobStyle(root.blobStyle) ? root.blobStyle : DEFAULT_BLOB_STYLE,
    sessionWindowHours: isWindowHours(root.sessionWindowHours)
      ? root.sessionWindowHours
      : DEFAULT_SESSION_WINDOW_HOURS,
    instanceDefaults: parseInstanceDefaults(root.instanceDefaults),
    pinnedMessages: Array.isArray(root.pinnedMessages)
      ? root.pinnedMessages.filter((entry): entry is string => typeof entry === 'string').slice(0, 2000)
      : [],
    sessionNotes: parseSessionNotes(root.sessionNotes),
    scheduledSessionBindings: parseStringRecord(root.scheduledSessionBindings),
    avatarOverrides: parseAvatarOverrides(root.avatarOverrides),
    projectColorAssignments: parseColorAssignments(root.projectColorAssignments),
    remoteAccessEnabled: root.remoteAccessEnabled === true,
    remotePasswordConfigured: typeof root.remotePasswordHash === 'string' && root.remotePasswordHash.length > 0,
  };
};

const hostUrl = (host: StoredHost): string => {
  const url = typeof host.url === 'string' ? host.url : '';
  return typeof host.apiUrl === 'string' && host.apiUrl ? host.apiUrl : url;
};

const localHost = (root: Record<string, unknown>): StoredHost | null => {
  const url = localInstanceUrl(root);
  return url ? { id: 'local', label: 'Local', url } : null;
};

const hostToken = (host: StoredHost, root: Record<string, unknown>): string => {
  if (typeof host.clientToken === 'string' && host.clientToken.trim()) return host.clientToken.trim();
  if (typeof host.token === 'string' && host.token.trim()) return host.token.trim();
  if (isLocalHttpUrl(hostUrl(host)) && typeof root.desktopLocalClientToken === 'string') {
    return root.desktopLocalClientToken;
  }
  return '';
};

const hostHeaders = (host: StoredHost, root: Record<string, unknown>): Record<string, string> => {
  const headers = Object.fromEntries(
    Object.entries(host.requestHeaders ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );
  const token = hostToken(host, root);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const probeHealth = async (url: string, headers: Record<string, string>): Promise<boolean> => {
  const healthUrl = resolveApiUrl(url, '/api/health');
  if (!healthUrl) return false;
  try {
    const response = await fetch(healthUrl, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const loadInstances = async (): Promise<Instance[]> => {
  const root = readJson(openchamberSettingsPath());
  const hosts = Array.isArray(root.desktopHosts) ? (root.desktopHosts as StoredHost[]) : [];
  const sshInstances = Array.isArray(root.desktopSshInstances)
    ? (root.desktopSshInstances as StoredSshInstance[])
    : [];

  const hostIds = new Set(hosts.map((host, index) => hostId(host, index)));
  const candidates: Array<{ instance: Instance; headers: Record<string, string> }> = [];
  const local = localHost(root);
  if (local) {
    hostIds.add('local');
    candidates.push({
      instance: {
        id: 'local',
        label: 'Local',
        kind: 'local',
        url: local.url,
        status: 'unreachable',
        attachable: false,
      },
      headers: hostHeaders(local, root),
    });
  }

  hosts.forEach((host, index) => {
    const url = hostUrl(host);
    const rawUrl = typeof host.url === 'string' ? host.url : '';
    const isRelay = rawUrl.startsWith('relay://') || Boolean(host.relay);
    const id = hostId(host, index);
    const sshMatch = sshInstances.find((entry) => String(entry.id || '') === id);
    const kind: Instance['kind'] = isRelay
      ? 'relay'
      : sshMatch
        ? 'ssh'
        : isLocalHttpUrl(url)
          ? 'local'
          : 'remote';
    const usable = !isRelay && Boolean(resolveApiUrl(url, '/api/health'));

    candidates.push({
      instance: {
        id,
        label: host.label || (isRelay ? rawUrl : url) || id,
        kind,
        url: usable ? url : undefined,
        status: usable ? 'unreachable' : 'unsupported',
        attachable: false,
      },
      headers: hostHeaders(host, root),
    });
  });

  sshInstances.forEach((entry, index) => {
    const id = String(entry.id || `ssh-${index}`);
    if (hostIds.has(id)) return;

    candidates.push({
      instance: {
        id,
        label: entry.nickname || entry.sshParsed?.destination || entry.host || id,
        kind: 'ssh',
        status: 'unsupported',
        attachable: false,
      },
      headers: {},
    });
  });

  await Promise.all(
    candidates.map(async (candidate) => {
      const url = candidate.instance.url;
      if (!url || candidate.instance.status === 'unsupported') return;
      const reachable = await probeHealth(url, candidate.headers);
      candidate.instance.status = reachable ? 'ready' : 'unreachable';
      candidate.instance.attachable = reachable;
    })
  );

  return candidates.map((candidate) => candidate.instance);
};

const instanceTarget = (instanceId: string): { url: string; headers: Record<string, string> } | null => {
  const root = readJson(openchamberSettingsPath());
  const hosts = Array.isArray(root.desktopHosts) ? (root.desktopHosts as StoredHost[]) : [];
  const host =
    instanceId === 'local'
      ? localHost(root)
      : hosts.find((entry, index) => hostId(entry, index) === instanceId) ?? null;
  if (!host) return null;

  const rawUrl = hostUrl(host);
  const rawDirectUrl = typeof host.url === 'string' ? host.url : '';
  if (!resolveApiUrl(rawUrl, '/api/health') || rawDirectUrl.startsWith('relay://')) return null;

  return { url: rawUrl, headers: hostHeaders(host, root) };
};

const rendererFile = (): string => path.join(__dirname, '..', 'dist', 'index.html');

const isTrustedSender = (event: IpcMainInvokeEvent): boolean => {
  try {
    if (!event.senderFrame) return false;
    const senderUrl = new URL(event.senderFrame.url);
    senderUrl.search = '';
    senderUrl.hash = '';
    return senderUrl.protocol === 'file:' && fileURLToPath(senderUrl) === rendererFile();
  } catch {
    return false;
  }
};

const assertTrustedSender = (event: IpcMainInvokeEvent): void => {
  if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender');
};

const createWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'Ember',
    backgroundColor: '#151413',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const allowedUrl = pathToFileURL(rendererFile()).toString();
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const candidate = new URL(url);
      candidate.search = '';
      candidate.hash = '';
      if (candidate.toString() !== allowedUrl) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  win.once('ready-to-show', () => win.show());
  void win.loadFile(rendererFile()).catch((error) => {
    console.error('Failed to load renderer', error);
    if (!win.isDestroyed()) win.show();
  });
  return win;
};

const readResponseText = async (response: Response): Promise<string> => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_API_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error('Response body is too large');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_API_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Response body is too large');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total).toString('utf8');
};

ipcMain.handle('ember:instances', (event) => {
  assertTrustedSender(event);
  return loadInstances();
});

ipcMain.handle('ember:settings:get', (event) => {
  assertTrustedSender(event);
  return readEmberSettings();
});

let refreshRemoteServer: () => void = () => {};

const updateSettings = (patch: unknown): EmberSettings => {
  const value = patch && typeof patch === 'object'
    ? (patch as Partial<EmberSettings> & { remotePassword?: unknown })
    : {};
  const root = readJson(emberSettingsPath());
  const settings = readEmberSettings();
  const previousRemoteAccessEnabled = settings.remoteAccessEnabled;
  const previousRemotePasswordHash = typeof root.remotePasswordHash === 'string' ? root.remotePasswordHash : undefined;
  let remotePasswordHash = previousRemotePasswordHash;
  if (typeof value.theme === 'string' && value.theme) settings.theme = value.theme;
  if (isBlobStyle(value.blobStyle)) settings.blobStyle = value.blobStyle;
  if (isWindowHours(value.sessionWindowHours)) settings.sessionWindowHours = value.sessionWindowHours;
  if (value.instanceDefaults !== undefined) settings.instanceDefaults = parseInstanceDefaults(value.instanceDefaults);
  if (Array.isArray(value.pinnedMessages)) {
    settings.pinnedMessages = value.pinnedMessages
      .filter((entry): entry is string => typeof entry === 'string')
      .slice(0, 2000);
  }
  if (value.sessionNotes !== undefined) settings.sessionNotes = parseSessionNotes(value.sessionNotes);
  if (value.scheduledSessionBindings !== undefined) settings.scheduledSessionBindings = parseStringRecord(value.scheduledSessionBindings);
  if (value.avatarOverrides !== undefined) settings.avatarOverrides = parseAvatarOverrides(value.avatarOverrides);
  if (value.projectColorAssignments !== undefined) settings.projectColorAssignments = parseColorAssignments(value.projectColorAssignments);
  if (value.remotePassword !== undefined) {
    if (value.remotePassword === null || value.remotePassword === '') {
      remotePasswordHash = undefined;
    } else if (typeof value.remotePassword !== 'string' || value.remotePassword.length < 8 || value.remotePassword.length > 256) {
      throw new Error('Remote password must be between 8 and 256 characters');
    } else {
      remotePasswordHash = hashRemotePassword(value.remotePassword);
    }
  }
  if (value.remoteAccessEnabled !== undefined) {
    if (value.remoteAccessEnabled !== true && value.remoteAccessEnabled !== false) {
      throw new Error('Invalid remote access setting');
    }
    if (value.remoteAccessEnabled && !remotePasswordHash) {
      throw new Error('Set a remote password before enabling remote access');
    }
    settings.remoteAccessEnabled = value.remoteAccessEnabled;
  }
  settings.remotePasswordConfigured = Boolean(remotePasswordHash);
  if (!remotePasswordHash) settings.remoteAccessEnabled = false;
  writeJson(emberSettingsPath(), { ...settings, ...(remotePasswordHash ? { remotePasswordHash } : {}) });
  if (
    settings.remoteAccessEnabled !== previousRemoteAccessEnabled ||
    remotePasswordHash !== previousRemotePasswordHash
  ) refreshRemoteServer();
  return settings;
};

ipcMain.handle('ember:settings:set', (event, patch: unknown) => {
  assertTrustedSender(event);
  return updateSettings(patch);
});

/**
 * Open a link from a chat: http(s) URLs go to the default browser, absolute local paths
 * that exist are revealed in Finder. Anything else (other schemes, remote-only paths) is
 * refused so agent output can't trigger arbitrary handlers.
 */
ipcMain.handle('ember:open', async (event, args: { target?: unknown }): Promise<boolean> => {
  assertTrustedSender(event);
  const target = String(args?.target || '').trim();
  try {
    const external = new URL(target);
    if (['http:', 'https:'].includes(external.protocol) && !external.username && !external.password) {
      await shell.openExternal(external.toString());
      return true;
    }
  } catch {}

  const resolved = target.startsWith('~') ? path.join(os.homedir(), target.slice(1)) : target;
  if (!path.isAbsolute(resolved) || !fs.existsSync(resolved)) return false;
  try {
    if (fs.statSync(resolved).isDirectory()) await shell.openPath(resolved);
    else shell.showItemInFolder(resolved);
    return true;
  } catch {
    return false;
  }
});

/** The renderer rasterises the selected session's blob; the Dock shows it so the app icon says which agent you're on. */
ipcMain.handle('ember:dock-icon', (event, args: { dataUrl?: unknown }) => {
  assertTrustedSender(event);
  const dataUrl = String(args?.dataUrl || '');
  if (
    !app.dock ||
    !dataUrl.startsWith('data:image/png;base64,') ||
    Buffer.byteLength(dataUrl) > MAX_DOCK_ICON_BYTES
  ) {
    return;
  }
  try {
    const image = nativeImage.createFromDataURL(dataUrl);
    if (!image.isEmpty()) app.dock.setIcon(image);
  } catch {
    return;
  }
});

const proxyApiRequest = async (
  instanceId: string,
  rawMethod: unknown,
  apiPath: unknown,
  requestBody?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> => {
  const target = instanceTarget(instanceId);
  const method = normalizeApiMethod(rawMethod);
  const requestUrl = target ? resolveApiUrl(target.url, apiPath) : null;
  if (!target) return { ok: false, status: 0, data: { error: 'Instance is not attachable' } };
  if (!method || !requestUrl || (method === 'GET' && requestBody !== undefined)) {
    return { ok: false, status: 400, data: { error: 'Invalid API request' } };
  }
  try {
    const body = requestBody === undefined ? undefined : JSON.stringify(requestBody);
    if (body && Buffer.byteLength(body) > MAX_API_BODY_BYTES) {
      return { ok: false, status: 413, data: { error: 'Request body is too large' } };
    }
    const headers = new Headers(target.headers);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    const response = await fetch(requestUrl, { method, headers, body, redirect: 'error', signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    const text = await readResponseText(response);
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { error: error instanceof Error ? error.message : String(error) } };
  }
};

ipcMain.handle('ember:api', async (event, args: unknown) => {
  assertTrustedSender(event);
  const input = args && typeof args === 'object' ? (args as Record<string, unknown>) : {};
  return proxyApiRequest(String(input.instanceId || ''), input.method, input.path, input.body);
});

let remoteServer: ReturnType<typeof startRemoteServer> = null;
refreshRemoteServer = () => {
  remoteServer?.close();
  remoteServer = null;
  const settings = readEmberSettings();
  if (!settings.remoteAccessEnabled || !settings.remotePasswordConfigured) return;
  remoteServer = startRemoteServer(path.dirname(rendererFile()), {
    listInstances: loadInstances,
    getSettings: readEmberSettings,
    setSettings: updateSettings,
    request: proxyApiRequest,
    verifyPassword: (password) => verifyRemotePassword(password, readJson(emberSettingsPath()).remotePasswordHash),
  });
};

app.whenReady().then(() => {
  refreshRemoteServer();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
