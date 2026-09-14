// thin websocket wrapper - the wire protocol (snapshot/join/activity/ghost/leave)
// is unchanged from before, so the hooks and the server need no changes at all.
export class NetworkClient {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.connect();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onmessage = (ev) => this.onMessage(JSON.parse(ev.data));
    this.ws.onclose = () => setTimeout(() => this.connect(), 2000);
  }
}
