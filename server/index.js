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

// sessionHash -> { x, y, joinedAt, lastSeen }
const sessions = new Map();
let ghostsToday = 0;
let dayKey = new Date().toDateString();

const clients = new Set();

function resetDayIfNeeded() {
  const today = new Date().toDateString();
  if (today !== dayKey) {
    dayKey = today;
    ghostsToday = 0;
  }
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

function hashId(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex').slice(0, 16);
}

// deterministic pseudo-random position derived from the hashed id
function seededPos(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { x: (h % 1000) / 1000, y: ((h >>> 8) % 1000) / 1000 };
}

async function serveStatic(req, res) {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
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
        const { sessionId, type } = JSON.parse(body || '{}');
        if (!sessionId || !type) throw new Error('missing fields');
        resetDayIfNeeded();
        const id = hashId(sessionId);

        if (type === 'join') {
          const pos = seededPos(id);
          sessions.set(id, { ...pos, joinedAt: Date.now(), lastSeen: Date.now() });
          broadcast({ type: 'join', id, ...pos, active: sessions.size });
        } else if (type === 'activity') {
          const s = sessions.get(id);
          if (s) s.lastSeen = Date.now();
          broadcast({ type: 'activity', id });
        } else if (type === 'ghost') {
          sessions.delete(id);
          ghostsToday += 1;
          broadcast({ type: 'ghost', id, active: sessions.size, ghostsToday });
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

  if (req.method === 'GET' && req.url === '/state') {
    resetDayIfNeeded();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        active: [...sessions.entries()].map(([id, s]) => ({ id, x: s.x, y: s.y })),
        ghostsToday,
      })
    );
    return;
  }

  serveStatic(req, res);
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  clients.add(ws);
  resetDayIfNeeded();
  ws.send(
    JSON.stringify({
      type: 'snapshot',
      active: [...sessions.entries()].map(([id, s]) => ({ id, x: s.x, y: s.y })),
      ghostsToday,
    })
  );
  ws.on('close', () => clients.delete(ws));
});

// silently drop sessions that stopped reporting without a clean "ghost" event
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastSeen > STALE_MS) {
      sessions.delete(id);
      broadcast({ type: 'leave', id, active: sessions.size });
    }
  }
}, 60 * 1000);

server.listen(PORT, () => {
  console.log(`vibegeist listening on http://localhost:${PORT}`);
});
