import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 8787;
const STALE_MS = 10 * 60 * 1000;

// room -> world state; '' is the shared public world, anything else is a
// private room (?oda=... on the page, VIBEGEIST_ROOM in the hook) - mirrors
// the deployed worker, which keeps one Durable Object per room
const worlds = new Map();
function getWorld(room) {
  let w = worlds.get(room);
  if (!w) {
    // sessions: sessionHash -> { x, y, joinedAt, lastSeen, name, steps }
    // counters are in-memory only here; the deployed worker persists them
    w = { sessions: new Map(), ghostsToday: 0, ghostsAllTime: 0, scores: {}, flag: null, clients: new Set(), dayKey: new Date().toDateString() };
    worlds.set(room, w);
  }
  return w;
}

function resetDayIfNeeded(w) {
  const today = new Date().toDateString();
  if (today !== w.dayKey) {
    w.dayKey = today;
    w.ghostsToday = 0;
    w.scores = {};
  }
}

function broadcast(w, msg) {
  const data = JSON.stringify(msg);
  for (const ws of w.clients) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

function activeList(w) {
  return [...w.sessions.entries()].map(([id, s]) => ({ id, x: s.x, y: s.y, name: s.name, steps: s.steps }));
}

function stateOf(w) {
  return { active: activeList(w), ghostsToday: w.ghostsToday, ghostsAllTime: w.ghostsAllTime, scores: w.scores, flag: w.flag };
}

function cleanRoom(raw) {
  if (typeof raw !== 'string') return '';
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
}

function hashId(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex').slice(0, 16);
}

// deterministic pseudo-random position derived from the hashed id
// anyone can POST here, so the name is re-cleaned server-side no matter what
// the hook sent: first word only, letters/digits, at most 12 characters
function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  const word = raw.normalize('NFC').trim().split(/\s+/)[0] ?? '';
  return [...word.replace(/[^\p{L}\p{N}]/gu, '')].slice(0, 12).join('');
}

function seededPos(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { x: (h % 1000) / 1000, y: ((h >>> 8) % 1000) / 1000 };
}

async function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0];
  const reqPath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(PUBLIC_DIR, reqPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const body = await readFile(filePath);
    const ext = path.extname(filePath);
    const type = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html';
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/event') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { sessionId, type, name: rawName, room } = JSON.parse(body || '{}');
        const name = cleanName(rawName) || undefined;
        if (!sessionId || !type) throw new Error('missing fields');
        const w = getWorld(cleanRoom(room));
        resetDayIfNeeded(w);
        const id = hashId(sessionId);

        if (type === 'join') {
          const pos = seededPos(id);
          w.sessions.set(id, { ...pos, joinedAt: Date.now(), lastSeen: Date.now(), name, steps: 0 });
          broadcast(w, { type: 'join', id, ...pos, name, active: w.sessions.size });
        } else if (type === 'activity') {
          let s = w.sessions.get(id);
          if (!s) {
            // hook installed mid-session: no "join" ever fired, so treat the
            // first activity ping as an implicit join instead of dropping it
            const pos = seededPos(id);
            s = { ...pos, joinedAt: Date.now(), lastSeen: Date.now(), name, steps: 0 };
            w.sessions.set(id, s);
            broadcast(w, { type: 'join', id, ...pos, name, active: w.sessions.size });
          } else {
            s.lastSeen = Date.now();
          }
          s.steps += 1;
          broadcast(w, { type: 'activity', id, steps: s.steps });
        } else if (type === 'ghost') {
          const name = w.sessions.get(id)?.name;
          w.sessions.delete(id);
          w.ghostsToday += 1;
          w.ghostsAllTime += 1;
          if (name) {
            w.scores[name] = (w.scores[name] || 0) + 1;
            w.flag = { id, name, at: Date.now() };
          }
          broadcast(w, { type: 'ghost', id, name, active: w.sessions.size, ghostsToday: w.ghostsToday, ghostsAllTime: w.ghostsAllTime, scores: w.scores, flag: w.flag });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url.split('?')[0] === '/state') {
    const w = getWorld(cleanRoom(new URL(req.url, 'http://x').searchParams.get('oda')));
    resetDayIfNeeded(w);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stateOf(w)));
    return;
  }

  serveStatic(req, res);
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const w = getWorld(cleanRoom(new URL(req.url, 'http://x').searchParams.get('oda')));
  w.clients.add(ws);
  resetDayIfNeeded(w);
  ws.send(JSON.stringify({ type: 'snapshot', ...stateOf(w) }));
  ws.on('close', () => w.clients.delete(ws));
});

// silently drop sessions that stopped reporting without a clean "ghost" event
setInterval(() => {
  const now = Date.now();
  for (const w of worlds.values()) {
    for (const [id, s] of w.sessions) {
      if (now - s.lastSeen > STALE_MS) {
        w.sessions.delete(id);
        broadcast(w, { type: 'leave', id, name: s.name, active: w.sessions.size });
      }
    }
  }
}, 60 * 1000);

server.listen(PORT, () => {
  console.log(`vibegeist listening on http://localhost:${PORT}`);
});
