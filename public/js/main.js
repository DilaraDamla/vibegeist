import { Scene } from './scene.js';
import { Mountain } from './mountain.js';
import { Route } from './route.js';
import { Waypoints } from './waypoints.js';
import { Task } from './task.js';
import { NetworkClient } from './network.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');

function resize() {
  const win = canvas.ownerDocument.defaultView || window;
  canvas.width = win.innerWidth;
  canvas.height = win.innerHeight;
}
resize();

const scene = new Scene(canvas);
const mountain = new Mountain(canvas);
const route = new Route(canvas);
const waypoints = new Waypoints(canvas, route);
addEventListener('resize', () => {
  resize();
  scene.resize();
  mountain.resize();
  waypoints.resize();
});

const tasks = new Map(); // id -> Task
let ghostsToday = 0;
let ghostsAllTime = 0;

function updateHud() {
  const active = [...tasks.values()].filter((t) => t.state !== 'ascending').length;
  hud.innerHTML = `şu an <b>${active}</b> civciv çalışıyor<small>bugün ${ghostsToday} ruh yükseldi · toplam ${ghostsAllTime}</small>`;
}

new NetworkClient((msg) => {
  const now = Date.now();
  if (msg.type === 'snapshot') {
    tasks.clear();
    for (const s of msg.active) {
      // already-active sessions from before this viewer connected - drop them
      // straight into climbing, skipping the "just spawned" arrival beat
      const task = new Task(s.id, s.x, s.y * Math.PI * 2, now);
      task.state = 'climbing';
      task.since = now;
      tasks.set(s.id, task);
    }
    ghostsToday = msg.ghostsToday || 0;
    ghostsAllTime = msg.ghostsAllTime || 0;
  } else if (msg.type === 'join') {
    tasks.set(msg.id, new Task(msg.id, msg.x, msg.y * Math.PI * 2, now));
  } else if (msg.type === 'activity') {
    tasks.get(msg.id)?.activity(now);
  } else if (msg.type === 'ghost') {
    tasks.get(msg.id)?.complete(now);
    ghostsToday = msg.ghostsToday ?? ghostsToday + 1;
    ghostsAllTime = msg.ghostsAllTime ?? ghostsAllTime + 1;
  } else if (msg.type === 'leave') {
    tasks.delete(msg.id);
  }
  updateHud();
});

let lastFrameTs = Date.now();
function draw() {
  const now = Date.now();
  const dt = Math.min((now - lastFrameTs) / 1000, 0.1);
  lastFrameTs = now;
  const t = now / 1000;

  scene.drawSky(ctx);
  scene.drawStars(ctx, t);
  scene.drawWind(ctx, t, dt);
  scene.drawFarRanges(ctx);
  mountain.draw(ctx);
  waypoints.draw(ctx, t, dt);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // back-to-front by ground height, so overlapping chicks stack sensibly
  const ordered = [...tasks.values()].sort((a, b) => a.lastY - b.lastY);
  let removedAny = false;
  for (const task of ordered) {
    task.update(dt, now, route);
    task.draw(ctx, route, t, now);
    if (task.finished) removedAny = true;
  }
  if (removedAny) {
    for (const [id, task] of tasks) if (task.finished) tasks.delete(id);
  }
  // a task's state (and so the "active" count) can change without a network
  // message arriving - e.g. entering 'ascending' mid-animation - so the HUD
  // has to stay in sync with the render loop, not just with socket events
  updateHud();

  scene.drawSnow(ctx, t, dt);

  requestAnimationFrame(draw);
}
draw();

const pipBtn = document.getElementById('pipBtn');
pipBtn.addEventListener('click', async () => {
  if (!('documentPictureInPicture' in window)) {
    alert('Bu özellik Chrome veya Edge gerektiriyor.');
    return;
  }
  const pipWindow = await documentPictureInPicture.requestWindow({ width: 280, height: 220 });

  for (const styleEl of document.querySelectorAll('style')) {
    pipWindow.document.head.append(styleEl.cloneNode(true));
  }

  pipWindow.document.body.append(hud);
  pipWindow.document.body.append(canvas);
  pipBtn.style.display = 'none';
  resize();
  pipWindow.addEventListener('resize', resize);

  pipWindow.addEventListener('pagehide', () => {
    document.body.append(hud);
    document.body.append(canvas);
    pipBtn.style.display = '';
    resize();
  });
});
