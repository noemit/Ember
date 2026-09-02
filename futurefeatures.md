# Future features

Parked ideas. Focus stays on core functionality: instances, rail, chat, models, themes.

## Command buttons under the composer

**Status:** not started

In **Settings**, add a "Composer buttons" section:

- Lists the commands available on the current instance. OpenChamber keeps commands per project
  directory; per-command CRUD lives at `/api/config/commands/:name`.
- **None enabled by default.** The user picks which commands appear.
- Enabled commands render as small buttons **under the chat input**, in the user's chosen order.
- Reorderable (drag, or up/down arrows if dragging gets fiddly).
- Saved per instance, next to the theme, in `~/.config/ember/settings.json`.

Open questions for when we build it:

- Click = insert the command text into the input, or send it right away? (Probably insert, so it can
  be edited before sending.)
- Which set when the active project has no commands — user-level commands, or hide the section?
- Exact endpoint for *listing* commands per directory (confirm against a live instance;
  `useCommandsStore` in OpenChamber is the reference implementation).
- Button label: command name, or its description / prompt template?

## Other parked items

- ~~**Send attachments with the prompt.**~~ Dropped: attachments don't work over SSH (the primary
  setup), and showing the file name is enough. The prompt body accepts file parts if this ever
  changes.
- **Private Relay instances.** Their tunnel exists only in OpenChamber's memory, so Ember can't
  attach to them even while connected. Revisit if a local URL ever gets persisted.
- **Live updates over SSE.** Ball states and the open session's messages poll every 3s, the
  session list every 10s, across every connected instance. `/api/event` is an SSE endpoint that
  would make this instant and cut the polling fan-out.
- ~~**Window restore.**~~ Moot: one window now shows every instance at once.
- **Remember hidden instances.** The instance pills in the top bar filter the rail, but the filter
  resets on relaunch. Could live next to `theme` / `blobStyle` in `~/.config/ember/settings.json`.
