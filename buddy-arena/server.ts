/**
 * Buddy review arenas for the Grok ("Buddy") blob.
 *
 *   bun run buddy-arena/server.ts   →  http://localhost:3004
 *
 *   /        shape review (shipped GROK_SHAPES + generated candidates)
 *   /states  alternative input / question / error / thinking visuals
 *
 * Nothing here is imported by the app.
 */
import { GROK_SHAPES } from '../src/blob/grok';
import { PAGE } from './page';
import { STATE_DESIGNS, STATES_PAGE } from './states';

const PORT = Number(process.env.BUDDY_PORT || 3004);

const server = Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/states') {
      return new Response(STATES_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  },
});

console.log(`Buddy review → http://localhost:${server.port}`);
console.log(`  shapes: ${GROK_SHAPES.length} shipped`);
console.log(`  states: ${STATE_DESIGNS.length} designs across thinking/input/question/error`);
