// the light-particle form a chick transforms into once its task is done: a
// soft glowing core with a few drifting motes and a fading trail rising
// beneath it, rotating gently as it rises and dissolves. Deliberately not an
// emoji - a custom-drawn glow reads as premium, an emoji reads as a sticker.
export function drawSpirit(ctx, x, y, alpha, hue, t, phase) {
  if (alpha <= 0) return;

  // trail fading down beneath the core, showing where it rose from
  const trail = ctx.createLinearGradient(x, y, x, y + 46);
  trail.addColorStop(0, `hsla(${hue}, 70%, 88%, ${0.35 * alpha})`);
  trail.addColorStop(1, `hsla(${hue}, 70%, 88%, 0)`);
  ctx.strokeStyle = trail;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.sin(phase) * 6, y + 46);
  ctx.stroke();

  // soft halo
  const halo = ctx.createRadialGradient(x, y, 0, x, y, 22);
  halo.addColorStop(0, `hsla(${hue}, 80%, 90%, ${0.5 * alpha})`);
  halo.addColorStop(1, `hsla(${hue}, 80%, 90%, 0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fill();

  // bright core
  ctx.fillStyle = `hsla(${hue}, 60%, 97%, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // a few motes drifting slowly away, trailing sparks of the same light
  for (let i = 0; i < 3; i++) {
    const a = t * 1.1 + phase + (i / 3) * Math.PI * 2;
    const r = 10 + i * 4;
    const mx = x + Math.cos(a) * r;
    const my = y + Math.sin(a) * r * 0.6;
    ctx.fillStyle = `hsla(${hue}, 70%, 92%, ${alpha * (0.5 - i * 0.12)})`;
    ctx.beginPath();
    ctx.arc(mx, my, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
