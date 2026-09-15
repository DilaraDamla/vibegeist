import { Scene } from './scene.js';
import { Mountain } from './mountain.js';
import { Route, SideRoute } from './route.js';
import { Waypoints } from './waypoints.js';
import { WidgetScene } from './widgetScene.js';
import { Task } from './task.js';
import { NetworkClient } from './network.js';
import { SoundEngine } from './sound.js';
import { drawGravestone } from './gravestone.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const soundBtn = document.getElementById('soundBtn');

const soundEngine = new SoundEngine();
function updateSoundBtn() {
  soundBtn.textContent = soundEngine.enabled ? '🔊' : '🔇';
  soundBtn.title = soundEngine.enabled ? 'Sesi kapat' : 'Sesi aç';
}
soundBtn.addEventListener('click', () => {
  soundEngine.toggle();
  updateSoundBtn();
});

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
const sideRoute = new SideRoute(canvas);
const widgetScene = new WidgetScene(canvas, sideRoute);
// a shared link can carry ?widget=1 so it opens straight into the compact
// view for whoever clicks it (e.g. sent to other players) - this renders
// the same WidgetScene/Task#drawProgress path the real PiP window uses,
// just in the normal tab, since documentPictureInPicture itself can only
// ever be opened from a click (browsers refuse it without one)
let pipActive = new URLSearchParams(location.search).has('widget');
function resizeAll() {
  resize();
  scene.resize();
  mountain.resize();
  waypoints.resize();
}
addEventListener('resize', resizeAll);

const tasks = new Map(); // id -> Task
const prevClimbed = new Map(); // id -> last frame's climbed, racing tasks only - for overtake detection
// markers left where an abandoned (never-finished) task's session went
// stale - client-side only, so they reset on reload, same as `tasks` itself
// (which also only reflects the current session's snapshot, not history)
const gravestones = [];
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
    const task = new Task(msg.id, msg.x, msg.y * Math.PI * 2, now);
    tasks.set(msg.id, task);
    soundEngine.playJoin(task.orbHue);
  } else if (msg.type === 'activity') {
    tasks.get(msg.id)?.activity(now);
  } else if (msg.type === 'ghost') {
    const task = tasks.get(msg.id);
    task?.complete(now);
    if (task) soundEngine.playSummit(task.orbHue);
    ghostsToday = msg.ghostsToday ?? ghostsToday + 1;
    ghostsAllTime = msg.ghostsAllTime ?? ghostsAllTime + 1;
  } else if (msg.type === 'leave') {
    const task = tasks.get(msg.id);
    // only a task that never reached the summit gets a marker - a normal
    // completion already has its own summit + rising-spirit ending
    if (task && task.state !== 'placing' && task.state !== 'ascending') {
      gravestones.push({ x: task.lastX, y: task.lastY, hue: task.chickHue });
    }
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

  // the widget gets its own compact one-sided view (progress running left to
  // right) instead of the full symmetric peak - a small corner window can't
  // fit the whole diorama legibly
  if (pipActive) {
    widgetScene.draw(ctx, t);
  } else {
    scene.drawSky(ctx);
    scene.drawStars(ctx, t);
    scene.drawWind(ctx, t, dt);
    scene.drawFarRanges(ctx);
    mountain.draw(ctx);
    waypoints.draw(ctx, t, dt);
    for (const g of gravestones) drawGravestone(ctx, g.x, g.y, g.hue);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const activeRoute = pipActive ? sideRoute : route;
  // back-to-front by ground height, so overlapping chicks stack sensibly
  const ordered = [...tasks.values()].sort((a, b) => a.lastY - b.lastY);
  for (const task of ordered) task.update(dt, now, activeRoute);

  // whoever is furthest along gets a crown - only meaningful with an actual
  // race (2+ still-climbing tasks), never for a lone chick
  const racing = ordered.filter((task) => task.state !== 'ascending');
  let leaderId = null;
  let leaderClimbed = -1;
  for (const task of racing) {
    if (task.climbed > leaderClimbed) {
      leaderClimbed = task.climbed;
      leaderId = task.id;
    }
  }
  const showLeader = racing.length > 1;

  // a giggle when one task's climbed position overtakes another's - compare
  // against last frame's snapshot, so it only fires on a genuine pass, not
  // on every frame both happen to be moving
  for (const a of racing) {
    const prevA = prevClimbed.get(a.id);
    if (prevA === undefined) continue;
    for (const b of racing) {
      if (a === b) continue;
      const prevB = prevClimbed.get(b.id);
      if (prevB === undefined) continue;
      if (prevA <= prevB && a.climbed > b.climbed) {
        soundEngine.playOvertake(a.orbHue);
        break;
      }
    }
  }
  prevClimbed.clear();
  for (const task of racing) prevClimbed.set(task.id, task.climbed);

  let removedAny = false;
  for (const task of ordered) {
    const isLeader = showLeader && task.id === leaderId;
    if (pipActive) task.drawProgress(ctx, activeRoute, t, now, isLeader);
    else task.draw(ctx, activeRoute, t, now, isLeader);
    if (task.finished) removedAny = true;
  }
  if (removedAny) {
    for (const [id, task] of tasks) if (task.finished) tasks.delete(id);
  }
  // a task's state (and so the "active" count) can change without a network
  // message arriving - e.g. entering 'ascending' mid-animation - so the HUD
  // has to stay in sync with the render loop, not just with socket events
  updateHud();

  if (!pipActive) scene.drawSnow(ctx, t, dt);

  requestAnimationFrame(draw);
}
draw();

const pipBtn = document.getElementById('pipBtn');
pipBtn.addEventListener('click', async () => {
  if (!('documentPictureInPicture' in window)) {
    alert('Bu özellik Chrome veya Edge gerektiriyor.');
    return;
  }
  const pipWindow = await documentPictureInPicture.requestWindow({ width: 420, height: 320 });

  for (const styleEl of document.querySelectorAll('style')) {
    pipWindow.document.head.append(styleEl.cloneNode(true));
  }

  pipWindow.document.body.append(hud);
  pipWindow.document.body.append(soundBtn);
  pipWindow.document.body.append(canvas);
  pipBtn.style.display = 'none';
  pipActive = true;
  resize();
  pipWindow.addEventListener('resize', resize);

  pipWindow.addEventListener('pagehide', () => {
    document.body.append(hud);
    document.body.append(soundBtn);
    document.body.append(canvas);
    pipBtn.style.display = '';
    pipActive = false;
    resizeAll();
  });
});
