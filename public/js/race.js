import { pickLook } from './look.js';
import { EMOTE_ICONS, stepsToProgress } from './task.js';
import { BOX_STEPS } from './game.js';

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
// meId: the chick this viewer said is theirs (click a row to pick it)
export function renderRacePanel(el, tasks, now, scores, room, meId, streaks = {}) {
  const rows = [...tasks.values()].sort((a, b) => b.percent - a.percent);
  let html = `<div class="race-head">🏁 yarış${room ? ` <span class="room">oda: ${esc(room)}</span>` : ''}</div>`;
  if (!rows.length) {
    html += '<div class="race-empty">şu an kimse tırmanmıyor - Claude\'a bir şey yaz, civcivin yola çıksın</div>';
  }
  rows.forEach((task, i) => {
    const done = task.state === 'placing' || task.state === 'ascending';
    const mine = task.id === meId;
    const badges = `${task.champion ? '👑' : ''}${task.streak > 1 ? `🔥${task.streak}` : ''}`;
    html += `<div class="race-row${done ? ' done' : ''}${mine ? ' mine' : ''}" data-id="${esc(task.id)}" title="${mine ? 'bu sensin' : 'bu benim civcivim de'}">
      <span class="rank">${i + 1}.</span>
      <span class="dot" style="background:${task.look.body}"></span>
      <span class="who">${esc(displayName(task))}${mine ? ' <em>(sen)</em>' : ''}${badges ? ` <span class="badges">${badges}</span>` : ''}</span>
      <span class="bar"><i style="width:${task.percent}%;background:${task.look.body}"></i></span>
      <span class="pct">${task.percent}%</span>
      <span class="what">${task.status(now)}</span>
    </div>`;
  });
  const board = Object.entries(scores || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (board.length) {
    const medals = ['🥇', '🥈', '🥉'];
    html += `<div class="race-scores">bugün zirve: ${board
      .map(([name, n], i) => `${medals[i] || ''}${esc(name)} <b>${n}</b>${streaks[name] > 1 ? ` 🔥${streaks[name]}` : ''}`)
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

// the item boxes' fixed spots on the climb (Mario Kart "?" blocks) - drawn on
// whichever route is active, bobbing a little above the path
export function drawItemBoxes(ctx, route, t, scale = 1) {
  const size = 13 * scale;
  for (let i = 0; i < BOX_STEPS.length; i++) {
    const p = stepsToProgress(BOX_STEPS[i]);
    const ground = route.pointAt(p, 0);
    const x = ground.x;
    const y = ground.y - 30 * scale + Math.sin(t * 2.2 + i) * 3 * scale;
    ctx.save();
    ctx.shadowColor = 'rgba(255,200,60,0.7)';
    ctx.shadowBlur = 10 * scale;
    ctx.fillStyle = '#f2b52c';
    ctx.strokeStyle = '#8a5a10';
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.beginPath();
    ctx.roundRect(x - size / 2, y - size / 2, size, size, 2.5 * scale);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(size * 0.8)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y + 0.5);
    ctx.restore();
  }
}

// the viewer's own controls, under the standings: emote buttons for their
// chick, and a name box if its hook didn't send a name. Rebuilt only when
// its shape changes, so typing in the name box never loses focus.
export class MeBar {
  constructor(el, onEmote, onName) {
    this.el = el;
    this.key = '';
    el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-emote]');
      if (btn) onEmote(btn.dataset.emote);
    });
    el.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const input = el.querySelector('input');
      if (input.value.trim()) onName(input.value.trim());
    });
  }

  render(me, anyone) {
    const key = me ? `${me.id}|${me.name || ''}` : anyone ? 'pick' : 'none';
    if (key === this.key) return;
    this.key = key;
    if (!me) {
      this.el.innerHTML = anyone ? '<span class="hint">senin civcivin hangisi? yukarıda kendi satırına tıkla</span>' : '';
      return;
    }
    const buttons = Object.entries(EMOTE_ICONS)
      .map(([kind, icon], i) => `<button type="button" data-emote="${kind}" title="${i + 1} tuşu">${icon}</button>`)
      .join('');
    const nameBox = me.name
      ? ''
      : '<form><input maxlength="12" placeholder="ismini yaz" aria-label="civcivinin ismi" /><button type="submit">kaydet</button></form>';
    this.el.innerHTML = `<span class="hint">sen:</span>${buttons}${nameBox}`;
  }
}
