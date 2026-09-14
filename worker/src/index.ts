export { VibegeistWorld } from "./world";
import type { VibegeistWorld } from "./world";

interface Env {
  WORLD: DurableObjectNamespace<VibegeistWorld>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const stub = env.WORLD.getByName("world");

    if (url.pathname === "/ws") {
      return stub.fetch(request);
    }

    if (url.pathname === "/event" && request.method === "POST") {
      try {
        const body = await request.json<{ sessionId?: string; type?: string }>();
        if (!body.sessionId || !body.type) {
          return Response.json({ ok: false, error: "missing fields" }, { status: 400 });
        }
        const result = await stub.reportEvent(body.sessionId, body.type);
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
