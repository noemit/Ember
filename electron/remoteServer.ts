import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { ApiMethod } from './transport';

const REMOTE_PORT = 57821;
const MAX_BODY_BYTES = 32 * 1024 * 1024;
const TAILSCALE_MIN = 0x64400000;
const TAILSCALE_MAX = 0x647fffff;
const SESSION_COOKIE = 'ember_remote_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

type ApiResponse = { ok: boolean; status: number; data: unknown };
type Handlers = {
  listInstances: () => Promise<unknown>;
  getSettings: () => unknown;
  setSettings: (patch: unknown) => unknown;
  request: (instanceId: string, method: ApiMethod, apiPath: unknown, body?: unknown) => Promise<ApiResponse>;
  verifyPassword: (password: string) => boolean;
};
type Session = { expiresAt: number };
type Attempt = { count: number; resetAt: number };

const tailscaleAddress = (): string | null => {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const entry of interfaces ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      const octets = entry.address.split('.').map(Number);
      const value = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
      if (value >= TAILSCALE_MIN && value <= TAILSCALE_MAX) return entry.address;
    }
  }
  return null;
};

const json = (response: http.ServerResponse, status: number, value: unknown): void => {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
};

const readBody = (request: http.IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    request.on('data', (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });

const cookies = (request: http.IncomingMessage): Record<string, string> =>
  Object.fromEntries(
    (request.headers.cookie ?? '')
      .split(';')
      .map((entry) => entry.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );

const loginPage = (): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ember login</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#151413;color:#efece7;font:14px system-ui,sans-serif}main{width:min(360px,calc(100% - 40px));padding:24px;border:1px solid #2c2a26;border-radius:12px;background:#1b1a18}h1{font-size:18px;margin:0 0 8px}p{color:#9b958c;font-size:12px}label{display:grid;gap:6px;margin:20px 0 12px}input{box-sizing:border-box;width:100%;padding:9px 10px;border:1px solid #2c2a26;border-radius:6px;background:#242220;color:inherit}button{width:100%;padding:9px;border:0;border-radius:6px;background:#efece7;color:#151413;font-weight:600}#error{color:#f07a6a;min-height:18px}</style></head>
<body><main><h1>Ember</h1><p>Enter the remote access password.</p><form><label>Password<input name="password" type="password" autocomplete="current-password" autofocus></label><div id="error"></div><button>Sign in</button></form></main>
<script>const form=document.querySelector('form'),error=document.querySelector('#error');form.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';const body=JSON.stringify({password:form.password.value});const r=await fetch('/remote/login',{method:'POST',headers:{'Content-Type':'application/json'},body});if(r.ok)location.href='/';else error.textContent='Incorrect password or too many attempts.'});</script></body></html>`;

const contentType = (file: string): string => {
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.json')) return 'application/json';
  return 'text/html; charset=utf-8';
};

const serveStatic = (response: http.ServerResponse, pathname: string, root: string): void => {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return json(response, 404, { error: 'Not found' });
  try {
    const body = fs.readFileSync(file);
    response.writeHead(200, {
      'Content-Type': contentType(file),
      'Cache-Control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
    });
    response.end(body);
  } catch {
    json(response, 404, { error: 'Not found' });
  }
};

const clientAddress = (request: http.IncomingMessage): string => request.socket.remoteAddress ?? 'unknown';

export const startRemoteServer = (root: string, handlers: Handlers): http.Server | null => {
  const address = tailscaleAddress();
  if (!address) {
    console.warn('Remote Ember access disabled: no Tailscale IPv4 address found');
    return null;
  }

  const sessions = new Map<string, Session>();
  const attempts = new Map<string, Attempt>();
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${address}`);
      if (url.pathname === '/remote/login' && request.method === 'POST') {
        const source = clientAddress(request);
        const now = Date.now();
        const attempt = attempts.get(source);
        if (attempt && attempt.resetAt > now && attempt.count >= MAX_LOGIN_ATTEMPTS) {
          response.setHeader('Retry-After', String(Math.ceil((attempt.resetAt - now) / 1000)));
          return json(response, 429, { error: 'Too many login attempts' });
        }
        const input = await readBody(request);
        const password = input && typeof input === 'object' ? String((input as Record<string, unknown>).password ?? '') : '';
        if (!handlers.verifyPassword(password)) {
          const next = attempt && attempt.resetAt > now ? attempt : { count: 0, resetAt: now + LOGIN_WINDOW_MS };
          next.count += 1;
          attempts.set(source, next);
          return json(response, 401, { error: 'Invalid password' });
        }
        attempts.delete(source);
        const token = randomBytes(32).toString('base64url');
        sessions.set(token, { expiresAt: now + SESSION_TTL_MS });
        response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`);
        return json(response, 200, { ok: true });
      }

      const token = cookies(request)[SESSION_COOKIE];
      const session = token ? sessions.get(token) : undefined;
      const authenticated = Boolean(session && session.expiresAt > Date.now());
      if (session && !authenticated) sessions.delete(token!);
      if (!authenticated) {
        if (url.pathname === '/remote/login' && request.method === 'GET') {
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          response.end(loginPage());
        } else if (request.method === 'GET' || request.method === 'HEAD') {
          response.writeHead(302, { Location: '/remote/login' });
          response.end();
        } else {
          json(response, 401, { error: 'Authentication required' });
        }
        return;
      }

      if (url.pathname === '/remote/logout' && request.method === 'POST') {
        if (token) sessions.delete(token);
        response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
        return json(response, 200, { ok: true });
      }
      if (url.pathname === '/remote/instances' && request.method === 'GET') return json(response, 200, await handlers.listInstances());
      if (url.pathname === '/remote/settings' && request.method === 'GET') return json(response, 200, handlers.getSettings());
      if (url.pathname === '/remote/settings' && request.method === 'POST') return json(response, 200, handlers.setSettings(await readBody(request)));
      if (url.pathname === '/remote/api' && request.method === 'POST') {
        const input = await readBody(request);
        if (!input || typeof input !== 'object') return json(response, 400, { error: 'Invalid request' });
        const value = input as Record<string, unknown>;
        const method = typeof value.method === 'string' ? value.method.toUpperCase() : '';
        if (!['GET', 'POST', 'PATCH'].includes(method)) return json(response, 400, { error: 'Invalid API method' });
        return json(response, 200, await handlers.request(String(value.instanceId ?? ''), method as ApiMethod, value.path, value.body));
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Method not allowed' });
      return serveStatic(response, url.pathname, root);
    } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : 'Bad request' });
    }
  });

  server.on('error', (error) => console.error('Remote Ember server error', error));
  server.listen(REMOTE_PORT, address, () => console.log(`Remote Ember access: http://${address}:${REMOTE_PORT}`));
  return server;
};
