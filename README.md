# Ember

**A calm control room for your OpenChamber agents.**

Ember is a desktop GUI for OpenChamber. It brings sessions from your connected instances into one window, grouped by project, so you can follow several agents without constantly switching clients.

It is not an agent harness: OpenChamber owns execution, queues, permissions, and session history. Ember makes that work easier to see and interact with.

## What it does

- **One workspace, multiple instances.** Browse recent sessions across local, remote, and reachable SSH-backed instances. Healthy instances load without waiting for slow ones.
- **Project-focused columns and tabs.** Open a project together, or open an individual session. Up to eight sessions can be open, with columns adapting to the available width and overflow becoming tabs.
- **Visible agent state.** Buddy and Glyph avatars distinguish working, thinking, waiting for input, failed, and unread sessions. Customize appearances by project, task, or session.
- **Reliable composing.** Per-session drafts, attachments, reply context, server-owned follow-up queues, and project notes. Explicit model choices survive sending and clearing text; unavailable choices are shown rather than silently replaced.
- **Long conversations without the clutter.** Virtualized transcripts, inline search, pinned messages, expandable tool output, and configurable reasoning display. A context meter can compact a session, and the handoff action can fork it into a new session.
- **Useful cleanup and discovery.** Session/note search, archived-session restoration, project cleanup menus with Undo, and actions for existing scheduled tasks.
- **Personal model experience.** The existing model picker shows observed usage statistics and your Helpful / Not helpful ratings—not an automatic leaderboard or model router.
- **Optional browser access over Tailscale.** Use the same app remotely while Ember runs on your desktop.

Some operations depend on the APIs available on the connected OpenChamber version. Private Relay instances are not currently supported.

## Run from source

### Requirements

- **Node.js 22.12 or newer.**
- **Bun**, using the version declared in [package.json](package.json) (`bun@1.4.2`).
- A **running OpenChamber installation** with connected instances configured for desktop use.
- A graphical desktop environment for Electron.

Desktop behavior and native integration tests have been validated on macOS. Windows and Linux are not yet verified. The current scripts build and launch from source; they do not produce an installer or notarized distribution.

From a checkout of this repository:

```sh
bun install
bun run dev
```

`dev` builds the renderer and Electron code, then launches the app. It is not a desktop hot-reload/watch command.

### Connecting to OpenChamber

Ember reads instance configuration from:

```text
~/.config/openchamber/settings.json
```

Configure and connect instances in OpenChamber first. Ember discovers their persisted HTTP endpoints and probes them; it does not create SSH tunnels or manage provider credentials independently.

For a non-default OpenChamber data directory:

```sh
OPENCHAMBER_DATA_DIR="/path/to/openchamber" bun run dev
```

This changes the location of OpenChamber's `settings.json`, not Ember's own settings directory.

### Try the UI without OpenChamber

```sh
bun run dev:web
```

Open `http://localhost:5179`. This runs Vite with a **mock bridge and synthetic sessions**. It does not connect to your real instances. Use this mode for UI development and browser testing, not as a substitute for authenticated remote access.

## Using the workspace

- Click a **project title** to open its sessions together; click a **session avatar** to open just that session. Each avatar carries the session title underneath, truncated with an em-dash.
- **Double-click a session's header title** to rename it on its OpenChamber instance.
- Click **New agent** or a project's **+** to prepare a draft. Choose the instance, folder, and model; the first send creates the session.
- **Minimize** keeps a session as a tab. **×** archives it in OpenChamber and offers Undo; archiving a session that is working, has queued messages, or is waiting for input asks for one confirmation first (it never sends a stop command). Every sidebar blob whose session is on screen gets a small underline — one per open column.
- Use the project's **ellipsis menu** to archive inactive or older sessions. Cleanup excludes sessions known to be working or waiting for input.
- Messages sent while a session is busy go into its **OpenChamber queue**. Notes are different: they stay parked until you explicitly send them or bring them back into the composer.
- Model selection is per session. If a chosen model or reasoning level is absent from the loaded catalogue, Ember keeps the choice and draft, explains the problem, and blocks composer submission. Refresh the catalogue or explicitly choose a replacement. **Server default** is an intentional selection, not a silent fallback.
- Permission requests and agent questions appear in the conversation. **YOLO** enables permission auto-approval; on supported OpenChamber instances, that policy remains active even while Ember is closed.

### Keyboard controls

Use `Cmd` on macOS and `Ctrl` elsewhere. Shortcuts also appear in tooltips on the relevant actions.

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+K` | Search sessions and notes, or start a new agent |
| `Cmd/Ctrl+1–8` | Activate the corresponding open session, restoring it if minimized |
| `Cmd/Ctrl+F` within a column | Find in the conversation, including offscreen history |
| `Enter` | Send, or queue a follow-up while the session is busy |
| `Shift+Enter` | Insert a new line |
| `Option/Alt+Enter` | Send now instead of queueing while the session is busy |
| `Cmd/Ctrl+Enter` | Save composer text as a note in an existing session |
| `Up` in an empty composer | Recall the last message you sent |

## Remote access

Remote access is disabled by default.

1. Make sure Tailscale is connected on the desktop host and the device you want to use.
2. Open Ember's settings, switch to **General**, and set a remote-access password.
3. Enable **Allow access over Tailscale**.
4. Open the address printed in the desktop terminal: `http://<tailscale-ip>:57821`.
5. Sign in with the password you set. Keep Ember running on the host.

