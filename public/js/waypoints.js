import { hashRand } from './utils.js';

// the decorative "places" strung along the route: a camp, a forest, a bridge,
// a waterfall, a cave, a rocky ridge, a ruined temple. This is what turns
// "civcivin dağda yürüdüğü bir animasyon" into a lived-in place - each patch
// of the mountain looks like somewhere, not just a point on a slope.
export class Waypoints {
  constructor(canvas, route) {
    this.canvas = canvas;
    this.route = route;
    this.resize();
  }

  resize() {
    const byName = {};
    for (const { wp, pos } of this.route.anchors()) byName[wp.name] = pos;
    this.anchors = byName;

    const forest = byName.forest;
    this.trees = Array.from({ length: 6 }, (_, i) => {
      const jx = (hashRand(7000 + i) - 0.5) * 90;
      const jy = (hashRand(7100 + i) - 0.5) * 22;
      const scale = 0.7 + hashRand(7200 + i) * 0.6;
      return { x: forest.x + jx, y: forest.y + jy, scale, hue: 130 + hashRand(7300 + i) * 30, phase: hashRand(7400 + i) * Math.PI * 2 };
    });

    const ridge = byName.ridge;
    this.ridgeRocks = Array.from({ length: 5 }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const jx = side * (30 + hashRand(10000 + i) * 45);
      const jy = (hashRand(10100 + i) - 0.5) * 30;
      return { x: ridge.x + jx, y: ridge.y + jy, size: 10 + hashRand(10200 + i) * 12 };
    });

    const temple = byName.temple;
    this.columns = Array.from({ length: 3 }, (_, i) => {
      const jx = (i - 1) * 20 + (hashRand(11000 + i) - 0.5) * 6;
      const h = 22 + hashRand(11100 + i) * 10;
      const lean = (hashRand(11200 + i) - 0.5) * 0.15;
      return { x: temple.x + jx, y: temple.y, h, lean, broken: hashRand(11300 + i) > 0.5 };
    });

