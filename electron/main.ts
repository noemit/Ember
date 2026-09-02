import { app, BrowserWindow, ipcMain } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

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

type BlobStyle = 'gem' | 'grok';

type EmberSettings = {
  theme: string;
  blobStyle: BlobStyle;
  instanceModels: Record<string, string[]>;
};

const DEFAULT_THEME_ID = 'ember';
const DEFAULT_BLOB_STYLE: BlobStyle = 'grok';
const PROBE_TIMEOUT_MS = 1500;

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
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
};

const hostId = (host: StoredHost, index: number): string => String(host.id || `host-${index}`);

const isLocalUrl = (url: string): boolean => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(url);

const readEmberSettings = (): EmberSettings => {
  const root = readJson(emberSettingsPath());
  const models = root.instanceModels;
  // Older builds stored one theme per instance; fall back to the first of those.
  const legacyThemes =
    root.instanceThemes && typeof root.instanceThemes === 'object'
      ? Object.values(root.instanceThemes as Record<string, string>)
      : [];
  const theme = typeof root.theme === 'string' && root.theme ? root.theme : legacyThemes[0];
  return {
    theme: theme || DEFAULT_THEME_ID,
    blobStyle: root.blobStyle === 'gem' || root.blobStyle === 'grok' ? root.blobStyle : DEFAULT_BLOB_STYLE,
    instanceModels: models && typeof models === 'object' ? (models as Record<string, string[]>) : {},
  };
};

const writeEmberSettings = (settings: EmberSettings): void => writeJson(emberSettingsPath(), settings);

const hostUrl = (host: StoredHost): string => {
  const url = typeof host.url === 'string' ? host.url : '';
  return typeof host.apiUrl === 'string' && host.apiUrl ? host.apiUrl : url;
};

const hostToken = (host: StoredHost, root: Record<string, unknown>): string => {
  if (typeof host.clientToken === 'string' && host.clientToken.trim()) return host.clientToken.trim();
  if (typeof host.token === 'string' && host.token.trim()) return host.token.trim();
  if (isLocalUrl(hostUrl(host)) && typeof root.desktopLocalClientToken === 'string') {
    return root.desktopLocalClientToken;
  }
  return '';
};

const probeHealth = async (url: string, token: string): Promise<boolean> => {
  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${url}/api/health`, {
      headers,
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
  const candidates: Array<{ instance: Instance; token: string }> = [];

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
        : isLocalUrl(url)
          ? 'local'
          : 'remote';
    const usable = !isRelay && Boolean(url);

    candidates.push({
      instance: {
        id,
        label: host.label || (isRelay ? rawUrl : url) || id,
        kind,
        url: usable ? url : undefined,
        status: usable ? 'unreachable' : 'unsupported',
        attachable: false,
      },
      token: hostToken(host, root),
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
      token: '',
    });
  });

  await Promise.all(
    candidates.map(async (candidate) => {
      const url = candidate.instance.url;
      if (!url || candidate.instance.status === 'unsupported') return;
      const reachable = await probeHealth(url.replace(/\/+$/, ''), candidate.token);
      candidate.instance.status = reachable ? 'ready' : 'unreachable';
      candidate.instance.attachable = reachable;
    })
  );

  return candidates.map((candidate) => candidate.instance);
};

const instanceTarget = (instanceId: string): { url: string; headers: Record<string, string> } | null => {
  const root = readJson(openchamberSettingsPath());
  const hosts = Array.isArray(root.desktopHosts) ? (root.desktopHosts as StoredHost[]) : [];
  const index = hosts.findIndex((host, i) => hostId(host, i) === instanceId);
  if (index === -1) return null;

  const host = hosts[index];
  const rawUrl = hostUrl(host);
  const rawDirectUrl = typeof host.url === 'string' ? host.url : '';
  if (!rawUrl || rawDirectUrl.startsWith('relay://')) return null;

  const headers: Record<string, string> = { ...(host.requestHeaders || {}) };
  const token = hostToken(host, root);
  if (token) headers.Authorization = `Bearer ${token}`;

  return { url: rawUrl.replace(/\/+$/, ''), headers };
};

const createWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    title: 'Ember',
    backgroundColor: '#16130f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  return win;
};

ipcMain.handle('ember:instances', () => loadInstances());

ipcMain.handle('ember:settings:get', () => {
  const { theme, blobStyle } = readEmberSettings();
  return { theme, blobStyle };
});

ipcMain.handle(
  'ember:settings:set',
  (_event, patch: { theme?: string; blobStyle?: BlobStyle }) => {
    const settings = readEmberSettings();
    if (typeof patch?.theme === 'string' && patch.theme) settings.theme = patch.theme;
    if (patch?.blobStyle === 'gem' || patch?.blobStyle === 'grok') settings.blobStyle = patch.blobStyle;
    writeEmberSettings(settings);
    return { theme: settings.theme, blobStyle: settings.blobStyle };
  }
);

ipcMain.handle('ember:models:get', (_event, args: { instanceId: string }) => {
  const instanceId = String(args?.instanceId || '');
  if (!instanceId) return [];
  const stored = readEmberSettings().instanceModels[instanceId];
  return Array.isArray(stored) ? stored.slice(0, 8) : [];
});

ipcMain.handle('ember:models:set', (_event, args: { instanceId: string; order: string[] }) => {
  const instanceId = String(args?.instanceId || '');
  const order = Array.isArray(args?.order) ? args.order.map(String).slice(0, 8) : [];
  if (!instanceId) return null;

  const settings = readEmberSettings();
  settings.instanceModels[instanceId] = order;
  writeEmberSettings(settings);
  return null;
});

ipcMain.handle(
  'ember:api',
  async (
    _event,
    args: { instanceId: string; method: string; path: string; body?: unknown }
  ): Promise<{ ok: boolean; status: number; data: unknown }> => {
    const target = instanceTarget(String(args?.instanceId || ''));
    if (!target) {
      return { ok: false, status: 0, data: { error: 'Instance is not attachable' } };
    }

    try {
      const response = await fetch(`${target.url}${args.path}`, {
        method: args.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...target.headers,
        },
        body: args.body === undefined ? undefined : JSON.stringify(args.body),
      });
      const text = await response.text();
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }
);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
