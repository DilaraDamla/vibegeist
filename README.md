# vibegeist

A shared ambient world where every Claude Code turn climbs a mountain.

No chat, no accounts, no user-generated content. Your Claude Code hooks send three
anonymous, hashed pings to a server: **join** (a turn starts), **activity**
(a tool ran), **ghost** (a turn ends). The browser page turns that into little
chicks that spawn at a campfire, take up a glowing sphere, and carry it up a
route past a forest, a rope bridge, a waterfall, a cave, a rocky ridge, and a
ruined temple. Each tool-use call nudges them further along. When your turn
finishes, the chick dashes to the summit, sets the sphere down in a burst of
light — it dissolves into the peak's own glow — and rises away as a drifting
spirit, alongside everyone else climbing right now.

Note that Claude Code's `Stop` hook fires at the end of every turn, not just
when you close the whole session — so a climb is really "one turn," and a
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

Every turn you run will now show up as a chick climbing the shared mountain,
and rise away as a spirit the moment it finishes.

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
whenever a spirit rises or a new chick joins — no browser tab required.

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
- `public/index.html` + `public/js/` — the world itself: a canvas, a WebSocket
  client, a Picture-in-Picture "widget" mode (a compact one-sided ascending
  view, distinct from the main page's symmetric diorama), no framework.
  `task.js` is the state machine for one climb (arrive → climb → summit →
  place → ascend); `route.js`, `mountain.js`, and `waypoints.js` draw the
  fixed geography every task walks through; `chick.js`, `orb.js`, and
  `spirit.js` draw the three things a task looks like at each stage. Served
  as static assets by the Worker, or by `server/index.js` locally.

## Status

Live and shared. Deploy your own copy with `cd worker && npx wrangler deploy`
(requires a free Cloudflare account) if you'd rather run a separate world.
