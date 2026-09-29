import { Scene } from './scene.js';
import { Mountain } from './mountain.js';
import { Route, SideRoute, CameraRoute } from './route.js';
import { Waypoints } from './waypoints.js';
import { WidgetScene } from './widgetScene.js';
import { Task, WIDGET_SCALE, EMOTE_ICONS } from './task.js';
import { NetworkClient } from './network.js';
import { SoundEngine } from './sound.js';
import { drawGravestone } from './gravestone.js';
import { drawIdleChicks } from './idle.js';
import { Ambience } from './ambient.js';
import { renderRacePanel, Announcer, drawSummitFlag, HighFives, drawItemBoxes, boxPosition, MeBar } from './race.js';
import { Moments } from './moments.js';
import { BOX_STEPS } from './game.js';
import { stepsToProgress } from './task.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const soundBtn = document.getElementById('soundBtn');
const racePanel = document.getElementById('race');
const announcer = new Announcer(document.getElementById('toast'));
const highFives = new HighFives();

// ?oda=<name>: a private room - its own mountain, scoreboard and flag, for
// playing with friends (their hooks set VIBEGEIST_ROOM to the same name)
const room = (new URLSearchParams(location.search).get('oda') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);

// which chick is this viewer's own - picked by clicking its row in the race
// panel, remembered per room (a Claude window keeps the same chick across
// turns). Only a convenience, so storage failing just means picking again.
const ME_KEY = `vibegeist.me.${room}`;
let meId = null;
try {
  meId = localStorage.getItem(ME_KEY);
} catch {}
// the standings can fold down to one line - on a phone the mountain
// matters more than the table, so it starts folded there
const FOLD_KEY = 'vibegeist.raceFolded';
// (not in the widget, where the two-line standings are the whole point)
let raceFolded = matchMedia('(max-width: 600px)').matches && !new URLSearchParams(location.search).has('widget');
try {
  const saved = localStorage.getItem(FOLD_KEY);
  if (saved !== null) raceFolded = saved === '1';
} catch {}
racePanel.addEventListener('click', (ev) => {
  if (ev.target.closest('.race-head')) {
    raceFolded = !raceFolded;
    try {
      localStorage.setItem(FOLD_KEY, raceFolded ? '1' : '0');
    } catch {}
    updateHud();
    return;
  }
  const row = ev.target.closest('.race-row');
  if (!row) return;
  meId = row.dataset.id;
  try {
    localStorage.setItem(ME_KEY, meId);
  } catch {}
  updateHud();
});
// the server drops emotes sent faster than this anyway - matching it here
// means every press that bounces a button also shows up on the mountain
let lastEmoteAt = 0;
function sendEmote(kind) {
  if (!meId || !tasks.has(meId) || Date.now() - lastEmoteAt < 850) return;
  lastEmoteAt = Date.now();
  meBar.pressed(kind);
  net.send({ type: 'emote', id: meId, emote: kind });
}
const meBar = new MeBar(
  document.getElementById('me'),
  sendEmote,
  (name) => meId && net.send({ type: 'name', id: meId, name })
);
// 1-4 on the keyboard fire the emotes, unless the name box has focus
addEventListener('keydown', (ev) => {
  if (ev.target.closest?.('input')) return;
  const kind = Object.keys(EMOTE_ICONS)[Number(ev.key) - 1];
  if (kind) sendEmote(kind);
});

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
const ambience = new Ambience(canvas);
ambience.setAnchors(waypoints.anchors);
const moments = new Moments(canvas);
// landmark moments belong to the full diorama - the widget is kept quiet
Task.onLandmark = (name, task, now) => {
  if (!pipActive) moments.landmark(name, waypoints.anchors, now);
};
// the item boxes' own animation state: when each last opened
const boxOpenedAt = BOX_STEPS.map(() => 0);
const sideRoute = new SideRoute(canvas);
const widgetScene = new WidgetScene(canvas, sideRoute);
// a shared link can carry ?widget=1 so it opens straight into the compact
// view for whoever clicks it (e.g. sent to other players) - this renders
// the same WidgetScene/Task#drawProgress path the real PiP window uses,
// just in the normal tab, since documentPictureInPicture itself can only
// ever be opened from a click (browsers refuse it without one)
let pipActive = new URLSearchParams(location.search).has('widget');

