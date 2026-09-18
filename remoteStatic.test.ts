import { expect, test } from 'bun:test';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveStatic } from './electron/remoteServer';

test('static responses negotiate compression, preserve content, and handle HEAD', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ember-static-'));
  const content = 'export const example = "test";\n'.repeat(1000);
  await writeFile(join(directory, 'app-abcdefgh.js'), content);
  await writeFile(join(directory, 'index.html'), '<html>Ember</html>');
  const server = createServer((request, response) => {
    void serveStatic(request, response, request.url ?? '/', directory);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    for (const encoding of ['gzip', 'br']) {
      const response = await fetch(`${url}/app-abcdefgh.js`, { headers: { 'Accept-Encoding': encoding } });
      expect(response.headers.get('content-encoding')).toBe(encoding);
      expect(response.headers.get('vary')).toBe('Accept-Encoding');
      expect(Number(response.headers.get('content-length'))).toBeLessThan(content.length);
      expect(await response.text()).toBe(content);
    }
    const head = await fetch(`${url}/app-abcdefgh.js`, { method: 'HEAD', headers: { 'Accept-Encoding': 'gzip' } });
    expect(await head.text()).toBe('');
    const index = await fetch(url);
    expect(index.headers.get('cache-control')).toBe('no-store');
    const plain = await fetch(`${url}/app-abcdefgh.js`, { headers: { 'Accept-Encoding': 'gzip;q=0, br;q=0' } });
    expect(plain.headers.has('content-encoding')).toBe(false);
    expect(await plain.text()).toBe(content);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true });
  }
});
