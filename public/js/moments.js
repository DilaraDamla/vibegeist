import { hashRand } from './utils.js';

// one-off moments that make a climb feel like a journey rather than a
// progress bar: the waterfall throwing mist and a faint rainbow as a chick
// passes, bats startled out of the cave, leaves shaken loose in the forest,
// the temple's stones glowing, an item box popping open, a banana arcing
// through the air, the brief warm flash when an orb reaches the summit.
//
// Everything here is stateless per frame (particles derive from a seed and
// their age), so a moment costs nothing once it has finished.

const TAU = Math.PI * 2;
const DURATION = {
  waterfall: 2800,
  cave: 2200,
  forest: 2400,
  temple: 2000,
  bridge: 1500,
  ridge: 1400,
  box: 1100,
  banana: 450,
  peel: 1500,
  flash: 700,
};

function ease(f) {
  return 1 - (1 - f) * (1 - f);
}

export class Moments {
  constructor(canvas) {
    this.canvas = canvas;
    this.list = [];
  }

  // a chick just reached a landmark - anchors are the waypoint positions
  landmark(name, anchors, now) {
    const at = anchors[name];
    if (!at || !DURATION[name]) return;
    // one at a time per place, so a crowd passing doesn't stack them up
    if (this.list.some((m) => m.kind === name && now - m.at < DURATION[name] * 0.6)) return;
    this.list.push({ kind: name, at: now, x: at.x, y: at.y, seed: Math.floor(Math.random() * 1000) });
  }

  // an item box opened: the box itself bounces in drawItemBoxes, this is
  // the prize rising out of it
  boxOpen(pos, item, now) {
    this.list.push({ kind: 'box', at: now, x: pos.x, y: pos.y, item });
  }

  // the banana flies from the one who dropped it to the one it hits, then
  // lies under their feet while they spin
  banana(from, victim, now) {
    this.list.push({ kind: 'banana', at: now, x: from.lastX, y: from.lastY - 20, victim });
    this.list.push({ kind: 'peel', at: now + DURATION.banana, victim });
  }

  summitFlash(now) {
    this.list.push({ kind: 'flash', at: now });
  }

  draw(ctx, now) {
    this.list = this.list.filter((m) => now - m.at < DURATION[m.kind]);
    for (const m of this.list) {
      const age = now - m.at;
      if (age < 0) continue;
      const f = age / DURATION[m.kind];
      ctx.save();
      // draw handlers live under a _ prefix - banana() the adder and the
      // banana drawer would otherwise be the same method
      this[`_${m.kind}`](ctx, m, f, age);
      ctx.restore();
    }
  }