// the widget's camera: a [lo, hi] slice of 0..1 progress that follows
// whoever's furthest along, so the small window shows a close-up of the
// mountain instead of the whole camp-to-peak span shrunk down. Both ends
// ease toward their target each frame rather than snapping, and the window
// widens when tasks are spread apart so a close race stays in frame together.
let camCenter = 0;
let camHalfSpan = 0.045;
function updateCamera(dt) {
  const active = [...tasks.values()].filter((task) => task.state !== 'ascending');
  let target = camCenter;
  let spread = 0;
  if (active.length) {
    const progresses = active.map((task) =>
      task.state === 'placing' ? 1 : task.state === 'arriving' ? 0 : task.climbed
    );
    target = Math.max(...progresses);
    spread = target - Math.min(...progresses);
  } else {
    target = 0; // nobody climbing - settle back on camp, same as the idle chicks
  }
  const targetHalfSpan = Math.min(0.16, Math.max(0.045, spread * 0.6 + 0.045));
  const ease = Math.min(1, dt * 2.2);
  camCenter += (target - camCenter) * ease;
  camHalfSpan += (targetHalfSpan - camHalfSpan) * ease;

  let lo = camCenter - camHalfSpan;
  let hi = camCenter + camHalfSpan;
  // shift the whole window back into [0, 1] rather than clamping each end
  // independently, so its width (and so the zoom level) doesn't change
  // right at the very start or end of the climb
  if (lo < 0) {
    hi -= lo;
    lo = 0;
  }
  if (hi > 1) {
    lo -= hi - 1;
    hi = 1;
  }
  return { lo: Math.max(0, lo), hi: Math.min(1, hi) };
}

