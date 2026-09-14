import { hashRand } from './utils.js';

// the decorative "places" strung along the route: a camp, a forest, a bridge,
// a waterfall, a cave, a rocky ridge, a ruined temple. This is what turns
// "civcivin dağda yürüdüğü bir animasyon" into a lived-in place - each patch
// of the mountain looks like somewhere, not just a point on a slope.
//
// Rendering rule used everywhere below: every silhouette gets a thin dark ink
// outline after its fill, and every fill is a gradient rather than a flat
// tone - together those two habits are what separate "illustrated sticker"
// from "raw geometric primitive," which is the gap that made the first pass
// read as amateur despite the right composition.
const INK = 'rgba(20,14,28,0.55)';

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
    this.trees = Array.from({ length: 7 }, (_, i) => {
      const jx = (hashRand(7000 + i) - 0.5) * 100;
      const jy = (hashRand(7100 + i) - 0.5) * 20;
      const scale = 0.8 + hashRand(7200 + i) * 0.7;
      return {
        x: forest.x + jx,
        y: forest.y + jy,
        scale,
        hue: 120 + hashRand(7300 + i) * 35,
        phase: hashRand(7400 + i) * Math.PI * 2,
        lobes: 3 + Math.floor(hashRand(7500 + i) * 2),
      };
    });

    const ridge = byName.ridge;
    this.ridgeRocks = Array.from({ length: 5 }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const jx = side * (28 + hashRand(10000 + i) * 48);
      const jy = (hashRand(10100 + i) - 0.5) * 28;
      const size = 12 + hashRand(10200 + i) * 14;
      const points = Array.from({ length: 5 }, (_, k) => ({
        a: (k / 5) * Math.PI * 2 + hashRand(10300 + i * 5 + k) * 0.4,
        r: 0.6 + hashRand(10400 + i * 5 + k) * 0.5,
      }));
      return { x: ridge.x + jx, y: ridge.y + jy, size, points };
    });

    const temple = byName.temple;
    this.columns = Array.from({ length: 3 }, (_, i) => {
      const jx = (i - 1) * 22 + (hashRand(11000 + i) - 0.5) * 6;
      const h = 26 + hashRand(11100 + i) * 12;
      const lean = (hashRand(11200 + i) - 0.5) * 0.15;
      return {
        x: temple.x + jx,
        y: temple.y,
        h,
        lean,
        broken: hashRand(11300 + i) > 0.5,
        vine: hashRand(11400 + i) > 0.55,
        weather: hashRand(11500 + i),
      };
    });

    this.embers = Array.from({ length: 10 }, () => ({
      x: 0,
      y: 0,
      life: Math.random(),
      speed: 8 + Math.random() * 10,
      sway: Math.random() * Math.PI * 2,
    }));

    this.grassTufts = Array.from({ length: 14 }, (_, i) => ({
      dx: (hashRand(12000 + i) - 0.5) * 100,
      dy: (hashRand(12100 + i) - 0.5) * 10 + 3,
      h: 4 + hashRand(12200 + i) * 5,
      lean: (hashRand(12300 + i) - 0.5) * 0.6,
    }));
  }

  draw(ctx, t, dt) {
    this.drawWaterfall(ctx, t);
    this.drawCave(ctx, t);
    this.drawRidge(ctx);
    this.drawTemple(ctx);
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

      // trunk, tapered with a bark-gradient
      const trunkGrad = ctx.createLinearGradient(-2.5, 0, 2.5, 0);
      trunkGrad.addColorStop(0, '#241a12');
      trunkGrad.addColorStop(0.5, '#4a3420');
      trunkGrad.addColorStop(1, '#2a1e14');
      ctx.fillStyle = trunkGrad;
      ctx.beginPath();
      ctx.moveTo(-2.6, 0);
      ctx.lineTo(-1.4, -13);
      ctx.lineTo(1.4, -13);
      ctx.lineTo(2.6, 0);
      ctx.closePath();
      ctx.fill();

      // foliage: overlapping organic lobes, dark-to-light gradient, inked edge
      for (let i = tr.lobes - 1; i >= 0; i--) {
        const w = 16 - i * 3.2;
        const cy = -12 - i * 8.5;
        const foliageGrad = ctx.createRadialGradient(-w * 0.25, cy - w * 0.3, w * 0.15, 0, cy, w * 1.15);
        foliageGrad.addColorStop(0, `hsla(${tr.hue + 15}, 45%, 34%, 0.95)`);
        foliageGrad.addColorStop(0.6, `hsla(${tr.hue}, 40%, 22%, 0.95)`);
        foliageGrad.addColorStop(1, `hsla(${tr.hue - 8}, 40%, 13%, 0.95)`);
        ctx.fillStyle = foliageGrad;
        ctx.beginPath();
        ctx.moveTo(0, cy - w * 0.95);
        ctx.quadraticCurveTo(w * 1.05, cy - w * 0.1, w * 0.55, cy + w * 0.35);
        ctx.quadraticCurveTo(0, cy + w * 0.55, -w * 0.55, cy + w * 0.35);
        ctx.quadraticCurveTo(-w * 1.05, cy - w * 0.1, 0, cy - w * 0.95);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();

      // contact shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(tr.x, tr.y + 1, 10 * tr.scale, 2.5 * tr.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBridge(ctx, t) {
    const b = this.anchors.bridge;
    const w = 50;

    // the gap/ravine it crosses, with a soft inner shadow
    const gapGrad = ctx.createRadialGradient(b.x, b.y + 4, 2, b.x, b.y + 4, w / 2 + 10);
    gapGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
    gapGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gapGrad;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 4, w / 2 + 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // support posts
    ctx.fillStyle = '#3a2a1c';
    for (const side of [-1, 1]) {
      ctx.fillRect(b.x + side * (w / 2 + 2) - 1.5, b.y - 10, 3, 14);
    }

    // rope rails, sagging, twisted texture
    ctx.strokeStyle = '#8a7050';
    ctx.lineWidth = 1.1;
    for (const dy of [-10, 10]) {
      ctx.beginPath();
      ctx.moveTo(b.x - w / 2, b.y + dy * 0.35 - 8);
      ctx.quadraticCurveTo(b.x, b.y + dy - 8, b.x + w / 2, b.y + dy * 0.35 - 8);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let i = -w / 2; i <= w / 2; i += 6) {
        const f = (i + w / 2) / w;
        const ry = b.y + dy - 8 + Math.sin(f * Math.PI) * dy * -0.35;
        ctx.beginPath();
        ctx.moveTo(b.x + i, ry - 2);
        ctx.lineTo(b.x + i, ry + 2);
        ctx.stroke();
      }
      ctx.strokeStyle = '#8a7050';
    }

    // planks, individually shaded with gaps
    const plankCount = 9;
    for (let i = 0; i < plankCount; i++) {
      const f = i / (plankCount - 1);
      const px = b.x - w / 2 + f * w;
      const shade = 40 + hashRand(9000 + i) * 20;
      ctx.fillStyle = `hsl(28, 35%, ${shade}%)`;
      ctx.fillRect(px - 2.4, b.y - 3, 4.2, 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(px - 2.4, b.y - 3, 4.2, 6);
    }

    // a small lantern hung from one post for warmth
    const flick = 0.7 + 0.3 * Math.sin(t * 6);
    const lx = b.x - w / 2 - 2;
    const ly = b.y - 4;
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 8 * flick);
    lg.addColorStop(0, `rgba(255,195,110,${0.5 * flick})`);
    lg.addColorStop(1, 'rgba(255,195,110,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(lx, ly, 8 * flick, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(lx - 1.2, ly - 2, 2.4, 3.2);
  }

  drawWaterfall(ctx, t) {
    const wf = this.anchors.waterfall;
    const topY = wf.y - 62;

    // the rock ledge it pours from
    ctx.fillStyle = '#211a30';
    ctx.beginPath();
    ctx.moveTo(wf.x - 16, topY + 2);
    ctx.lineTo(wf.x + 14, topY - 3);
    ctx.lineTo(wf.x + 12, topY + 5);
    ctx.lineTo(wf.x - 14, topY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // the falling water: two layered ribbons with a highlight core, gently
    // wavering rather than perfectly straight
    for (const [dx, width, alpha] of [[-2, 8, 0.55], [1.5, 6, 0.8]]) {
      const grad = ctx.createLinearGradient(0, topY, 0, wf.y);
      grad.addColorStop(0, 'rgba(220,235,250,0)');
      grad.addColorStop(0.2, `rgba(220,235,250,${alpha})`);
      grad.addColorStop(1, `rgba(200,220,245,${alpha + 0.1})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      const wobble = Math.sin(t * 1.4) * 1.2;
      ctx.moveTo(wf.x + dx - width / 2, topY);
      ctx.quadraticCurveTo(wf.x + dx + wobble, wf.y - (wf.y - topY) * 0.4, wf.x + dx - width / 2 + 1, wf.y);
      ctx.lineTo(wf.x + dx + width / 2 + 1, wf.y);
      ctx.quadraticCurveTo(wf.x + dx + width / 2 + wobble, wf.y - (wf.y - topY) * 0.4, wf.x + dx + width / 2, topY);
      ctx.closePath();
      ctx.fill();
    }

    // flowing streaks, drifting down and looping, for a sense of motion
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const phase = (t * 0.7 + i / 4) % 1;
      const y = topY + (wf.y - topY) * phase;
      ctx.globalAlpha = Math.sin(phase * Math.PI);
      ctx.beginPath();
      ctx.moveTo(wf.x - 3 + i * 1.3, y);
      ctx.lineTo(wf.x - 3 + i * 1.3, y + 7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // mist pooling at the base, with a couple of drifting puffs
    ctx.fillStyle = 'rgba(225,235,250,0.3)';
    ctx.beginPath();
    ctx.ellipse(wf.x, wf.y + 4, 18, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = t * 0.6 + i * 2.1;
      const mx = wf.x + Math.cos(a) * (10 + i * 3);
      const my = wf.y + 3 + Math.sin(a * 1.3) * 2;
      ctx.fillStyle = `rgba(230,240,255,${0.15 + 0.1 * Math.sin(t + i)})`;
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // flanking rock
    ctx.fillStyle = '#241c34';
    ctx.beginPath();
    ctx.moveTo(wf.x + 12, wf.y + 6);
    ctx.lineTo(wf.x + 22, wf.y - 14);
    ctx.lineTo(wf.x + 26, wf.y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  drawCave(ctx, t) {
    const c = this.anchors.cave;
    // surrounding rock outcrop the mouth is set into
    ctx.fillStyle = '#221a34';
    ctx.beginPath();
    ctx.moveTo(c.x - 24, c.y + 6);
    ctx.lineTo(c.x - 18, c.y - 20);
    ctx.lineTo(c.x + 4, c.y - 26);
    ctx.lineTo(c.x + 22, c.y - 10);
    ctx.lineTo(c.x + 20, c.y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // the mouth itself, a pointed arch rather than a plain ellipse
    ctx.fillStyle = 'rgba(6,4,12,0.95)';
    ctx.beginPath();
    ctx.moveTo(c.x - 12, c.y + 3);
    ctx.quadraticCurveTo(c.x - 13, c.y - 14, c.x, c.y - 20);
    ctx.quadraticCurveTo(c.x + 13, c.y - 14, c.x + 12, c.y + 3);
    ctx.closePath();
    ctx.fill();

    // a couple of stalactites at the rim
    ctx.fillStyle = '#1a1428';
    for (const dx of [-6, 5]) {
      ctx.beginPath();
      ctx.moveTo(c.x + dx - 1.5, c.y - 12);
      ctx.lineTo(c.x + dx + 1.5, c.y - 12);
      ctx.lineTo(c.x + dx, c.y - 7);
      ctx.closePath();
      ctx.fill();
    }

    // warm inner glow with a couple of soft light rays
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.2);
    const glow = ctx.createRadialGradient(c.x, c.y - 6, 0, c.x, c.y - 6, 16 + pulse * 3);
    glow.addColorStop(0, `rgba(255,190,120,${0.35 + pulse * 0.15})`);
    glow.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y - 6, 16 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18 + pulse * 0.1;
    ctx.fillStyle = '#ffcf94';
    for (const a of [-0.5, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 4);
      ctx.lineTo(c.x + Math.sin(a) * 22, c.y - 4 - Math.cos(a) * 22);
      ctx.lineTo(c.x + Math.sin(a + 0.15) * 22, c.y - 4 - Math.cos(a + 0.15) * 22);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawRidge(ctx) {
    for (const r of this.ridgeRocks) {
      // faceted rock: irregular polygon, split light/shadow like the main peak
      ctx.beginPath();
      r.points.forEach((p, i) => {
        const x = r.x + Math.cos(p.a) * r.size * p.r;
        const y = r.y - r.size * 0.4 + Math.sin(p.a) * r.size * p.r * 0.7;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      const grad = ctx.createLinearGradient(r.x - r.size, r.y, r.x + r.size, r.y);
      grad.addColorStop(0, 'rgba(58,48,80,0.85)');
      grad.addColorStop(1, 'rgba(16,12,26,0.85)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  drawTemple(ctx) {
    const temple = this.anchors.temple;
    const platGrad = ctx.createLinearGradient(temple.x - 44, 0, temple.x + 44, 0);
    platGrad.addColorStop(0, 'rgba(150,140,175,0.3)');
    platGrad.addColorStop(0.5, 'rgba(200,190,220,0.4)');
    platGrad.addColorStop(1, 'rgba(150,140,175,0.3)');
    ctx.fillStyle = platGrad;
    ctx.beginPath();
    ctx.ellipse(temple.x, temple.y + 3, 46, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(temple.x - 20, temple.y + 4);
    ctx.lineTo(temple.x + 6, temple.y);
    ctx.stroke();

    // a fallen fragment, so it reads as ruined rather than tidy
    ctx.save();
    ctx.translate(temple.x + 30, temple.y);
    ctx.rotate(0.9);
    ctx.fillStyle = 'rgba(210,195,160,0.7)';
    ctx.fillRect(-9, -3.5, 18, 7);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.7;
    ctx.strokeRect(-9, -3.5, 18, 7);
    ctx.restore();

    for (const c of this.columns) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.lean);
      const topH = c.broken ? c.h * 0.7 : c.h;
      const shade = 78 - c.weather * 15;

      // base plinth
      ctx.fillStyle = `hsl(38, 25%, ${shade - 10}%)`;
      ctx.fillRect(-5.5, -2, 11, 3);

      // shaft with subtle fluting + weathering gradient
      const shaftGrad = ctx.createLinearGradient(-4, 0, 4, 0);
      shaftGrad.addColorStop(0, `hsl(38, 22%, ${shade - 12}%)`);
      shaftGrad.addColorStop(0.5, `hsl(40, 26%, ${shade + 6}%)`);
      shaftGrad.addColorStop(1, `hsl(38, 22%, ${shade - 8}%)`);
      ctx.fillStyle = shaftGrad;
      ctx.fillRect(-4, -topH, 8, topH);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.6;
      for (const fx of [-1.6, 0, 1.6]) {
        ctx.beginPath();
        ctx.moveTo(fx, -topH + 2);
        ctx.lineTo(fx, -2);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.7;
      ctx.strokeRect(-4, -topH, 8, topH);

      // capital
      ctx.fillStyle = `hsl(38, 25%, ${shade})`;
      ctx.fillRect(-5.5, -topH - 2.5, 11, 3);
      ctx.strokeRect(-5.5, -topH - 2.5, 11, 3);

      if (c.broken) {
        ctx.fillStyle = shaftGrad;
        ctx.beginPath();
        ctx.moveTo(-4, -topH);
        ctx.lineTo(0, -topH - 6);
        ctx.lineTo(4, -topH);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
      }

      if (c.vine) {
        ctx.strokeStyle = 'rgba(70,110,60,0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(4, 0);
        for (let y = 0; y > -topH; y -= 4) {
          ctx.quadraticCurveTo(4 + Math.sin(y * 0.5) * 3, y - 2, 4, y - 4);
        }
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  drawCamp(ctx, t, dt) {
    const camp = this.anchors.camp;

    // grass patch with a soft gradient + scattered tufts on top
    const grassGrad = ctx.createRadialGradient(camp.x, camp.y, 4, camp.x, camp.y + 2, 56);
    grassGrad.addColorStop(0, 'rgba(58,78,48,0.65)');
    grassGrad.addColorStop(1, 'rgba(38,52,34,0.5)');
    ctx.fillStyle = grassGrad;
    ctx.beginPath();
    ctx.ellipse(camp.x, camp.y + 2, 56, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,110,70,0.6)';
    ctx.lineWidth = 1;
    for (const g of this.grassTufts) {
      const gx = camp.x + g.dx;
      const gy = camp.y + g.dy;
      ctx.beginPath();
      ctx.moveTo(gx - 2, gy);
      ctx.quadraticCurveTo(gx - 2 + g.lean * 4, gy - g.h, gx - 2 + g.lean * 6, gy - g.h);
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx + g.lean * 4, gy - g.h * 1.2, gx + g.lean * 6, gy - g.h * 1.2);
      ctx.moveTo(gx + 2, gy);
      ctx.quadraticCurveTo(gx + 2 + g.lean * 4, gy - g.h, gx + 2 + g.lean * 6, gy - g.h);
      ctx.stroke();
    }

    // two tents flanking the fire, with fabric-fold shading and a door flap
    for (const side of [-1, 1]) {
      const tx = camp.x + side * 30;
      const tentGrad = ctx.createLinearGradient(tx - 11, 0, tx + 11, 0);
      tentGrad.addColorStop(0, 'rgba(150,88,60,0.85)');
      tentGrad.addColorStop(0.5, 'rgba(178,108,74,0.85)');
      tentGrad.addColorStop(1, 'rgba(130,74,50,0.85)');
      ctx.fillStyle = tentGrad;
      ctx.beginPath();
      ctx.moveTo(tx, camp.y - 18);
      ctx.lineTo(tx - 11, camp.y);
      ctx.lineTo(tx + 11, camp.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      // door flap
      ctx.fillStyle = 'rgba(30,18,12,0.55)';
      ctx.beginPath();
      ctx.moveTo(tx, camp.y - 18);
      ctx.lineTo(tx - 3, camp.y);
      ctx.lineTo(tx + 3, camp.y);
      ctx.closePath();
      ctx.fill();
      // fold lines
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(tx, camp.y - 18);
      ctx.lineTo(tx - 6, camp.y);
      ctx.stroke();
      // small pennant
      ctx.fillStyle = `hsl(${side > 0 ? 350 : 210}, 55%, 55%)`;
      ctx.beginPath();
      ctx.moveTo(tx, camp.y - 18);
      ctx.lineTo(tx, camp.y - 23);
      ctx.lineTo(tx + 4, camp.y - 20.5);
      ctx.closePath();
      ctx.fill();
    }

    // signpost
    ctx.strokeStyle = '#4a3826';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(camp.x - 46, camp.y);
    ctx.lineTo(camp.x - 46, camp.y - 15);
    ctx.stroke();
    ctx.fillStyle = '#5a4530';
    ctx.fillRect(camp.x - 53, camp.y - 17, 13, 5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.6;
    ctx.strokeRect(camp.x - 53, camp.y - 17, 13, 5);

    // fire ring stones
    ctx.fillStyle = '#3a3448';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(camp.x + Math.cos(a) * 8, camp.y + Math.sin(a) * 3, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // campfire: crossed logs, layered flame, flicker + rising embers - the
    // single cheapest "alive" cue, worth the most per pixel
    ctx.strokeStyle = '#3a2a1c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(camp.x - 6, camp.y + 1);
    ctx.lineTo(camp.x + 5, camp.y - 2);
    ctx.moveTo(camp.x - 5, camp.y - 2);
    ctx.lineTo(camp.x + 6, camp.y + 1);
    ctx.stroke();

    const flick = 0.7 + 0.3 * Math.sin(t * 9) * Math.sin(t * 3.3);
    const fireGlow = ctx.createRadialGradient(camp.x, camp.y - 4, 0, camp.x, camp.y - 4, 22 * flick);
    fireGlow.addColorStop(0, `rgba(255,170,90,${0.4 * flick})`);
    fireGlow.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = fireGlow;
    ctx.beginPath();
    ctx.arc(camp.x, camp.y - 4, 22 * flick, 0, Math.PI * 2);
    ctx.fill();

    for (const [scale, hue, light] of [[1, 20, 50], [0.6, 45, 70]]) {
      ctx.fillStyle = `hsl(${hue}, 95%, ${light + flick * 8}%)`;
      ctx.beginPath();
      ctx.moveTo(camp.x, camp.y - 15 * flick * scale);
      ctx.quadraticCurveTo(camp.x + 5 * scale, camp.y - 5, camp.x + 2 * scale, camp.y);
      ctx.quadraticCurveTo(camp.x, camp.y - 4, camp.x - 2 * scale, camp.y);
      ctx.quadraticCurveTo(camp.x - 5 * scale, camp.y - 5, camp.x, camp.y - 15 * flick * scale);
      ctx.fill();
    }

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
