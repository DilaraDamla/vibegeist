import { hashRand } from './utils.js';

// the slow life around the mountain, in the permanent crimson evening: clouds
// drifting across the afterglow, dust hanging in the warm air, fireflies
// around the forest and camp, and a handful of rare moments nobody announces -
// a flock crossing the sky, a shooting star, a sky lantern rising from the far
// hills, a pair of eyes blinking in the forest.
//
// Stillness is part of the design: the wind "breathes" on a slow cycle, so
// there are stretches where almost nothing moves and the scene just glows.

const TAU = Math.PI * 2;

function smoothstep(a, b, x) {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

function between(min, max) {
  return min + Math.random() * (max - min);
}

// a soft round glow rendered once and stamped with drawImage - a radial
// gradient per firefly per frame adds up fast
function glowSprite(rgb, radius) {
  const c = document.createElement('canvas');
  c.width = c.height = radius * 2;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.25, `rgba(${rgb},0.55)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, radius * 2, radius * 2);
  return c;
}

// a thin evening stratus: a few long, flat, blurred streaks, dark violet on
// top and lit warm along the underside by the sun that's already set - thin
// and soft on purpose, puffy lobes read as cartoon clouds
function cloudSprite(seed, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.filter = `blur(${Math.max(3, h * 0.14)}px)`;
  const lobes = 7 + Math.floor(hashRand(seed) * 5);
  for (let i = 0; i < lobes; i++) {
    const lx = w * (0.12 + 0.76 * (i / (lobes - 1))) + (hashRand(seed + i * 3) - 0.5) * w * 0.08;
    const ly = h * (0.58 - Math.sin((i / (lobes - 1)) * Math.PI) * 0.18) + (hashRand(seed + i * 5) - 0.5) * h * 0.1;
    const rx = w * (0.14 + hashRand(seed + i * 7) * 0.1);
    const ry = h * (0.12 + hashRand(seed + i * 11) * 0.08);
    const grad = g.createLinearGradient(0, ly - ry, 0, ly + ry);
    grad.addColorStop(0, 'rgba(70,36,80,0.0)');
    grad.addColorStop(0.5, 'rgba(110,50,84,0.35)');
    grad.addColorStop(1, 'rgba(226,116,84,0.4)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(lx, ly, rx, ry, 0, 0, TAU);
    g.fill();
  }
  return c;
}

export class Ambience {
  constructor(canvas) {
    this.canvas = canvas;
    this.fireflyGlow = glowSprite('255,214,120', 10);
    this.lanternGlow = glowSprite('255,170,90', 26);
    this.eyeGlow = glowSprite('255,226,150', 5);
    this.birds = [];
    this.spiritStars = []; // one per spirit that rose this visit
    this.sparkles = []; // falling over the summit after someone reaches it
    this.shootingStar = null;
    this.lantern = null;
    this.eyes = null;
    const now = Date.now();
    // first sightings come a little sooner than the steady-state gaps, so a
    // fresh visitor has a chance to notice the sky isn't a painting
    this.nextBirds = now + between(20000, 45000);
    this.nextShootingStar = now + between(60000, 150000);
    this.nextLantern = now + between(240000, 420000);
    this.nextEyes = now + between(90000, 180000);
    this.resize();
  }

  // where the fireflies gather - the forest and the camp, from the route
  setAnchors(anchors) {
    this.anchors = anchors;
    this.fireflies = [];
    const homes = [
      { at: anchors.forest, n: 6, spread: 60 },
      { at: anchors.camp, n: 4, spread: 50 },
    ];
    let k = 0;
    for (const home of homes) {
      if (!home.at) continue;
      for (let i = 0; i < home.n; i++, k++) {
        this.fireflies.push({
          hx: home.at.x + (hashRand(8100 + k) - 0.5) * home.spread * 2,
          hy: home.at.y - 10 - hashRand(8200 + k) * 30,
          phase: hashRand(8300 + k) * TAU,
          speed: 0.3 + hashRand(8400 + k) * 0.4,
          blink: 0.5 + hashRand(8500 + k) * 0.9,
        });
      }
    }
  }

  resize() {
    const { width: w, height: h } = this.canvas;
    this.clouds = Array.from({ length: 4 }, (_, i) => {
      const cw = Math.round(w * (0.28 + hashRand(8600 + i) * 0.2));
      const ch = Math.round(cw * 0.16);
      return {
        sprite: cloudSprite(8700 + i * 31, cw, ch),
        x: hashRand(8800 + i) * w,
        y: h * (0.12 + i * 0.09 + hashRand(8900 + i) * 0.05),
        speed: 3 + hashRand(9000 + i) * 4,
        alpha: 0.45 + hashRand(9100 + i) * 0.3,
      };
    });
    this.dust = Array.from({ length: 22 }, (_, i) => ({
      x: hashRand(9200 + i) * w,
      y: h * (0.3 + hashRand(9300 + i) * 0.65),
      r: 0.6 + hashRand(9400 + i) * 0.9,
      phase: hashRand(9500 + i) * TAU,
    }));
  }

  // 0..1 - how much the air is moving right now. Two slow, incommensurate
  // waves, so calm and breezy stretches of a minute or two come and go
  // without ever settling into an obvious rhythm
  breath(t) {
    const n = 0.5 + 0.3 * Math.sin(t * 0.047) + 0.2 * Math.sin(t * 0.121 + 1.7);
    return smoothstep(0.28, 0.82, n);
  }

  update(now) {
    const { width: w, height: h } = this.canvas;
    if (now > this.nextBirds) {
      this.nextBirds = now + between(80000, 170000);
      const fromLeft = Math.random() < 0.5;
      const count = 3 + Math.floor(Math.random() * 3);
      const y = h * between(0.14, 0.32);
      const speed = between(34, 48);
      for (let i = 0; i < count; i++) {
        // a loose V: each bird trails the leader back and to one side
        const rank = Math.ceil(i / 2);
        const side = i % 2 ? 1 : -1;
        this.birds.push({
          x: fromLeft ? -30 - rank * 16 : w + 30 + rank * 16,
          y: y + side * rank * 7 + (Math.random() - 0.5) * 4,
          vx: (fromLeft ? 1 : -1) * speed * between(0.95, 1.05),
          size: between(3.5, 5.5),
          phase: Math.random() * TAU,
        });
      }
    }
    if (now > this.nextShootingStar) {
      this.nextShootingStar = now + between(150000, 330000);
      this.shootingStar = { x: w * between(0.1, 0.6), y: h * between(0.04, 0.2), at: now, dir: Math.random() < 0.5 ? 1 : -1 };
    }
    if (now > this.nextLantern) {
      this.nextLantern = now + between(420000, 780000);
      // from the far hills either side - never behind the mountain itself
      const x = Math.random() < 0.5 ? between(0.05, 0.22) : between(0.78, 0.95);
      this.lantern = { x: w * x, y0: h * 0.8, at: now, phase: Math.random() * TAU };
    }
    if (now > this.nextEyes && this.anchors?.forest) {
      this.nextEyes = now + between(120000, 260000);
      const f = this.anchors.forest;
      this.eyes = { x: f.x + between(-35, 35), y: f.y - between(14, 26), at: now };
    }
  }

  // a spirit that rose away settles into the sky as a new star - flares
  // when it arrives, then twinkles softly for the rest of the visit (old
  // ones fade slowly, so the sky never fills up)
  addSpiritStar(x, hue, now) {
    const { width: w, height: h } = this.canvas;
    let sx = x + (Math.random() - 0.5) * 80;
    // keep clear of the peak's own glow, where a new star would just vanish
    if (Math.abs(sx - w / 2) < w * 0.09) sx += (sx < w / 2 ? -1 : 1) * w * 0.1;
    this.spiritStars.push({ x: sx, y: h * between(0.04, 0.26), hue, at: now, phase: Math.random() * TAU });
    if (this.spiritStars.length > 40) this.spiritStars.shift();
  }

  // a soft shower of light drifting down off the peak
  summitSparkle(x, y, hue, now) {
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = between(30, 70);
      this.sparkles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, hue, at: now, life: between(1600, 2600) });
    }
  }

  // behind the far ranges: clouds, the shooting star, the lantern
  drawSky(ctx, t, dt, now, breath) {
    const w = this.canvas.width;
    for (const s of this.spiritStars) {
      const age = (now - s.at) / 1000;
      if (age < 0) continue;
      const arrive = Math.min(1, age / 1.2);
      const flare = age < 2.5 ? Math.max(0, 1 - age / 2.5) : 0;
      const fade = Math.max(0.25, 1 - Math.max(0, age - 600) / 900);
      const tw = 0.6 + 0.4 * Math.sin(t * 1.3 + s.phase);
      ctx.globalAlpha = arrive * fade * tw;
      ctx.fillStyle = `hsl(${s.hue}, 70%, 88%)`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.5 + flare * 2, 0, TAU);
      ctx.fill();
      if (flare > 0) {
        ctx.globalAlpha = flare * 0.8;
        ctx.drawImage(this.fireflyGlow, s.x - 10, s.y - 10);
      }
    }
    ctx.globalAlpha = 1;
    for (const c of this.clouds) {
      c.x += c.speed * (0.5 + breath) * dt;
      if (c.x > w + 20) c.x = -c.sprite.width - 20;
      ctx.globalAlpha = c.alpha;
      ctx.drawImage(c.sprite, c.x, c.y);
    }
    ctx.globalAlpha = 1;

    const s = this.shootingStar;
    if (s) {
      const frac = (now - s.at) / 900;
      if (frac > 1) this.shootingStar = null;
      else {
        const len = 90;
        const hx = s.x + s.dir * frac * 260;
        const hy = s.y + frac * 110;
        const tx = hx - s.dir * len * 0.92;
        const ty = hy - len * 0.39;
        const grad = ctx.createLinearGradient(hx, hy, tx, ty);
        const a = Math.sin(frac * Math.PI);
        grad.addColorStop(0, `rgba(255,240,220,${0.9 * a})`);
        grad.addColorStop(1, 'rgba(255,200,170,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }

    const l = this.lantern;
    if (l) {
      const age = (now - l.at) / 1000;
      const life = 110;
      if (age > life) this.lantern = null;
      else {
        const y = l.y0 - age * 5.5;
        const x = l.x + Math.sin(age * 0.35 + l.phase) * 14;
        const fade = Math.min(1, age / 6) * Math.min(1, (life - age) / 20);
        const flicker = 0.85 + 0.15 * Math.sin(t * 7 + l.phase);
        ctx.globalAlpha = 0.55 * fade * flicker;
        ctx.drawImage(this.lanternGlow, x - 26, y - 26);
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#ffcf8a';
        ctx.fillRect(x - 1.8, y - 2.6, 3.6, 5.2);
        ctx.globalAlpha = 1;
      }
    }
  }

  // in front of the far ranges, behind the mountain - small enough that
  // they read as distant, dark against the afterglow
  drawBirds(ctx, t, dt) {
    const w = this.canvas.width;
    ctx.strokeStyle = 'rgba(24,12,30,0.75)';
    ctx.lineCap = 'round';
    for (const b of this.birds) {
      b.x += b.vx * dt;
      b.y += Math.sin(t * 0.8 + b.phase) * 3 * dt;
      const flap = Math.sin(t * 9 + b.phase);
      const s = b.size;
      ctx.lineWidth = Math.max(1, s * 0.3);
      ctx.beginPath();
      ctx.moveTo(b.x - s, b.y - flap * s * 0.6);
      ctx.quadraticCurveTo(b.x - s * 0.4, b.y - s * 0.2, b.x, b.y);
      ctx.quadraticCurveTo(b.x + s * 0.4, b.y - s * 0.2, b.x + s, b.y - flap * s * 0.6);
      ctx.stroke();
    }
    this.birds = this.birds.filter((b) => b.x > -120 && b.x < w + 120);
  }

  // in front of everything but the snow: fireflies, drifting dust, and the
  // forest's occasional pair of eyes
  drawNear(ctx, t, dt, now, breath) {
    // fireflies come out when the air is still and hide when it's breezy
    const calm = 1 - breath * 0.7;
    for (const f of this.fireflies || []) {
      const x = f.hx + Math.sin(t * f.speed + f.phase) * 18 + Math.sin(t * f.speed * 2.3 + f.phase) * 6;
      const y = f.hy + Math.cos(t * f.speed * 0.8 + f.phase) * 10;
      const pulse = Math.max(0, Math.sin(t * f.blink + f.phase));
      const a = pulse * pulse * pulse * calm;
      if (a < 0.02) continue;
      ctx.globalAlpha = a * 0.8;
      ctx.drawImage(this.fireflyGlow, x - 10, y - 10);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff2c4';
      ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    }

    this.sparkles = this.sparkles.filter((p) => now - p.at < p.life);
    for (const p of this.sparkles) {
      const f = (now - p.at) / p.life;
      p.vy += 40 * dt; // settles back down under its own weight
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 0.8;
      ctx.globalAlpha = (1 - f) * (0.6 + 0.4 * Math.sin(t * 20 + p.x));
      ctx.fillStyle = `hsl(${p.hue}, 80%, 85%)`;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }

    const { width: w, height: h } = this.canvas;
    ctx.fillStyle = '#ffd9b8';
    for (const d of this.dust) {
      d.x += (3 + breath * 14) * dt;
      d.y += Math.sin(t * 0.3 + d.phase) * 2 * dt - 1.5 * dt;
      if (d.x > w + 4) d.x = -4;
      if (d.y < h * 0.25) d.y = h * 0.95;
      ctx.globalAlpha = 0.12 + 0.12 * Math.sin(t * 0.7 + d.phase);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
    }

    const e = this.eyes;
    if (e) {
      const age = now - e.at;
      if (age > 4200) this.eyes = null;
      else {
        // two blinks, then gone
        const blinking = (age > 1300 && age < 1450) || (age > 2800 && age < 2950);
        const a = Math.min(1, age / 500) * Math.min(1, (4200 - age) / 600);
        if (!blinking) {
          ctx.globalAlpha = a;
          for (const dx of [-2.6, 2.6]) {
            ctx.drawImage(this.eyeGlow, e.x + dx - 5, e.y - 5);
            ctx.fillStyle = '#fff4c8';
            ctx.fillRect(e.x + dx - 0.7, e.y - 0.7, 1.4, 1.4);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
