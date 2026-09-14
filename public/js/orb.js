// the precious sphere every task carries to the summit - a soft halo, a glassy
// gradient core, a rim light, a specular highlight, and a couple of orbiting
// sparkle motes, so it reads as a gem/pearl rather than a flat colored ball.
export function drawOrb(ctx, x, y, r, hue, t, phase, glow = 1) {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
  halo.addColorStop(0, `hsla(${hue}, 85%, 75%, ${0.35 * glow})`);
  halo.addColorStop(1, `hsla(${hue}, 85%, 75%, 0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
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

  for (let i = 0; i < 2; i++) {
    const a = t * 1.4 + phase + i * Math.PI;
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
