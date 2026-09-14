// the precious sphere every task carries to the summit - a soft halo, a glassy
// gradient core, a rim light, a specular highlight, and orbiting sparkle
// motes, so it reads as a gem/pearl rather than a flat colored ball. Its
// presence visibly grows with the task's own progress: 0-25/25-50/50-75/
// 75-99% add sparkles and halo strength in steps, not just a smooth scale.
export function drawOrb(ctx, x, y, r, hue, t, phase, glow = 1, energy = 1) {
  const tier = energy >= 0.99 ? 4 : energy >= 0.75 ? 3 : energy >= 0.5 ? 2 : energy >= 0.25 ? 1 : 0;
  const haloR = r * (2.2 + tier * 0.15);

  const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
  halo.addColorStop(0, `hsla(${hue}, 85%, 75%, ${(0.28 + tier * 0.05) * glow})`);
  halo.addColorStop(1, `hsla(${hue}, 85%, 75%, 0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, haloR, 0, Math.PI * 2);
  ctx.fill();

  const core = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  core.addColorStop(0, `hsla(${hue}, 60%, 96%, 1)`);
  core.addColorStop(0.45, `hsla(${hue}, 80%, 78%, 1)`);
  core.addColorStop(1, `hsla(${hue}, 70%, 42%, 1)`);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `hsla(${hue}, 90%, 88%, 0.5)`;
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.94, -0.6, 0.9);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.38, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();

  const sparkleCount = 1 + tier;
  for (let i = 0; i < sparkleCount; i++) {
    const a = t * 1.4 + phase + (i / sparkleCount) * Math.PI * 2;
    const sx = x + Math.cos(a) * r * 1.6;
    const sy = y + Math.sin(a) * r * 1.6 * 0.5;
    const sparkleAlpha = Math.max(0, 0.4 + 0.4 * Math.sin(t * 3 + i * 2));
    ctx.fillStyle = `rgba(255,255,255,${sparkleAlpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawOrbShadow(ctx, x, y, r) {
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.8, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// a short fading streak behind the orb as it's carried, at high energy only -
// "bazen ışık izi bırakmalı"
export function drawOrbTrail(ctx, x, y, prevX, prevY, r, hue, energy) {
  if (energy < 0.5) return;
  ctx.strokeStyle = `hsla(${hue}, 85%, 80%, ${0.25 * (energy - 0.5) * 2})`;
  ctx.lineWidth = r * 0.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(prevX, prevY);
  ctx.lineTo(x, y);
  ctx.stroke();
}

// the one-shot light burst at 100% - frac runs 0..1 over the burst's own
// short lifetime
export function drawOrbBurst(ctx, x, y, hue, frac) {
  const alpha = Math.max(0, 1 - frac);
  ctx.globalAlpha = alpha;

  const flashR = 18 * (1 - frac);
  if (flashR > 0) {
    const flash = ctx.createRadialGradient(x, y, 0, x, y, flashR);
    flash.addColorStop(0, `hsla(${hue}, 80%, 96%, 1)`);
    flash.addColorStop(1, `hsla(${hue}, 80%, 96%, 0)`);
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(x, y, flashR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = `hsla(${hue}, 90%, 85%, 1)`;
  ctx.lineWidth = 2.5 * (1 - frac) + 0.4;
  ctx.beginPath();
  ctx.arc(x, y, 6 + frac * 48, 0, Math.PI * 2);
  ctx.stroke();

  const count = 10;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const dist = frac * 42;
    ctx.fillStyle = `hsla(${hue}, 85%, 88%, 1)`;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist * 0.6, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
