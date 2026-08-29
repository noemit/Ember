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
  requestHeaders?: Record<string, string>;
  relay?: unknown;
};

type StoredSshInstance = {
  id?: string;
  label?: string;
  host?: string;
};

type Instance = {
  id: string;
  label: string;
  kind: 'local' | 'remote' | 'ssh' | 'relay';
  url?: string;
  attachable: boolean;
};

type EmberSettings = {
  instanceThemes: Record<string, string>;
};

const DEFAULT_THEME_ID = 'ember';

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
  const themes = root.instanceThemes;
  return {
    instanceThemes: themes && typeof themes === 'object' ? (themes as Record<string, string>) : {},
  };
};

const loadInstances = (): Instance[] => {
  const root = readJson(openchamberSettingsPath());
  const hosts = Array.isArray(root.desktopHosts) ? (root.desktopHosts as StoredHost[]) : [];
  const sshInstances = Array.isArray(root.desktopSshInstances)
    ? (root.desktopSshInstances as StoredSshInstance[])
    : [];

  const fromHosts: Instance[] = hosts.map((host, index) => {
    const url = typeof host.url === 'string' ? host.url : '';
    const apiUrl = typeof host.apiUrl === 'string' && host.apiUrl ? host.apiUrl : url;
    const isRelay = url.startsWith('relay://') || Boolean(host.relay);
    const id = hostId(host, index);
    const kind: Instance['kind'] = isRelay ? 'relay' : isLocalUrl(apiUrl) ? 'local' : 'remote';
    return {
      id,
      label: host.label || (isRelay ? url : apiUrl) || id,
      kind,
      url: apiUrl || undefined,
      attachable: !isRelay && Boolean(apiUrl),
    };
  });

  const fromSsh: Instance[] = sshInstances.map((entry, index) => {
    const id = String(entry.id || `ssh-${index}`);
    return {
      id,
      label: entry.label || entry.host || id,
      kind: 'ssh' as const,
      attachable: false,
    };
  });

  return [...fromHosts, ...fromSsh];
};

const instanceTarget = (instanceId: string): { url: string; headers: Record<string, string> } | null => {
  const root = readJson(openchamberSettingsPath());
  const hosts = Array.isArray(root.desktopHosts) ? (root.desktopHosts as StoredHost[]) : [];
  const index = hosts.findIndex((host, i) => hostId(host, i) === instanceId);
  if (index === -1) return null;

  const host = hosts[index];
  const rawUrl = typeof host.apiUrl === 'string' && host.apiUrl ? host.apiUrl : host.url;
  if (!rawUrl || rawUrl.startsWith('relay://')) return null;

  const headers: Record<string, string> = { ...(host.requestHeaders || {}) };
  const localToken = typeof root.desktopLocalClientToken === 'string' ? root.desktopLocalClientToken : '';
  const token = host.token || (isLocalUrl(rawUrl) ? localToken : '');
  if (token) headers.Authorization = `Bearer ${token}`;

  return { url: rawUrl.replace(/\/+$/, ''), headers };
};

type BoundWindow = BrowserWindow & { emberInstanceId?: string | null };

const createWindow = (instanceId: string | null): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    title: 'Ember',
    backgroundColor: '#16130f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  }) as BoundWindow;

  win.emberInstanceId = instanceId;
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.on('closed', () => windows.delete(win.id));
  windows.set(win.id, win);
  return win;
};

const windows = new Map<number, BoundWindow>();

ipcMain.handle('ember:instances', () => loadInstances());

ipcMain.handle('ember:window-instance', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) as BoundWindow | null;
  return win?.emberInstanceId ?? null;
});

ipcMain.handle('ember:open', (event, args: { instanceId: string; mode: 'replace' | 'new' }) => {
  const instanceId = String(args?.instanceId || '');
  if (!instanceId) return null;

  if (args.mode === 'new') {
    createWindow(instanceId);
    return null;
  }

  const win = BrowserWindow.fromWebContents(event.sender) as BoundWindow | null;
  if (!win) return null;
  win.emberInstanceId = instanceId;
  win.webContents.send('ember:instance-changed', instanceId);
  return null;
});

ipcMain.handle('ember:theme:get', (_event, args: { instanceId: string }) => {
  const instanceId = String(args?.instanceId || '');
  if (!instanceId) return DEFAULT_THEME_ID;
  return readEmberSettings().instanceThemes[instanceId] || DEFAULT_THEME_ID;
});

ipcMain.handle('ember:theme:set', (_event, args: { instanceId: string; themeId: string }) => {
  const instanceId = String(args?.instanceId || '');
  const themeId = String(args?.themeId || '');
  if (!instanceId || !themeId) return null;

  const settings = readEmberSettings();
  settings.instanceThemes[instanceId] = themeId;
  writeJson(emberSettingsPath(), settings);
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
  createWindow(null);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(null);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
