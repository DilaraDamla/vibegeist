// thin websocket wrapper - the wire protocol (snapshot/join/activity/ghost/leave)
// is unchanged from before, so the hooks and the server need no changes at all.
// room: a private room's name (from ?oda=), or '' for the public world.
export class NetworkClient {
  constructor(onMessage, room = '') {
    this.onMessage = onMessage;
    this.room = room;
    this.connect();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const query = this.room ? `?oda=${encodeURIComponent(this.room)}` : '';
    this.ws = new WebSocket(`${proto}://${location.host}/ws${query}`);
    this.ws.onmessage = (ev) => this.onMessage(JSON.parse(ev.data));
    this.ws.onclose = () => setTimeout(() => this.connect(), 2000);
  }

  // viewer -> server: only emotes and names for unnamed chicks (see world.ts)
  send(msg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