    this.embers = Array.from({ length: 9 }, () => ({
      x: 0,
      y: 0,
      life: Math.random(),
      speed: 8 + Math.random() * 10,
      sway: Math.random() * Math.PI * 2,
    }));
  }

  draw(ctx, t, dt) {
    this.drawWaterfall(ctx, t);
    this.drawCave(ctx, t);
    this.drawRidge(ctx, t);
    this.drawTemple(ctx, t);
    this.drawBridge(ctx, t);
    this.drawForest(ctx, t);
    this.drawCamp(ctx, t, dt);
  }

  drawForest(ctx, t) {
    for (const tr of this.trees) {
      const sway = Math.sin(t * 0.5 + tr.phase) * 0.03;
      ctx.save();
      ctx.translate(tr.x, tr.y);
      ctx.rotate(sway);
      ctx.scale(tr.scale, tr.scale);
      ctx.strokeStyle = 'rgba(40,30,20,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -10);
      ctx.stroke();
      ctx.fillStyle = `hsla(${tr.hue}, 30%, 18%, 0.85)`;
      for (let i = 0; i < 3; i++) {
        const w = 14 - i * 3.5;
        const y = -10 - i * 8;
        ctx.beginPath();
        ctx.moveTo(0, y - 12);
        ctx.lineTo(-w, y);
        ctx.lineTo(w, y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawBridge(ctx) {
    const b = this.anchors.bridge;
    const w = 46;
    ctx.strokeStyle = 'rgba(60,45,30,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - w / 2, b.y - 3);
    ctx.lineTo(b.x + w / 2, b.y - 3);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(b.x + i * (w / 3), b.y - 3);
      ctx.lineTo(b.x + i * (w / 3), b.y + 3);
      ctx.stroke();
    }
    // rope rails, sagging slightly
    ctx.strokeStyle = 'rgba(90,75,55,0.55)';
    ctx.lineWidth = 1;
    for (const dy of [-9, 9]) {
      ctx.beginPath();
      ctx.moveTo(b.x - w / 2, b.y + dy * 0.4);
      ctx.quadraticCurveTo(b.x, b.y + dy, b.x + w / 2, b.y + dy * 0.4);
      ctx.stroke();
    }
    // the gap the bridge crosses
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 4, w / 2 + 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWaterfall(ctx, t) {
    const wf = this.anchors.waterfall;
    const topY = wf.y - 60;
    const grad = ctx.createLinearGradient(0, topY, 0, wf.y);
    grad.addColorStop(0, 'rgba(210,225,245,0)');
    grad.addColorStop(0.15, 'rgba(210,225,245,0.5)');
    grad.addColorStop(1, 'rgba(210,225,245,0.75)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(wf.x - 7, topY);
    ctx.lineTo(wf.x + 7, topY);
    ctx.lineTo(wf.x + 10, wf.y);
    ctx.lineTo(wf.x - 10, wf.y);
    ctx.closePath();
    ctx.fill();
    // a couple of flowing streaks, drifting down and looping
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const phase = ((t * 0.6 + i / 3) % 1);
      const y = topY + (wf.y - topY) * phase;
      ctx.globalAlpha = Math.sin(phase * Math.PI);
      ctx.beginPath();
      ctx.moveTo(wf.x - 4 + i, y);
      ctx.lineTo(wf.x - 4 + i, y + 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // mist at the base
    ctx.fillStyle = 'rgba(220,230,250,0.25)';
    ctx.beginPath();
    ctx.ellipse(wf.x, wf.y + 5, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCave(ctx, t) {
    const c = this.anchors.cave;
    ctx.fillStyle = 'rgba(8,6,14,0.9)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 6, 13, 17, 0, Math.PI, 0);
    ctx.lineTo(c.x + 13, c.y + 2);
    ctx.lineTo(c.x - 13, c.y + 2);
    ctx.closePath();
    ctx.fill();
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.2);
    const glow = ctx.createRadialGradient(c.x, c.y - 4, 0, c.x, c.y - 4, 14 + pulse * 3);
    glow.addColorStop(0, `rgba(255,190,120,${0.3 + pulse * 0.15})`);
    glow.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y - 4, 14 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRidge(ctx) {
    for (const r of this.ridgeRocks) {
      ctx.fillStyle = 'rgba(20,16,34,0.7)';
      ctx.beginPath();
      ctx.moveTo(r.x, r.y - r.size);
      ctx.lineTo(r.x - r.size * 0.6, r.y + r.size * 0.4);
      ctx.lineTo(r.x + r.size * 0.6, r.y + r.size * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawTemple(ctx) {
    const temple = this.anchors.temple;
    ctx.fillStyle = 'rgba(180,175,200,0.35)';
    ctx.beginPath();
    ctx.ellipse(temple.x, temple.y + 3, 44, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const c of this.columns) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.lean);
      ctx.fillStyle = 'rgba(225,205,165,0.8)';
      const topH = c.broken ? c.h * 0.7 : c.h;
      ctx.fillRect(-4, -topH, 8, topH);
      if (c.broken) {
        ctx.beginPath();
        ctx.moveTo(-4, -topH);
        ctx.lineTo(0, -topH - 5);
        ctx.lineTo(4, -topH);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawCamp(ctx, t, dt) {
    const camp = this.anchors.camp;
    // grass patch
    ctx.fillStyle = 'rgba(45,60,40,0.6)';
    ctx.beginPath();
    ctx.ellipse(camp.x, camp.y + 2, 52, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // two simple tents flanking the fire
    for (const side of [-1, 1]) {
      const tx = camp.x + side * 28;
      ctx.fillStyle = 'rgba(120,70,55,0.55)';
      ctx.beginPath();
      ctx.moveTo(tx, camp.y - 16);
      ctx.lineTo(tx - 10, camp.y);
      ctx.lineTo(tx + 10, camp.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, camp.y - 16);
      ctx.lineTo(tx, camp.y);
      ctx.stroke();
    }

    // signpost
    ctx.strokeStyle = 'rgba(70,55,40,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(camp.x - 44, camp.y);
    ctx.lineTo(camp.x - 44, camp.y - 14);
    ctx.stroke();
    ctx.fillStyle = 'rgba(90,70,50,0.6)';
    ctx.fillRect(camp.x - 50, camp.y - 16, 12, 5);

    // campfire: flicker + rising embers - the single cheapest "alive" cue
    const flick = 0.7 + 0.3 * Math.sin(t * 9) * Math.sin(t * 3.3);
    const fireGlow = ctx.createRadialGradient(camp.x, camp.y - 4, 0, camp.x, camp.y - 4, 20 * flick);
    fireGlow.addColorStop(0, `rgba(255,170,90,${0.35 * flick})`);
    fireGlow.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = fireGlow;
    ctx.beginPath();
    ctx.arc(camp.x, camp.y - 4, 20 * flick, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `hsl(28, 95%, ${58 + flick * 10}%)`;
    ctx.beginPath();
    ctx.moveTo(camp.x, camp.y - 14 * flick);
    ctx.quadraticCurveTo(camp.x + 5, camp.y - 5, camp.x + 2, camp.y);
    ctx.quadraticCurveTo(camp.x, camp.y - 4, camp.x - 2, camp.y);
    ctx.quadraticCurveTo(camp.x - 5, camp.y - 5, camp.x, camp.y - 14 * flick);
    ctx.fill();
    ctx.fillStyle = 'rgba(50,35,25,0.7)';
    ctx.fillRect(camp.x - 7, camp.y, 14, 2);

    for (const e of this.embers) {
      e.life -= dt * (e.speed / 40);
      if (e.life <= 0) {
        e.life = 1;
        e.x = camp.x + (Math.random() - 0.5) * 6;
        e.y = camp.y - 4;
      }
      const ey = e.y - (1 - e.life) * 26;
      const ex = e.x + Math.sin(t * 2 + e.sway) * 4 * (1 - e.life);
      ctx.globalAlpha = e.life * 0.8;
      ctx.fillStyle = '#ffb35c';
      ctx.beginPath();
      ctx.arc(ex, ey, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
