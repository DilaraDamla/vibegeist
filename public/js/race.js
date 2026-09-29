import { pickLook } from './look.js';

// everything that makes the race legible without squinting at tiny chicks:
// a live standings panel, one-line announcements, the summit flag, and the
// high-five two climbers share when they draw level.

function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function displayName(task) {
  return task.name || 'isimsiz';
}

// Mario Kart-style standings: rank, color dot, name, a progress bar and what
// the chick is doing right now - both players' progress at a glance
export function renderRacePanel(el, tasks, now, scores, room) {
  const rows = [...tasks.values()].sort((a, b) => b.percent - a.percent);
  let html = `<div class="race-head">🏁 yarış${room ? ` <span class="room">oda: ${esc(room)}</span>` : ''}</div>`;
  if (!rows.length) {
    html += '<div class="race-empty">şu an kimse tırmanmıyor - Claude\'a bir şey yaz, civcivin yola çıksın</div>';
  }
  rows.forEach((task, i) => {
    const done = task.state === 'placing' || task.state === 'ascending';
    html += `<div class="race-row${done ? ' done' : ''}">
      <span class="rank">${i + 1}.</span>
      <span class="dot" style="background:${task.look.body}"></span>
      <span class="who">${esc(displayName(task))}</span>
      <span class="bar"><i style="width:${task.percent}%;background:${task.look.body}"></i></span>
      <span class="pct">${task.percent}%</span>
      <span class="what">${task.status(now)}</span>
    </div>`;
  });
  const board = Object.entries(scores || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (board.length) {
    const medals = ['🥇', '🥈', '🥉'];
    html += `<div class="race-scores">bugün zirve: ${board
      .map(([name, n], i) => `${medals[i] || ''}${esc(name)} <b>${n}</b>`)
      .join(' · ')}</div>`;
  }
  // only touch the DOM when something visible changed - this runs every frame
  if (el.dataset.html !== html) {
    el.dataset.html = html;
    el.innerHTML = html;
  }
}

// one announcement at a time, newest wins - Fall Guys-style "X qualified!"
// so a finish or a drop-out never goes unnoticed
export class Announcer {
  constructor(el) {
    this.el = el;
    this.timer = 0;
  }

  say(text) {
    this.el.textContent = text;
    this.el.classList.add('show');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.remove('show'), 4000);
  }
}

// the last player to summit keeps their name flying on the peak until
// someone else gets there - main view only, the widget never shows the peak
export function drawSummitFlag(ctx, route, flag, t) {
  if (!flag) return;
  const peak = route.pointAt(1, 0);
  const color = pickLook(flag.id).body;
  const poleH = 46;
  const x = peak.x + 6;
  const base = peak.y + 2;
  const top = base - poleH;

  ctx.save();
  ctx.strokeStyle = '#d9d2c4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.lineTo(x, top);
  ctx.stroke();

  ctx.font = '600 11px system-ui, sans-serif';
  const w = Math.max(34, ctx.measureText(flag.name).width + 16);
  const h = 18;
  // a waving cloth: the free edge ripples, the pole edge stays put
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, top);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const fx = x + (w * i) / steps;
    ctx.lineTo(fx, top + Math.sin(t * 4 - i * 0.7) * 2.2 * (i / steps));
  }
  for (let i = steps; i >= 0; i--) {
    const fx = x + (w * i) / steps;
    ctx.lineTo(fx, top + h + Math.sin(t * 4 - i * 0.7) * 2.2 * (i / steps));
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#20140a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(flag.name, x + w / 2, top + h / 2 + Math.sin(t * 4 - 3.5) * 1.1);
  ctx.restore();
}

// two climbers drawing level mid-climb share a high-five - once per pair
// per cooldown, and not at camp where everyone starts level anyway
const MEET_GAP = 0.012;
const MEET_COOLDOWN_MS = 45000;
const FIVE_MS = 1400;

export class HighFives {
  constructor() {
    this.lastAt = new Map(); // "idA|idB" -> ms
    this.active = [];
  }

  // returns the pairs that just met this frame
  detect(racing, now) {
    const met = [];
    const climbing = racing.filter((task) => task.state === 'climbing' && task.climbed > 0.05);
    for (let i = 0; i < climbing.length; i++) {
      for (let j = i + 1; j < climbing.length; j++) {
        const a = climbing[i];
        const b = climbing[j];
        if (Math.abs(a.climbed - b.climbed) > MEET_GAP) continue;
        const key = [a.id, b.id].sort().join('|');
        if (now - (this.lastAt.get(key) || 0) < MEET_COOLDOWN_MS) continue;
        this.lastAt.set(key, now);
        this.active.push({ a, b, at: now });
        met.push([a, b]);
      }
    }
    return met;
  }

  // drawn after the chicks, between the two heads
  draw(ctx, now) {
    this.active = this.active.filter((f) => now - f.at < FIVE_MS && f.a.labelAt && f.b.labelAt);
    for (const f of this.active) {
      const frac = (now - f.at) / FIVE_MS;
      const x = (f.a.labelAt.x + f.b.labelAt.x) / 2;
      const y = Math.min(f.a.labelAt.y, f.b.labelAt.y) - 26 - frac * 14;
      ctx.save();
      ctx.globalAlpha = 1 - frac * frac;
      // a little starburst behind the text
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const r0 = 8 + frac * 10;
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0);
        ctx.lineTo(x + Math.cos(ang) * (r0 + 6), y + Math.sin(ang) * (r0 + 6));
        ctx.stroke();
      }
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('✋ çak!', x, y);
      ctx.restore();
    }
  }
}
