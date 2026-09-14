import { DurableObject } from "cloudflare:workers";

interface SessionInfo {
  x: number;
  y: number;
  lastSeen: number;
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
  dayKey = "";
  private ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.ghostsToday = (await ctx.storage.get<number>("ghostsToday")) ?? 0;
      this.ghostsAllTime = (await ctx.storage.get<number>("ghostsAllTime")) ?? 0;
      this.dayKey = (await ctx.storage.get<string>("dayKey")) ?? todayKey();
    });
  }

  private async resetDayIfNeeded() {
    const today = todayKey();
    if (today !== this.dayKey) {
      this.dayKey = today;
      this.ghostsToday = 0;
      await this.ctx.storage.put("dayKey", today);
      await this.ctx.storage.put("ghostsToday", 0);
    }
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
        active: [...this.sessions.entries()].map(([id, s]) => ({ id, x: s.x, y: s.y })),
        ghostsToday: this.ghostsToday,
        ghostsAllTime: this.ghostsAllTime,
      })
    );
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async reportEvent(sessionId: string, type: string): Promise<{ ok: boolean }> {
    await this.ready;
    await this.resetDayIfNeeded();
    const id = await hashId(sessionId);

    if (type === "join") {
      const pos = seededPos(id);
      this.sessions.set(id, { ...pos, lastSeen: Date.now() });
      this.broadcast({ type: "join", id, ...pos, active: this.sessions.size });
      const alarm = await this.ctx.storage.getAlarm();
      if (!alarm) await this.ctx.storage.setAlarm(Date.now() + 60_000);
    } else if (type === "activity") {
      let s = this.sessions.get(id);
      if (!s) {
        // hook was installed mid-session, so no "join" ever fired for it -
        // treat the first activity ping as an implicit join instead of dropping it
        const pos = seededPos(id);
        s = { ...pos, lastSeen: Date.now() };
        this.sessions.set(id, s);
        this.broadcast({ type: "join", id, ...pos, active: this.sessions.size });
        const alarm = await this.ctx.storage.getAlarm();
        if (!alarm) await this.ctx.storage.setAlarm(Date.now() + 60_000);
      } else {
        s.lastSeen = Date.now();
      }
      this.broadcast({ type: "activity", id });
    } else if (type === "ghost") {
      this.sessions.delete(id);
      this.ghostsToday += 1;
      this.ghostsAllTime += 1;
      await this.ctx.storage.put("ghostsToday", this.ghostsToday);
      await this.ctx.storage.put("ghostsAllTime", this.ghostsAllTime);
      this.broadcast({
        type: "ghost",
        id,
        active: this.sessions.size,
        ghostsToday: this.ghostsToday,
        ghostsAllTime: this.ghostsAllTime,
      });
    }

    return { ok: true };
  }

  async getState(): Promise<{
    active: { id: string; x: number; y: number }[];
    ghostsToday: number;
    ghostsAllTime: number;
  }> {
    await this.ready;
    await this.resetDayIfNeeded();
    return {
      active: [...this.sessions.entries()].map(([id, s]) => ({ id, x: s.x, y: s.y })),
      ghostsToday: this.ghostsToday,
      ghostsAllTime: this.ghostsAllTime,
    };
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (now - s.lastSeen > STALE_MS) {
        this.sessions.delete(id);
        this.broadcast({ type: "leave", id, active: this.sessions.size });
      }
    }
    if (this.sessions.size > 0) {
      await this.ctx.storage.setAlarm(Date.now() + 60_000);
    }
  }
}
