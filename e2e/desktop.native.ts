import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { createRemoteServer } from '../electron/remoteServer';
import { hashRemotePassword, verifyRemotePassword } from '../electron/remoteAuth';
import type { ModelObservation } from '../electron/modelStats';
import type {} from '../src/types';

const loadPackage = createRequire(resolve('package.json'));
const listen = async (server: Server): Promise<string> => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No fixture port');
  return `http://127.0.0.1:${address.port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
};

test('built Electron and authenticated remote access preserve local work', async ({ browser }) => {
  const home = await mkdtemp(join(tmpdir(), 'ember-native-'));
  const chamber = join(home, 'openchamber');
  const ember = join(home, '.config', 'ember');
  const mutations: string[] = [];
  const now = Date.now();
  const upstream = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (request.method !== 'GET') mutations.push(`${request.method} ${path}`);
    let value: unknown = {};
    if (path === '/api/health') value = { healthy: true };
    else if (path === '/api/experimental/session') value = ['a', 'b'].map((id) => ({
      id, title: `Native session ${id}`, directory: '/fixture/project',
      model: { providerID: 'fixture', modelID: 'model' }, time: { updated: now },
    }));
    else if (/^\/api\/session\/(a|b)\/message$/.test(path)) {
      const id = path.split('/')[3];
      value = [{ info: { id: `answer-${id}`, role: 'assistant', providerID: 'fixture', modelID: 'model',
        time: { created: now - 3000, completed: now - 1000 }, tokens: { input: 100, output: 20 }, cost: 0.01 },
      parts: [{ id: `text-${id}`, type: 'text', text: `Native fixture response ${id}` }] }];
    } else if (path === '/api/config/settings') value = { projects: [{ id: 'project', path: '/fixture/project', label: 'Fixture project' }] };
    else if (path === '/api/provider') value = {
      all: [{ id: 'fixture', name: 'Fixture provider', models: { model: { id: 'model', name: 'Fixture model' } } }],
      default: { fixture: 'model' },
    };
    else if (path === '/api/permission' || path === '/api/question') value = [];
    else if (path === '/api/message-queue') value = { revision: 1, sessions: [] };
    else if (path === '/api/permission-auto-accept') value = { sessions: {} };
    else if (path.endsWith('/scheduled-tasks')) value = { tasks: [] };
    else if (path.endsWith('/event') || path.endsWith('/stream')) response.statusCode = 404;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(value));
  });
  let app: ElectronApplication | undefined;
  let remote: Server | undefined;
  const context = await browser.newContext();
  try {
    const upstreamUrl = await listen(upstream);
    await mkdir(chamber, { recursive: true });
    await mkdir(ember, { recursive: true });
    await mkdir(join(home, 'profile'), { recursive: true });
    await writeFile(join(chamber, 'settings.json'), JSON.stringify({ desktopHosts: [{ id: 'fixture', label: 'Isolated fixture', url: upstreamUrl }] }));
    await writeFile(join(ember, 'settings.json'), JSON.stringify({
      openSessions: ['fixture::a', 'fixture::b'], activeSession: 'fixture::a', remoteAccessEnabled: false,
    }));
    const bootstrap = join(home, 'bootstrap.cjs');
    await writeFile(bootstrap, `const { app } = require('electron');
