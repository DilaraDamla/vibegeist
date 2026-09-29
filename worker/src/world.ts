import { DurableObject } from "cloudflare:workers";
// @ts-ignore - plain JS shared with the local dev server, bundled by wrangler
import { pickupItem, bumpStreak, liveStreaks, bumpWeek, weekChampion, EMOTES, EMOTE_COOLDOWN_MS } from "../../public/js/game.js";

interface SessionInfo {
  x: number;
  y: number;
  lastSeen: number;
  name?: string;
  // activity pings since this turn's join - the server-side climb progress,
  // so every viewer (and a late joiner) sees the same race, not their own count
  steps?: number;
  // item boxes opened this turn (see public/js/game.js)
  boxes?: number;
  // true when the name came from the hook (Claude account / VIBEGEIST_NAME) -
  // those can't be changed from the page, only unnamed chicks can be named there
  hookNamed?: boolean;
}

// the last player to reach the summit - their name flies on the peak's flag
interface Flag {
  id: string;
  name: string;
  at: number;
}

interface Env {
  WORLD: DurableObjectNamespace<VibegeistWorld>;
}

function todayKey(): string {
  return new Date().toDateString();
}

async function hashId(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// anyone can POST here, so the name is re-cleaned server-side no matter what
// the hook sent: first word only, letters/digits, at most 12 characters
function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const word = raw.normalize("NFC").trim().split(/\s+/)[0] ?? "";
  return [...word.replace(/[^\p{L}\p{N}]/gu, "")].slice(0, 12).join("");
}

function seededPos(id: string): { x: number; y: number } {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { x: (h % 1000) / 1000, y: ((h >>> 8) % 1000) / 1000 };
}

const STALE_MS = 10 * 60 * 1000;

