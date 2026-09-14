# vibegeist

A shared ambient world where every Claude Code session that finishes becomes a ghost.

No chat, no accounts, no user-generated content. Your Claude Code hooks send three
anonymous, hashed pings to a server: **join** (a turn starts), **activity**
(a tool ran), **ghost** (a turn ends). The browser page turns that into little
chicks that pace around and stack bricks while you work, then drift upward into
ghosts when done — alongside everyone else in the world right now.

Note that Claude Code's `Stop` hook fires at the end of every turn, not just
when you close the whole session — so a chick is really "one turn," and a
`UserPromptSubmit` hook re-joins it the instant you send your next message
(rather than waiting for its first tool call) so it doesn't sit dead in
between. This also means `ghostsToday`/`ghostsAllTime` count turns, not
sessions - expect it to climb quickly during an active conversation.

**Live, shared world:** https://vibegeist.dayloop-dilara.workers.dev

Open it in a browser tab (or click "📌 widget aç" to pop it into a small
always-on-top window) and leave it open — every hook install below reports into
this same world by default, so you and anyone else running the hook show up
together.

## Wire up your Claude Code sessions

Add the hooks from `hook/settings.snippet.json` to your `~/.claude/settings.json`
(merge with whatever hooks you already have — don't replace the file), replacing
`/ABSOLUTE/PATH/TO/vibegeist` with the real path to this folder on your machine.

Then open `/hooks` once inside Claude Code to reload the config.

Every turn you run will now show up as a chick in the shared world, and turn
into a ghost the moment it finishes.

## Run your own world instead

By default the hook and notifier report to the public instance above. To run a
private instance instead (e.g. for local development):

```
npm install
npm start
```

Then set `VIBEGEIST_SERVER=http://localhost:8787` (and `ws://localhost:8787/ws`
for the notifier) as an env var in front of the hook commands / notifier.

## Get native OS notifications instead of a tab

```
npm run notify
```

Leave this running in the background and you'll get a Windows notification
whenever a ghost rises or a new chick joins — no browser tab required.

## Privacy

The hook script only ever sends a SHA-256 hash of your Claude Code session ID and
an event name (`join` / `activity` / `ghost`). No file paths, no commands, no code,
no prompts — nothing that identifies you or your project ever leaves your machine.

## What's here

- `worker/` — the deployed backend: a Cloudflare Worker + Durable Object
  (`VibegeistWorld`) holding one shared world's live state (who's active, the
  daily ghost count) and broadcasting over WebSocket. This is what
  vibegeist.dayloop-dilara.workers.dev actually runs.
- `server/index.js` — a plain Node/WebSocket equivalent for local-only use
  (no Cloudflare account needed) — same behavior, disposable in-memory state.
- `hook/report.js` — the script Claude Code hooks invoke. Reads hook stdin JSON,
  forwards `session_id` + event type, never throws. Defaults to the public world.
- `hook/settings.snippet.json` — reference hook config to copy into your own
  `settings.json`.
- `notifier/watch.js` — connects to the world's WebSocket feed and pops a native
  OS notification on join/ghost events, so you don't need a tab open at all.
- `public/index.html` — the world itself: a canvas, a WebSocket client, a
  Picture-in-Picture "widget" mode, no framework. Served as static assets by
  the Worker, or by `server/index.js` locally.

## Status

Live and shared. Deploy your own copy with `cd worker && npx wrangler deploy`
(requires a free Cloudflare account) if you'd rather run a separate world.