if (require('node:os').homedir() !== process.env.EMBER_TEST_HOME) throw new Error('Test home is not isolated');
app.setPath('userData', process.env.EMBER_TEST_PROFILE);
app.setPath('sessionData', process.env.EMBER_TEST_PROFILE);
require(process.env.EMBER_TEST_ENTRY);
`);
    const env: Record<string, string> = {
      ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
      HOME: home, OPENCHAMBER_DATA_DIR: chamber, EMBER_TEST_HOME: home,
      EMBER_TEST_PROFILE: join(home, 'profile'), EMBER_TEST_ENTRY: resolve('dist-electron/main.js'),
    };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ executablePath: loadPackage('electron') as string, args: [bootstrap], env });
    const nativeWindow = await app.firstWindow();
    const errors: string[] = [];
    nativeWindow.on('pageerror', (error) => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1400, 900));
    await expect(nativeWindow.locator('textarea')).toHaveCount(2);
    await expect(nativeWindow.getByText('Native fixture response a', { exact: true })).toBeVisible();
    await expect(nativeWindow.getByText('Native fixture response b', { exact: true })).toBeVisible();
    expect(await nativeWindow.evaluate(() => Boolean(window.ember.capabilities))).toBe(true);

    await test.step('native IPC saves separate drafts and ratings to the isolated home', async () => {
      await nativeWindow.locator('textarea').nth(0).fill('Native draft A');
      await nativeWindow.locator('textarea').nth(1).fill('Native draft B');
      await expect.poll(async () => {
        const stored = JSON.parse(await readFile(join(ember, 'settings.json'), 'utf8'));
        return Object.values(stored.composerDrafts ?? {}).map((draft) => (draft as { text: string }).text).sort();
      }).toEqual(['Native draft A', 'Native draft B']);
      const helpful = nativeWindow.getByRole('log').nth(1).getByRole('button', { name: 'Mark response helpful', exact: true });
      await expect(helpful).toBeAttached();
      await helpful.focus();
      await helpful.click();
      await expect(helpful).toHaveAttribute('aria-pressed', 'true');
      await nativeWindow.reload();
      await expect(nativeWindow.locator('textarea').nth(0)).toHaveValue('Native draft A');
      await expect(nativeWindow.locator('textarea').nth(1)).toHaveValue('Native draft B');
      await expect(nativeWindow.getByRole('log').nth(1).getByRole('button', { name: 'Mark response helpful', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const stored = JSON.parse(await readFile(join(ember, 'model-stats.json'), 'utf8'));
      expect(stored.observations).toHaveLength(2);
      expect(JSON.stringify(stored)).not.toContain('Native fixture response');
    });

    const password = randomBytes(24).toString('hex');
    const passwordHash = hashRemotePassword(password);
    let settings = await nativeWindow.evaluate(() => window.ember.getSettings());
    const subscribers = new Set<(event: unknown) => void>();
    remote = createRemoteServer(resolve('dist'), {
      modelStats: {
        list: () => nativeWindow.evaluate(() => window.ember.getModelStats!()),
        observe: (values: unknown) => nativeWindow.evaluate((values) => window.ember.observeModels!(values as ModelObservation[]), values),
        rate: (id: unknown, rating: unknown) => nativeWindow.evaluate(({ id, rating }) => window.ember.rateModel!(id as string, rating as 'helpful' | 'unhelpful' | null), { id, rating }),
        clear: () => nativeWindow.evaluate(() => window.ember.clearModelStats!()),
      },
      listInstances: (refresh) => nativeWindow.evaluate((refresh) => window.ember.listInstances(refresh), refresh),
      getSettings: () => settings,
      setSettings: async (patch) => {
        settings = await nativeWindow.evaluate((patch) => window.ember.setSettings(patch as Parameters<typeof window.ember.setSettings>[0]), patch);
        return settings;
      },
      request: (instanceId, method, path, body) => nativeWindow.evaluate(({ instanceId, method, path, body }) => window.ember.request(instanceId, method, path as string, body), { instanceId, method, path, body }),
      verifyPassword: (candidate) => verifyRemotePassword(candidate, passwordHash),
      subscribeEvents: (listener) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; },
      eventStatus: () => ({ fixture: false }),
    });
    const remoteUrl = await listen(remote);
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await test.step('remote auth protects production assets and APIs', async () => {
      expect((await context.request.post(`${remoteUrl}/remote/settings`, { data: { theme: 'graphite' } })).status()).toBe(401);
      expect((await context.request.get(`${remoteUrl}/remote/model-stats`, { maxRedirects: 0 })).status()).toBe(302);
      await page.goto(remoteUrl);
      await expect(page.getByRole('heading', { name: 'Ember' })).toBeVisible();
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.locator('textarea')).toHaveCount(2);
      const cookie = (await context.cookies()).find((cookie) => cookie.name === 'ember_remote_session');
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe('Strict');
      expect(await page.evaluate(() => window.ember.capabilities?.dockIcon)).toBe(false);
    });

    await test.step('the real remote bridge shares persisted data with Electron', async () => {
      await expect(page.locator('textarea').nth(1)).toHaveValue('Native draft B');
      await page.locator('textarea').nth(0).fill('Remote draft A');
      await expect.poll(() => nativeWindow.evaluate(async () => (await window.ember.getSettings()).composerDrafts['fixture::a']?.text)).toBe('Remote draft A');
      expect(await nativeWindow.evaluate(async () => (await window.ember.getSettings()).composerDrafts['fixture::b']?.text)).toBe('Native draft B');
      await expect(page.getByRole('log').nth(1).getByRole('button', { name: 'Mark response helpful', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const stream = await page.evaluate(async () => {
        const abort = new AbortController();
        const response = await fetch('/remote/events', { signal: abort.signal });
        const first = await response.body!.getReader().read();
        abort.abort();
        return { type: response.headers.get('content-type'), encoding: response.headers.get('content-encoding'), text: new TextDecoder().decode(first.value) };
      });
      expect(stream.type).toContain('text/event-stream');
      expect(stream.encoding).toBeNull();
      expect(stream.text).toContain('ember:stream-status');
      await context.request.post(`${remoteUrl}/remote/logout`);
      expect((await context.request.post(`${remoteUrl}/remote/model-rating`, { data: { id: 'unknown', rating: 'helpful' } })).status()).toBe(401);
      expect((await context.request.get(`${remoteUrl}/remote/settings`, { maxRedirects: 0 })).status()).toBe(302);
    });
    expect(mutations).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    if (remote) await close(remote);
    if (app) await app.close();
    await close(upstream);
    await rm(home, { recursive: true });
  }
});
