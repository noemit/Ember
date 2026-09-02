# Ember

Tiny Electron client for OpenChamber. One window shows the most recent sessions across every
connected instance listed in `~/.config/openchamber/settings.json`.

## Commands

- `bun run dev` — build renderer + electron, then launch Electron.
- `bun run dev:web` — renderer only under Vite with a mock bridge (`src/dev/mockBridge.ts`) so the UI
  can be exercised in a plain browser. The mock loads automatically when `window.ember` is absent.
- `bun run typecheck` — both tsconfigs (renderer + electron).
- `bun run build` — production renderer to `dist/`, electron main/preload to `dist-electron/`.

## Layout

- `electron/` — main process (reads OpenChamber hosts, probes health, proxies API calls, stores
  Ember settings in `~/.config/ember/settings.json`) and the preload bridge.
- `src/App.tsx` — owns all state: instances, per-instance sessions/states/models, selection.
  Sessions are keyed by `sessionKey()` (`instanceId::sessionId`) because ids repeat across instances.
- `src/components/ui/` — shadcn/ui primitives (Tailwind v4, `radix-ui`). Add more with
  `bunx --bun shadcn@latest add <name>`.
- `src/blob/` — session avatars. `Blob.tsx` switches between `GrokBlob` (flat) and `GemBlob`
  (faceted); both seed from the session's first prompt.
- `src/themes.ts` — palettes mapped onto shadcn CSS variables; `applyTheme` toggles `.dark`.

## Notes

- Vite config is `vite.config.mts` (ESM) because `package.json` has no `"type": "module"` — the
  electron build needs CommonJS.
- Animations: `motion` for layout/reorder, `tw-animate-css` for Radix enter/exit.