  _waterfall(ctx, m, f) {
    // a faint rainbow over the pool - in the evening light it's barely
    // there, which is exactly why it's nice to catch
    const a = Math.sin(f * Math.PI) * 0.22;
    const bands = ['255,90,90', '255,170,80', '255,235,120', '120,220,140', '110,170,255', '170,120,255'];
    ctx.lineWidth = 2;
    bands.forEach((rgb, i) => {
      ctx.strokeStyle = `rgba(${rgb},${a})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y + 4, 40 - i * 2.2, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    });
    // mist puffing up off the splash
    for (let i = 0; i < 16; i++) {
      const r1 = hashRand(m.seed + i);
      const r2 = hashRand(m.seed + i + 50);
      const x = m.x + (r1 - 0.5) * 44 * ease(f);
      const y = m.y - 2 - r2 * 26 * ease(f);
      ctx.globalAlpha = (1 - f) * 0.35;
      ctx.fillStyle = '#e8f2ff';
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + r2 * 2.2 + f * 2, 0, TAU);
      ctx.fill();
    }
  }

  _cave(ctx, m, f) {
    // the mouth flares, and three bats burst out and scatter
    const g = ctx.createRadialGradient(m.x, m.y - 8, 0, m.x, m.y - 8, 40);
    g.addColorStop(0, `rgba(255,190,110,${0.45 * (1 - f)})`);
    g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(m.x, m.y - 8, 40, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,24,0.85)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const dir = hashRand(m.seed + i) < 0.5 ? -1 : 1;
      const x = m.x + dir * ease(f) * (50 + i * 22);
      const y = m.y - 10 - ease(f) * (40 + i * 18) + Math.sin(f * 12 + i) * 5;
      const flap = Math.sin(f * 60 + i * 2) * 3;
      ctx.globalAlpha = 1 - f * f;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - flap);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 4, y - flap);
      ctx.stroke();
    }
  }

  _forest(ctx, m, f) {
    for (let i = 0; i < 7; i++) {
      const r1 = hashRand(m.seed + i);
      const r2 = hashRand(m.seed + i + 30);
      const x = m.x + (r1 - 0.5) * 70 + Math.sin(f * 6 + i) * 8 + f * 20;
      const y = m.y - 40 + r2 * 10 + f * 44;
      ctx.globalAlpha = Math.sin(f * Math.PI) * 0.85;
      ctx.fillStyle = r1 < 0.5 ? '#6f8a3c' : '#a8743a';
      ctx.beginPath();
      ctx.ellipse(x, y, 2.6, 1.2, f * 8 + i, 0, TAU);
      ctx.fill();
    }
  }

  _temple(ctx, m, f) {
    const a = Math.sin(f * Math.PI);
    const g = ctx.createRadialGradient(m.x, m.y - 16, 0, m.x, m.y - 16, 46);
    g.addColorStop(0, `rgba(210,180,255,${0.4 * a})`);
    g.addColorStop(1, 'rgba(210,180,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(m.x, m.y - 16, 46, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const r = hashRand(m.seed + i);
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = '#efe2ff';
      ctx.fillRect(m.x + (r - 0.5) * 60, m.y - 8 - f * (24 + r * 20), 1.6, 1.6);
    }
  }

  _bridge(ctx, m, f) {
    // a few splinters of dust trickling off the planks
    for (let i = 0; i < 6; i++) {
      const r = hashRand(m.seed + i);
      ctx.globalAlpha = (1 - f) * 0.6;
      ctx.fillStyle = '#cfae86';
      ctx.fillRect(m.x + (r - 0.5) * 40, m.y + 4 + f * f * 40 + r * 6, 1.4, 1.4);
    }
  }

  _ridge(ctx, m, f) {
    // a pebble knocked loose, bouncing down the scree
    const x = m.x + f * 36;
    const y = m.y + f * f * 30 - Math.abs(Math.sin(f * 9)) * 6 * (1 - f);
    ctx.globalAlpha = 1 - f;
    ctx.fillStyle = '#4a4060';
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, TAU);
    ctx.fill();
  }

  _box(ctx, m, f) {
    // the prize rises out of the box, hangs a beat, and fades
    const rise = ease(Math.min(1, f * 2.2)) * 26;
    const a = f < 0.7 ? 1 : (1 - f) / 0.3;
    const x = m.x;
    const y = m.y - 12 - rise;
    // a ring of light where the box burst
    if (f < 0.4) {
      ctx.globalAlpha = 1 - f / 0.4;
      ctx.strokeStyle = '#ffe9a0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 8 + f * 60, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = a;
    if (m.item === 'mushroom') drawMushroom(ctx, x, y, 1);
    else drawBanana(ctx, x, y, 1, 0);
  }

  _banana(ctx, m, f) {
    const v = m.victim;
    const tx = v.lastX;
    const ty = v.lastY - 14;
    const x = m.x + (tx - m.x) * f;
    const y = m.y + (ty - m.y) * f - Math.sin(f * Math.PI) * 50;
    drawBanana(ctx, x, y, 0.8, f * 10);
  }

  _peel(ctx, m, f) {
    const v = m.victim;
    ctx.globalAlpha = f < 0.75 ? 1 : (1 - f) / 0.25;
    drawBanana(ctx, v.lastX + 10, v.lastY - 2, 0.7, 0.4, true);
  }

  _flash(ctx, m, f) {
    ctx.globalAlpha = (1 - f) * 0.09;
    ctx.fillStyle = '#ffd6a8';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

// small hand-drawn props rather than emoji, so they sit in the same
// illustrated style as everything else on the mountain
export function drawMushroom(ctx, x, y, s) {
  ctx.fillStyle = '#f3e6cf';
  ctx.fillRect(x - 3 * s, y, 6 * s, 7 * s);
  ctx.fillStyle = '#e0453e';
  ctx.beginPath();
  ctx.ellipse(x, y, 9 * s, 7 * s, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  for (const [dx, dy, r] of [[-4, -3, 1.8], [2, -5, 1.5], [5, -1.5, 1.3]]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
    ctx.fill();
  }
}

export function drawBanana(ctx, x, y, s, rot, peeled = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#f5cf3a';
  ctx.strokeStyle = '#8a6a14';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  if (peeled) {
    // three flopped-open strips
    for (const a of [-0.9, 0, 0.9]) {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.sin(a) * 6 * s, -2 * s, Math.sin(a) * 9 * s, 3 * s);
    }
    ctx.stroke();
  } else {
    ctx.moveTo(-8 * s, -2 * s);
    ctx.quadraticCurveTo(0, 8 * s, 8 * s, -2 * s);
    ctx.quadraticCurveTo(0, 3 * s, -8 * s, -2 * s);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
