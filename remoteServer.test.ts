import { expect, spyOn, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRemoteServer } from './electron/remoteServer';
import { hashRemotePassword, verifyRemotePassword } from './electron/remoteAuth';

const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ember-remote-auth-'));
  const password = randomBytes(24).toString('hex');
  const hash = hashRemotePassword(password);
  const writes: string[] = [];
  const listeners = new Set<(event: unknown) => void>();
  const server = createRemoteServer(directory, {
    modelStats: {
      list: async () => [],
      observe: async () => { writes.push('observe'); return []; },
      rate: async () => { writes.push('rate'); },
      clear: async () => { writes.push('clear'); },
    },
    listInstances: async () => [],
    getSettings: () => ({ theme: 'stone' }),
    setSettings: async (patch) => { writes.push('settings'); return patch; },
    request: async () => { writes.push('api'); return { ok: true, status: 200, data: {} }; },
    verifyPassword: (value) => verifyRemotePassword(value, hash),
    subscribeEvents: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    eventStatus: () => ({ fixture: true }),
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  const url = `http://127.0.0.1:${address.port}`;
  const request = (path: string, method = 'GET', body?: unknown, cookie?: string) => fetch(`${url}${path}`, {
    method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    request, url, password, writes, listeners,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true });
    },
  };
};

test('remote routes reject anonymous writes and await authenticated settings writes', async () => {
  const f = await fixture();
  try {
    for (const [path, method] of [['/remote/settings', 'POST'], ['/remote/api', 'POST'], ['/remote/model-stats', 'POST'], ['/remote/model-stats', 'DELETE'], ['/remote/model-rating', 'POST']]) {
      expect((await f.request(path, method, {})).status).toBe(401);
    }
    expect(f.writes).toEqual([]);
    expect((await f.request('/remote/events')).status).toBe(302);
    const login = await f.request('/remote/login', 'POST', { password: f.password });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get('set-cookie')!;
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    const cookie = setCookie.split(';')[0];
    const saved = await f.request('/remote/settings', 'POST', { theme: 'clay' }, cookie);
    expect(await saved.json()).toEqual({ theme: 'clay' });
    expect(saved.headers.get('cache-control')).toBe('no-store');
    await f.request('/remote/logout', 'POST', undefined, cookie);
    expect((await f.request('/remote/settings', 'POST', {}, cookie)).status).toBe(401);
  } finally {
    await f.close();
  }
});

test('remote login rate limiting remains enforced', async () => {
  const f = await fixture();
  try {
    for (let attempt = 0; attempt < 8; attempt += 1) expect((await f.request('/remote/login', 'POST', { password: 'wrong' })).status).toBe(401);
    const blocked = await f.request('/remote/login', 'POST', { password: f.password });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  } finally {
    await f.close();
  }
});

test('expired sessions cannot receive further event hints', async () => {
  const f = await fixture();
  const abort = new AbortController();
  try {
    const login = await f.request('/remote/login', 'POST', { password: f.password });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const stream = await fetch(`${f.url}/remote/events`, { headers: { Cookie: cookie }, signal: abort.signal });
    const reader = stream.body!.getReader();
    await reader.read();
    const expiredAt = Date.now() + 31 * 86_400_000;
    const clock = spyOn(Date, 'now').mockReturnValue(expiredAt);
    try {
      [...f.listeners].forEach((listener) => listener({ type: 'must-not-arrive' }));
    } finally {
      clock.mockRestore();
    }
    expect((await reader.read()).done).toBe(true);
    expect(f.listeners.size).toBe(0);
  } finally {
    abort.abort();
    await f.close();
  }
});

test('logout closes existing authenticated event streams', async () => {
  const f = await fixture();
  const abort = new AbortController();
  try {
    const login = await f.request('/remote/login', 'POST', { password: f.password });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const stream = await fetch(`${f.url}/remote/events`, { headers: { Cookie: cookie }, signal: abort.signal });
    const reader = stream.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('ember:stream-status');
    expect(f.listeners.size).toBe(1);
    expect((await f.request('/remote/logout', 'POST', undefined, cookie)).status).toBe(200);
    const closed = await Promise.race([reader.read().then(({ done }) => done), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500))]);
    expect(closed).toBe(true);
    expect(f.listeners.size).toBe(0);
  } finally {
    abort.abort();
    await f.close();
  }
});
