/**
 * Buddy review arenas for the Grok ("Buddy") blob.
 *
 *   bun run buddy-arena/server.ts   →  http://localhost:3004
 *
 *   /        shape review (shipped GROK_SHAPES + generated candidates)
 *   /states  alternative input / question / error / thinking visuals
 *   /hop     busy-hop eye-stretch comparison
 *   /thinking  chat header thinking-toggle icon review
 *
 * Nothing here is imported by the app.
 */
import { GROK_SHAPES } from '../src/blob/grok';
import { HOP_PAGE } from './hop';
import { PAGE } from './page';
import { STATE_DESIGNS, STATES_PAGE } from './states';
import { THINKING_PAGE } from './thinking';

const PORT = Number(process.env.BUDDY_PORT || 3004);

const server = Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/states') {
      return new Response(STATES_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (path === '/hop') {
      return new Response(HOP_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (path === '/thinking') {
      return new Response(THINKING_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  },
});

console.log(`Buddy review → http://localhost:${server.port}`);
console.log(`  shapes: ${GROK_SHAPES.length} shipped`);
console.log(`  states: ${STATE_DESIGNS.length} designs across busy/thinking/input/question/error`);