The production server binds to the detected Tailscale IPv4 address, not all network interfaces. It serves HTTP within the Tailnet, stores the password as a hash, and uses an HttpOnly, SameSite=Strict session cookie. Do not expose this listener through public port forwarding.

Remote clients use the desktop host's settings and model-experience store. Logout closes existing event streams; expired sessions cannot continue receiving event hints. Disabling or restarting remote access disconnects existing HTTP clients.

## Local data and model experience

| Location | Purpose |
| --- | --- |
| `~/.config/openchamber/settings.json` | OpenChamber instance discovery; read by Ember |
| `~/.config/ember/settings.json` | Appearance, workspace layout, drafts/model choices, notes, pins, and remote-access settings |
| `~/.config/ember/model-stats.json` | Observed model-call metadata and personal ratings |

Draft text and model choices persist across launches. Attachments and reply context remain in memory. Treat the settings file as private: it can contain draft text and notes.

Model scorecards use metadata from messages Ember already receives. They do not crawl entire histories or run extra model evaluations. The store retains up to **10,000 observations from the last 90 days**, without transcript text or tool payloads. You can clear observations and ratings in **Settings → General → Model experience**.

Interpret these statistics as personal observations, not a benchmark: coverage is limited to sessions seen by Ember, missing costs remain unknown, and reported call durations can include tool or waiting time. Ratings describe your assessment of a reply, not an inferred quality score.

## Development and verification

The stack is Electron, React, TypeScript, Vite, Tailwind CSS, and Radix UI, with TanStack Virtual for long transcripts.

| Command | Purpose |
| --- | --- |
| `bun run dev` | Build and launch Electron |
| `bun run dev:web` | Run the renderer with mock data under Vite |
| `bun run build` | Build the renderer into `dist/` and Electron code into `dist-electron/` |
| `bun run typecheck` | Check renderer and Electron TypeScript projects |
| `bun run lint` | Run ESLint |
| `bun run test` | Run Bun unit/regression tests |
| `bun run check` | Run typecheck, lint, and unit tests |
| `bun run test:e2e` | Run Playwright browser regressions against the mock UI |
| `bun run test:native` | Build, then test real Electron IPC and authenticated remote access with isolated fixtures |
| `bun run buddy-arena` | Run the Buddy avatar development playground |
| `bun run arena` | Run the Glyph avatar development playground |

Install the test browser before running the Playwright suites:

```sh
bunx --no-install playwright install chromium
```

Before submitting changes:

```sh
bun run check
bun run build
```

Also run `bun run test:e2e` for UI changes and `bun run test:native` for Electron, persistence, or remote-access changes. The native suite requires a GUI-capable environment and isolates its home directory, browser profile, settings, and upstream instance. It does not operate on real sessions or validate real Tailnet routing.

### Project layout

```text
electron/        Native process, preload bridge, SSE transport, remote server, persistence
src/App.tsx      Workspace state and cross-instance coordination
src/components/ UI, composers, transcripts, model picker, and settings
src/hooks/      Polling, settings persistence, feedback, and queue handlers
src/lib/        Reconciliation, caching, model selection, search/workspace helpers
src/blob/       Avatars, moods, palettes, animation, and dock rendering
src/dev/        Browser-only mock bridge and test fixtures
e2e/            Browser and native integration tests
*.test.ts       Bun unit and regression tests
```

SSE events are invalidation hints; REST responses remain authoritative. Requests are coalesced, streaming updates use bounded message tails, and periodic full reads repair history. Transcript caching has a byte budget, but visible conversations and pending sends are protected, so it is not a hard limit on total process memory.

See [AGENTS.md](AGENTS.md) for detailed architecture, invariants, and repository conventions.

## Troubleshooting

- **No instances appear:** confirm OpenChamber has saved its instance configuration and that Ember is looking in the correct data directory. Then use **Instances → Reprobe instances**.
- **An SSH instance is unsupported or unreachable:** connect it in OpenChamber first. Ember needs a persisted, reachable HTTP endpoint; it does not establish the tunnel itself.
- **A model is unavailable:** use **Refresh models** in the warning, or open the model picker and choose an available model. Your existing choice is not silently replaced.
- **The browser shows demo sessions:** `dev:web` intentionally uses mock data. Real browser access comes from the desktop app's remote server.
- **Remote access does not start:** ensure a Tailscale IPv4 address is available and a password is configured. Check the terminal running Ember for the listening address or an error.

## License

[MIT License with Revenue-Based Commercial Use Rider](LICENSE), copyright Noemi Titarenco.

This is **not the unmodified MIT license**. The rider requires a separate written agreement for use by, or on behalf of, companies whose aggregate worldwide gross revenue exceeds US $10 million, including affiliates. See [LICENSE](LICENSE) for the full terms and definitions.
