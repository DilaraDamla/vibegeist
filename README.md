# vibegeist

A shared ambient world where every Claude Code session that finishes becomes a ghost.

No chat, no accounts, no user-generated content. Your Claude Code hooks send three
anonymous, hashed pings to a tiny server: **join** (session starts), **activity**
(a tool ran), **ghost** (session stops). The browser page turns that into dots that
pulse while you work and drift upward into ghosts when you're done — alongside
everyone else who currently has it open.

## Run it locally

```
npm install
npm start
```

Open http://localhost:8787 in a browser tab and leave it open.

## Wire up your Claude Code sessions

Add the hooks from `hook/settings.snippet.json` to your `~/.claude/settings.json`
(merge with whatever hooks you already have — don't replace the file), replacing
`/ABSOLUTE/PATH/TO/vibegeist` with the real path to this folder on your machine.

Then open `/hooks` once inside Claude Code to reload the config.

Every session you run will now show up as a dot in the world, and turn into a
ghost the moment it stops.

## Privacy

The hook script only ever sends a SHA-256 hash of your Claude Code session ID and
an event name (`join` / `activity` / `ghost`). No file paths, no commands, no code,
no prompts — nothing that identifies you or your project ever leaves your machine.

## What's here

- `server/index.js` — the whole backend: an HTTP endpoint for hook pings, a
  WebSocket broadcast to connected browser tabs, an in-memory world state, and a
  daily ghost counter. No database, no auth — intentionally disposable.
- `hook/report.js` — the script Claude Code hooks invoke. Reads hook stdin JSON,
  forwards `session_id` + event type, never throws.
- `hook/settings.snippet.json` — reference hook config to copy into your own
  `settings.json`.
- `public/index.html` — the world itself: a canvas, a WebSocket client, no
  framework.

## Status

Prototype. No hosted version yet — everyone runs their own server for now, so
"shared world" currently means "shared with anyone you point at the same server."
A hosted, truly shared instance is the natural next step.
