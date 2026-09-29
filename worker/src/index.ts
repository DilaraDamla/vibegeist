export { VibegeistWorld } from "./world";
import type { VibegeistWorld } from "./world";

interface Env {
  WORLD: DurableObjectNamespace<VibegeistWorld>;
}

// a private room is its own Durable Object: its own mountain, scoreboard and
// flag. No room (or an invalid one) means the shared public world.
function cleanRoom(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const room = cleanRoom(url.searchParams.get("oda"));
    const stub = env.WORLD.getByName(room ? `room:${room}` : "world");

    if (url.pathname === "/ws") {
      return stub.fetch(request);
    }

    if (url.pathname === "/event" && request.method === "POST") {
      try {
        const body = await request.json<{ sessionId?: string; type?: string; name?: unknown; room?: unknown }>();
        if (!body.sessionId || !body.type) {
          return Response.json({ ok: false, error: "missing fields" }, { status: 400 });
        }
        // the hook sends its room in the body; ?oda= on the URL works as well
        const bodyRoom = cleanRoom(body.room);
        const target = bodyRoom ? env.WORLD.getByName(`room:${bodyRoom}`) : stub;
        const result = await target.reportEvent(body.sessionId, body.type, body.name);
        return Response.json(result);
      } catch (err) {
        return Response.json({ ok: false, error: String(err) }, { status: 400 });
      }
    }

    if (url.pathname === "/state") {
      const state = await stub.getState();
      return Response.json(state);
    }

    return new Response("Not Found", { status: 404 });
  },
};
