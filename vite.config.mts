import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The strict CSP in index.html protects the packaged app, but in `dev:web` it blocks Vite's inline
 * react-refresh preamble, which leaves the page blank. Drop the meta only while serving.
 */
const stripCspInDev = (): Plugin => ({
  name: 'strip-csp-in-dev',
  apply: 'serve',
  transformIndexHtml(html) {
    return html.replace(/\s*<meta[^>]*Content-Security-Policy[^>]*>/i, '');
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), stripCspInDev()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
