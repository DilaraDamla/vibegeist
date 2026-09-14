import { hashRand } from './utils.js';

// the ambient world around the mountain: night sky, twinkling stars, distant
// ridgelines, drifting wind swirls, and falling snow. All of this keeps moving
// regardless of whether any task is active, so the world never sits still.
export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.resize();
  }

  resize() {
    const canvas = this.canvas;
    this.stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.8,
      r: Math.random() * 1.3 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
    }));

    this.windGusts = Array.from({ length: 5 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.5,
      scale: 16 + Math.random() * 14,
      driftSpeed: 18 + Math.random() * 22,
      spinSpeed: (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 0.6),
      opacity: 0.16 + Math.random() * 0.14,
      phase: Math.random() * Math.PI * 2,
    }));

    this.snowflakes = Array.from({ length: 45 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.6 + 0.6,
      speed: Math.random() * 14 + 8,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: Math.random() * 0.6 + 0.3,
    }));

    this.farRanges = [0.5, 0.4].map((heightFrac, layer) => {
      const baseY = canvas.height * (0.78 + layer * 0.05);
      const peakY = canvas.height * heightFrac;
      const points = [];
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const p = i / steps;
        const x = p * canvas.width;
        const jitter = hashRand(layer * 97 + i);
        const y = baseY - (baseY - peakY) * Math.pow(Math.sin(p * Math.PI), 0.7) * (0.55 + jitter * 0.45);
        points.push({ x, y });
      }
      return { points, color: layer === 0 ? 'rgba(40,34,74,0.55)' : 'rgba(60,52,102,0.4)' };
    });
  }

  drawSky(ctx) {
    const canvas = this.canvas;
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#0a0714');
    sky.addColorStop(1, '#151129');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawStars(ctx, t) {
    for (const star of this.stars) {
      const a = 0.4 + 0.4 * Math.abs(Math.sin(t * 0.8 + star.twinkle));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cfd3dc';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // wind swirls: the classic curling spiral glyph for wind/breeze, actually
  // spinning as it drifts, tail fading toward the outer loose end
  drawWind(ctx, t, dt) {
    const canvas = this.canvas;
    ctx.strokeStyle = '#d2d7eb';
    ctx.lineCap = 'round';
    for (const g of this.windGusts) {
      g.x += g.driftSpeed * dt;
      if (g.x - g.scale > canvas.width) {
        g.x = -g.scale * 2 - Math.random() * 200;
        g.y = Math.random() * canvas.height * 0.5;
      }
      const bob = Math.sin(t * 0.4 + g.phase) * 5;
      ctx.save();
      ctx.translate(g.x, g.y + bob);
      ctx.rotate(t * g.spinSpeed + g.phase);
      ctx.lineWidth = 1.3;
      const turns = 1.5;
      const steps = 20;
      let prevX = g.scale * 1.12;
      let prevY = 0;
      for (let i = 1; i <= steps; i++) {
        const frac = i / steps;
        const a = frac * Math.PI * 2 * turns;
        const r = g.scale * (1 - frac) + g.scale * 0.12;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 0.62;
        ctx.globalAlpha = g.opacity * frac;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
        prevX = x;
        prevY = y;
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawFarRanges(ctx) {
    const canvas = this.canvas;
    for (const range of this.farRanges) {
      ctx.fillStyle = range.color;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, range.points[0].y);
      for (const pt of range.points) ctx.lineTo(pt.x, pt.y);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();
    }
  }

  // drawn last, in front of everything, since falling snow reads as the layer
  // closest to the viewer
  drawSnow(ctx, t, dt) {
    const canvas = this.canvas;
    ctx.fillStyle = '#fff';
    for (const f of this.snowflakes) {
      f.y += f.speed * dt;
      f.x += Math.sin(t * f.swaySpeed + f.sway) * 6 * dt;
      if (f.y > canvas.height + 4) {
        f.y = -4;
        f.x = Math.random() * canvas.width;
      }
      ctx.globalAlpha = 0.3 + 0.35 * Math.abs(Math.sin(t * 1.3 + f.sway));
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