function resizeAll() {
  resize();
  scene.resize();
  mountain.resize();
  waypoints.resize();
  ambience.resize();
  ambience.setAnchors(waypoints.anchors);
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
let scores = {}; // today's summits per player name
let flag = null; // last player to summit: { id, name, at }
let streaks = {}; // name -> days in a row with a summit
let champion = null; // { name, count } - most summits this week

function updateHud() {
  const active = [...tasks.values()].filter((t) => t.state !== 'ascending').length;
  hud.innerHTML = `şu an <b>${active}</b> civciv çalışıyor<small>bugün ${ghostsToday} ruh yükseldi · toplam ${ghostsAllTime}</small>`;
  for (const task of tasks.values()) {
    task.streak = (task.name && streaks[task.name]) || 0;
    task.champion = !!task.name && champion?.name === task.name;
  }
  const small = pipActive || innerWidth < 600;
  renderRacePanel(racePanel, tasks, Date.now(), scores, room, meId, streaks, small ? 3 : 6, raceFolded);
  racePanel.classList.toggle('folded', raceFolded);
  meBar.render(tasks.get(meId), tasks.size > 0);
}

function who(name) {
  return name || 'bir civciv';
}

// chicks within `radius` px of `task` turn to look at it for a moment -
// the world reacting to someone's emote, slip or arrival (onlyNearCamp: a
// newcomer only catches the eye of chicks that haven't climbed far yet)
function lookNear(task, radius, ms, now, onlyNearCamp = 1) {
  for (const other of tasks.values()) {
    if (other === task || other.state === 'ascending' || other.climbed > onlyNearCamp) continue;
    if (Math.hypot(other.lastX - task.lastX, other.lastY - task.lastY) > radius) continue;
    other.lookAt = { x: task.lastX, y: task.lastY - 20, until: now + ms };
  }
}

// the sparkle shower falls a beat after the orb lands, not on the message
const summitShowers = [];

// palette colors already on the mountain, so a newcomer gets a different one
function takenColors() {
  return new Set([...tasks.values()].filter((task) => task.state !== 'ascending').map((task) => task.look.colorIdx));
}

const net = new NetworkClient((msg) => {
  const now = Date.now();
  if (msg.type === 'snapshot') {
    tasks.clear();
    for (const s of msg.active) {
      // already-active sessions from before this viewer connected - drop them
      // straight into climbing, skipping the "just spawned" arrival beat
      const task = new Task(s.id, s.x, s.y * Math.PI * 2, now, takenColors(), s.name);
      task.state = 'climbing';
      task.since = now;
      task.syncSteps(s.steps);
      tasks.set(s.id, task);
    }
    ghostsToday = msg.ghostsToday || 0;
    ghostsAllTime = msg.ghostsAllTime || 0;
    scores = msg.scores || {};
    flag = msg.flag || null;
    streaks = msg.streaks || {};
    champion = msg.champion || null;
  } else if (msg.type === 'join') {
    const task = new Task(msg.id, msg.x, msg.y * Math.PI * 2, now, takenColors(), msg.name);
    tasks.set(msg.id, task);
    soundEngine.playJoin(task.orbHue);
    // the world notices the newcomer instead of a banner: the campfire
    // flares, and whoever's still near camp turns to look
    waypoints.flareCamp(now);
    lookNear(task, 9999, 1500, now, 0.25);
  } else if (msg.type === 'activity') {
    tasks.get(msg.id)?.activity(now, msg.steps);
  } else if (msg.type === 'ghost') {
    const task = tasks.get(msg.id);
    task?.complete(now);
    if (task) soundEngine.playSummit(task.orbHue);
    // everyone else on the mountain looks up and gives a little hop
    const peak = (pipActive ? null : route.pointAt(1, 0));
    for (const other of tasks.values()) {
      if (other === task || other.state === 'ascending') continue;
      other.cheerAt = now + Math.random() * 300;
      if (peak) other.lookAt = { ...peak, until: now + 2200 };
    }
    if (peak && task) summitShowers.push({ hue: task.orbHue, at: now + 900 });
    ghostsToday = msg.ghostsToday ?? ghostsToday + 1;
    ghostsAllTime = msg.ghostsAllTime ?? ghostsAllTime + 1;
    if (msg.scores) scores = msg.scores;
    if (msg.flag) flag = msg.flag;
    if (msg.streaks) streaks = msg.streaks;
    if (msg.champion !== undefined) champion = msg.champion;
    // a turn ending IS the win: the chick reaches the summit exactly when
    // that player's Claude finishes its reply
    announcer.say(`🏆 ${who(msg.name)} zirveye çıktı! (Claude işini bitirdi)`);
  } else if (msg.type === 'item') {
    const task = tasks.get(msg.id);
    task?.activity(now, msg.steps);
    // the box it opened jumps and flashes, and the prize rises out of it
    if (msg.box !== undefined && boxOpenedAt[msg.box] !== undefined) {
      boxOpenedAt[msg.box] = now;
      if (!pipActive) moments.boxOpen(boxPosition(route, msg.box), msg.item, now);
    }
    if (msg.item === 'banana') {
      // the banana is thrown first; the chick just behind only slips (and
      // slides back to the server's new position) when it lands
      const victim = tasks.get(msg.target);
      if (victim) {
        const THROW_MS = 450;
        if (task && !pipActive) moments.banana(task, victim, now);
        victim.effect = { kind: 'slip', at: now + THROW_MS };
        setTimeout(() => victim.activity(Date.now(), msg.targetSteps), THROW_MS);
        lookNear(victim, 170, 1400 + THROW_MS, now);
      }
      soundEngine.playOvertake(task?.orbHue ?? 0);
      announcer.say(`🍌 ${who(task?.name)} muz bıraktı, ${who(victim?.name)} kaydı!`);
    } else {
      if (task) task.effect = { kind: 'boost', at: now };
      soundEngine.playJoin(task?.orbHue ?? 0);
      announcer.say(`🍄 ${who(task?.name)} mantar buldu, fırladı!`);
    }
  } else if (msg.type === 'emote') {
    const task = tasks.get(msg.id);
    if (task) {
      task.emote = { kind: msg.emote, at: now };
      lookNear(task, 170, 1600, now);
    }
  } else if (msg.type === 'name') {
    const task = tasks.get(msg.id);
    if (task) task.name = msg.name;
  } else if (msg.type === 'leave') {
    const task = tasks.get(msg.id);
    // the only way to "fall": no sign of life for 10 minutes mid-climb
    if (task) announcer.say(`💤 ${who(msg.name)} yolda kaldı (10 dk ses çıkmadı)`);
    // only a task that never reached the summit gets a marker - a normal
    // completion already has its own summit + rising-spirit ending. Stored
    // as route progress, not raw pixels, so it resolves correctly on
    // whichever route (main or widget) is active when it's drawn, and
    // survives a canvas resize in between
    if (task && task.state !== 'placing' && task.state !== 'ascending') {
      gravestones.push({ progress: task.climbed, lateralOffset: task.lateralOffset, hue: task.chickHue });
    }
    tasks.delete(msg.id);
  }
  updateHud();
}, room);

let lastFrameTs = Date.now();
function draw() {
  const now = Date.now();
  const dt = Math.min((now - lastFrameTs) / 1000, 0.1);
  lastFrameTs = now;
  const t = now / 1000;

  // the widget gets its own compact one-sided view (progress running left to
  // right) instead of the full symmetric peak - a small corner window can't
  // fit the whole diorama legibly
  scene.updateStorm();
  const storm = scene.stormFrac; // storms play out in the widget too, not just the main diorama
  const breath = ambience.breath(t);
  ambience.update(now);
  soundEngine.setStormIntensity(storm);
  const camera = pipActive ? updateCamera(dt) : null;
  if (pipActive) {
    widgetScene.draw(ctx, t, camera);
    scene.drawWind(ctx, t, dt, storm, breath);
  } else {
    scene.drawSky(ctx);
    scene.drawStars(ctx, t);
    ambience.drawSky(ctx, t, dt, now, breath);
    scene.drawWind(ctx, t, dt, storm, breath);
    scene.drawFarRanges(ctx);
    ambience.drawBirds(ctx, t, dt);
    mountain.draw(ctx);
    waypoints.draw(ctx, t, dt, Math.max(breath, storm));
    // as the leader nears the top, the peak starts to answer
    let top = 0;
    for (const task of tasks.values()) if (task.state === 'climbing') top = Math.max(top, task.climbed);
    if (top > 0.8) mountain.drawPeakGlow(ctx, ((top - 0.8) / 0.12) * (0.55 + 0.1 * Math.sin(t * 2)));
    drawSummitFlag(ctx, route, flag, t);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const activeRoute = pipActive ? new CameraRoute(sideRoute, camera.lo, camera.hi, widgetScene.shiftFor(camera.lo, camera.hi)) : route;

  // a box perks up as a climber closes in on it
  const near = BOX_STEPS.map((steps) => {
    const p = stepsToProgress(steps);
    let n = 0;
    for (const task of tasks.values()) {
      const d = p - task.climbed;
      if (task.state === 'climbing' && d > 0 && d < 0.08) n = Math.max(n, 1 - d / 0.08);
    }
    return n;
  });
  drawItemBoxes(ctx, activeRoute, t, pipActive ? WIDGET_SCALE : 1, { openedAt: boxOpenedAt, near }, now);

  // resolved from route progress at draw time (not stored pixels), so these
  // land correctly on whichever view is active and survive a canvas resize
  for (const g of gravestones) {
    const pos = activeRoute.pointAt(g.progress, pipActive ? 0 : g.lateralOffset);
    drawGravestone(ctx, pos.x, pos.y, g.hue, pipActive ? WIDGET_SCALE : 1);
  }

  // nobody's climbing right now - the world shouldn't just sit empty, so a
  // few chicks rest near camp and snack until someone starts a task
  if (tasks.size === 0) drawIdleChicks(ctx, activeRoute, t, pipActive ? WIDGET_SCALE : 1, pipActive);

  // back-to-front by ground height, so overlapping chicks stack sensibly
  const ordered = [...tasks.values()].sort((a, b) => a.lastY - b.lastY);
  for (const task of ordered) task.update(dt, now, activeRoute);
  // who each chick could glance at, and where the summit is on this view
  const peakPt = activeRoute.pointAt(1, 0);
  for (const task of ordered) {
    task.peakAt = peakPt;
    let best = null;
    let bestD = 140;
    for (const other of ordered) {
      if (other === task || other.state === 'ascending') continue;
      const d = Math.hypot(other.lastX - task.lastX, other.lastY - task.lastY);
      if (d < bestD) {
        bestD = d;
        best = other;
      }
    }
    task.neighbor = best ? { x: best.lastX, y: best.lastY - 20 } : null;
  }
  while (summitShowers.length && summitShowers[0].at <= now) {
    const s = summitShowers.shift();
    if (!pipActive) {
      ambience.summitSparkle(peakPt.x, peakPt.y - 10, s.hue, now);
      moments.summitFlash(now);
    }
  }

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
        a.overtakeAt = now;
        break;
      }
    }
  }
  prevClimbed.clear();
  for (const task of racing) prevClimbed.set(task.id, task.climbed);

  for (const [a] of highFives.detect(racing, now)) {
    // the ✋ burst between them says it - no banner needed
    soundEngine.playJoin(a.orbHue);
  }

  let removedAny = false;
  for (const task of ordered) {
    const isLeader = showLeader && task.id === leaderId;
    if (pipActive) task.drawProgress(ctx, activeRoute, t, now, isLeader, storm);
    else task.draw(ctx, activeRoute, t, now, isLeader, storm);
    if (task.finished) removedAny = true;
  }
  moments.draw(ctx, now);
  const placedLabels = [];
  for (const task of ordered) task.drawLabel(ctx, placedLabels);
  highFives.draw(ctx, now);
  if (removedAny) {
    for (const [id, task] of tasks) {
      if (!task.finished) continue;
      // the spirit doesn't just vanish - it becomes a star in the sky
      if (!pipActive) ambience.addSpiritStar(task.lastX, task.chickHue, now);
      tasks.delete(id);
    }
  }
  // a task's state (and so the "active" count) can change without a network
  // message arriving - e.g. entering 'ascending' mid-animation - so the HUD
  // has to stay in sync with the render loop, not just with socket events
  updateHud();

  if (!pipActive) ambience.drawNear(ctx, t, dt, now, Math.max(breath, storm));
  scene.drawSnow(ctx, t, dt);

  requestAnimationFrame(draw);
}
draw();

const pipBtn = document.getElementById('pipBtn');
// phones and non-Chromium browsers can't pop the widget out at all - better
// no button than one that only ever says "not supported"
if (!('documentPictureInPicture' in window)) pipBtn.hidden = true;
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
  pipWindow.document.body.append(racePanel);
  pipWindow.document.body.append(announcer.el);
  pipWindow.document.body.append(meBar.el);
  pipWindow.document.body.append(soundBtn);
  pipWindow.document.body.append(canvas);
  pipBtn.style.display = 'none';
  pipActive = true;
  resize();
  // wind gusts and snowflakes are positioned relative to canvas size at the
  // last resize() call - without this they'd keep the main page's (much
  // larger) layout and drift off-screen in the small pip window
  scene.resize();
  pipWindow.addEventListener('resize', () => {
    resize();
    scene.resize();
  });

  pipWindow.addEventListener('pagehide', () => {
    document.body.append(hud);
    document.body.append(racePanel);
    document.body.append(announcer.el);
    document.body.append(meBar.el);
    document.body.append(soundBtn);
    document.body.append(canvas);
    pipBtn.style.display = '';
    pipActive = false;
    resizeAll();
  });
});
