#!/usr/bin/env node
// Connects to the vibegeist server's WebSocket feed and pops a native OS
// notification whenever a session finishes (a "ghost" rises). No browser
// tab needed - run this once and leave it running in the background.

import WebSocket from 'ws';
import notifier from 'node-notifier';

const SERVER_URL = process.env.VIBEGEIST_SERVER || 'wss://vibegeist.dayloop-dilara.workers.dev/ws';

function connect() {
  const ws = new WebSocket(SERVER_URL);

  ws.on('open', () => console.log('vibegeist notifier: bağlandı, ruhlar bekleniyor...'));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ghost') {
        notifier.notify({
          title: 'vibegeist',
          message: `👻 bir ruh yükseldi — bugün toplam ${msg.ghostsToday}`,
          sound: false,
        });
      } else if (msg.type === 'join') {
        notifier.notify({
          title: 'vibegeist',
          message: `🐤 yeni bir civciv doğdu — şu an ${msg.active} kişi çalışıyor`,
          sound: false,
        });
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => setTimeout(connect, 2000));
  ws.on('error', () => {});
}

connect();