export class VibegeistWorld extends DurableObject<Env> {
  sessions: Map<string, SessionInfo> = new Map();
  ghostsToday = 0;
  ghostsAllTime = 0;
  // today's summits per player name, for the scoreboard - reset with the day
  scores: Record<string, number> = {};
  flag: Flag | null = null;
  streaks: Record<string, { last: string; count: number }> = {};
  // names given from the page to chicks whose hook sent none, by session
  // hash - kept across turns, since every turn's join would otherwise wipe it
  nicknames: Record<string, string> = {};
  week: { key: string; scores: Record<string, number> } = { key: "", scores: {} };
  dayKey = "";
  private ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.ghostsToday = (await ctx.storage.get<number>("ghostsToday")) ?? 0;
      this.ghostsAllTime = (await ctx.storage.get<number>("ghostsAllTime")) ?? 0;
      this.dayKey = (await ctx.storage.get<string>("dayKey")) ?? todayKey();
      this.scores = (await ctx.storage.get<Record<string, number>>("scores")) ?? {};
      this.flag = (await ctx.storage.get<Flag>("flag")) ?? null;
      this.streaks = (await ctx.storage.get<typeof this.streaks>("streaks")) ?? {};
      this.nicknames = (await ctx.storage.get<Record<string, string>>("nicknames")) ?? {};
      this.week = (await ctx.storage.get<typeof this.week>("week")) ?? { key: "", scores: {} };
      // the Durable Object's in-memory state (this.sessions) is wiped whenever
      // the instance is evicted for inactivity - which can happen within
      // seconds between hook pings. Without this, sessions would flicker in
      // and out of existence unpredictably. Reload from storage on every cold start.
      const stored = await ctx.storage.get<Record<string, SessionInfo>>("sessions");
      this.sessions = new Map(Object.entries(stored ?? {}));
    });
  }

  private async persistSessions() {
    await this.ctx.storage.put("sessions", Object.fromEntries(this.sessions));
  }

  private async resetDayIfNeeded() {
    const today = todayKey();
    if (today !== this.dayKey) {
      this.dayKey = today;
      this.ghostsToday = 0;
      this.scores = {};
      await this.ctx.storage.put("dayKey", today);
      await this.ctx.storage.put("ghostsToday", 0);
      await this.ctx.storage.put("scores", {});
    }
  }

  private activeList() {
    return [...this.sessions.entries()].map(([id, s]) => ({ id, x: s.x, y: s.y, name: s.name || undefined, steps: s.steps ?? 0 }));
  }

  // the standings extras every viewer needs alongside the scoreboard
  private extras() {
    const now = Date.now();
    return { streaks: liveStreaks(this.streaks, now), champion: weekChampion(this.week, now) };
  }

  private broadcast(msg: unknown) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // socket gone, hibernation API will clean it up
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].send(
      JSON.stringify({
        type: "snapshot",
        active: this.activeList(),
        ghostsToday: this.ghostsToday,
        ghostsAllTime: this.ghostsAllTime,
        scores: this.scores,
        flag: this.flag,
        ...this.extras(),
      })
    );
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async reportEvent(sessionId: string, type: string, rawName?: unknown): Promise<{ ok: boolean }> {
    await this.ready;
    await this.resetDayIfNeeded();
    const id = await hashId(sessionId);
    const hookName = cleanName(rawName);
    const name = hookName || this.nicknames[id] || undefined;
    const hookNamed = !!hookName;

    if (type === "join") {
      const pos = seededPos(id);
      this.sessions.set(id, { ...pos, lastSeen: Date.now(), name, hookNamed, steps: 0, boxes: 0 });
      await this.persistSessions();
      this.broadcast({ type: "join", id, ...pos, name, active: this.sessions.size });
      const alarm = await this.ctx.storage.getAlarm();
      if (!alarm) await this.ctx.storage.setAlarm(Date.now() + 60_000);
    } else if (type === "activity") {
      let s = this.sessions.get(id);
      if (!s) {
        // hook was installed mid-session, so no "join" ever fired for it -
        // treat the first activity ping as an implicit join instead of dropping it
        const pos = seededPos(id);
        s = { ...pos, lastSeen: Date.now(), name, hookNamed, steps: 0, boxes: 0 };
        this.sessions.set(id, s);
        await this.persistSessions();
        this.broadcast({ type: "join", id, ...pos, name, active: this.sessions.size });
        const alarm = await this.ctx.storage.getAlarm();
        if (!alarm) await this.ctx.storage.setAlarm(Date.now() + 60_000);
      } else {
        s.lastSeen = Date.now();
      }
      s.steps = (s.steps ?? 0) + 1;
      const item = pickupItem(this.sessions, id);
      await this.persistSessions();
      this.broadcast({ type: "activity", id, steps: s.steps });
      if (item) this.broadcast(item);
    } else if (type === "ghost") {
      const name = this.sessions.get(id)?.name;
      this.sessions.delete(id);
      this.ghostsToday += 1;
      if (name) {
        this.scores[name] = (this.scores[name] ?? 0) + 1;
        this.flag = { id, name, at: Date.now() };
        bumpStreak(this.streaks, name, Date.now());
        bumpWeek(this.week, name, Date.now());
        await this.ctx.storage.put("scores", this.scores);
        await this.ctx.storage.put("flag", this.flag);
        await this.ctx.storage.put("streaks", this.streaks);
        await this.ctx.storage.put("week", this.week);
      }
      this.ghostsAllTime += 1;
      await this.persistSessions();
      await this.ctx.storage.put("ghostsToday", this.ghostsToday);
      await this.ctx.storage.put("ghostsAllTime", this.ghostsAllTime);
      this.broadcast({
        type: "ghost",
        id,
        name,
        active: this.sessions.size,
        ghostsToday: this.ghostsToday,
        ghostsAllTime: this.ghostsAllTime,
        scores: this.scores,
        flag: this.flag,
        ...this.extras(),
      });
    }

    return { ok: true };
  }

  async getState(): Promise<{
    active: { id: string; x: number; y: number; name?: string; steps: number }[];
    ghostsToday: number;
    ghostsAllTime: number;
    scores: Record<string, number>;
    flag: Flag | null;
    streaks: Record<string, number>;
    champion: { name: string; count: number } | null;
  }> {
    await this.ready;
    await this.resetDayIfNeeded();
    return {
      active: this.activeList(),
      ghostsToday: this.ghostsToday,
      ghostsAllTime: this.ghostsAllTime,
      scores: this.scores,
      flag: this.flag,
      ...this.extras(),
    };
  }

  // the only things a viewer can send: an emote for a chick on the mountain
  // (a fixed emoji set, never text), or a name for a chick whose hook sent
  // none (cleaned like every other name). Rate-limited per connection.
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ready;
    let msg: { type?: string; id?: unknown; name?: unknown; emote?: unknown };
    try {
      msg = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }
    const id = typeof msg.id === "string" ? msg.id : "";
    const s = this.sessions.get(id);
    if (!s) return;
    const last = (ws.deserializeAttachment() as { lastSent?: number } | null)?.lastSent ?? 0;
    if (Date.now() - last < EMOTE_COOLDOWN_MS) return;

    if (msg.type === "emote" && EMOTES.includes(msg.emote)) {
      ws.serializeAttachment({ lastSent: Date.now() });
      this.broadcast({ type: "emote", id, emote: msg.emote });
    } else if (msg.type === "name" && !s.hookNamed) {
      const name = cleanName(msg.name);
      if (!name) return;
      ws.serializeAttachment({ lastSent: Date.now() });
      s.name = name;
      this.nicknames[id] = name;
      // a small cap so the public world's map can't grow without bound
      const ids = Object.keys(this.nicknames);
      if (ids.length > 500) delete this.nicknames[ids[0]];
      await this.persistSessions();
      await this.ctx.storage.put("nicknames", this.nicknames);
      this.broadcast({ type: "name", id, name });
    }
  }

  async alarm(): Promise<void> {
    await this.ready;
    const now = Date.now();
    let changed = false;
    for (const [id, s] of this.sessions) {
      if (now - s.lastSeen > STALE_MS) {
        this.sessions.delete(id);
        changed = true;
        this.broadcast({ type: "leave", id, name: s.name, active: this.sessions.size });
      }
    }
    if (changed) await this.persistSessions();
    if (this.sessions.size > 0) {
      await this.ctx.storage.setAlarm(Date.now() + 60_000);
    }
  }
}
