import { hashRand } from './utils.js';

const NAMES = ['lantern', 'map', 'compass', 'backpack', 'cape', 'pickaxe'];

// one accessory per task, deterministic from its seed - a small, legible prop
// rather than a costume change, so each chick reads as an individual without
// the character design getting busy
export function pickAccessory(phase) {
  const i = Math.floor(hashRand(Math.floor(phase * 1000) + 42) * NAMES.length) % NAMES.length;
  return NAMES[i];
}

// drawn in the chick's local "facing right, feet at origin" space, after the
// body but before restore - bodyCy is the body center's local y (negative)
export function drawAccessory(ctx, name, bodyR, bodyCy, hue, t) {
  const accentColor = `hsl(${(hue + 30) % 360}, 70%, 55%)`;

  if (name === 'lantern') {
    const hx = -bodyR * 1.3;
    const hy = bodyCy + bodyR * 0.4;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-bodyR * 0.6, bodyCy + bodyR * 0.3);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    const flick = 0.75 + 0.25 * Math.sin(t * 8);
    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 7 * flick);
    glow.addColorStop(0, `rgba(255,200,120,${0.6 * flick})`);
    glow.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(hx, hy, 7 * flick, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2e22';
    ctx.beginPath();
    ctx.arc(hx, hy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === 'map') {
    ctx.save();
    ctx.translate(-bodyR * 0.7, bodyCy - bodyR * 0.1);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#e8d9b0';
    ctx.fillRect(-1.5, -6, 3, 12);
    ctx.strokeStyle = '#b89a5e';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-1.5, -6, 3, 12);
    ctx.restore();
  } else if (name === 'compass') {
    const cx = bodyR * 0.15;
    const cy = bodyCy + bodyR * 0.35;
    ctx.fillStyle = '#d8c58a';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a4a3a';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 1.8);
    ctx.lineTo(cx, cy + 1.8);
    ctx.stroke();
  } else if (name === 'backpack') {
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.ellipse(-bodyR * 0.8, bodyCy + bodyR * 0.15, bodyR * 0.45, bodyR * 0.55, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === 'cape') {
    const sway = Math.sin(t * 2) * 0.15;
    ctx.save();
    ctx.translate(-bodyR * 0.5, bodyCy - bodyR * 0.6);
    ctx.rotate(0.3 + sway);
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-bodyR * 0.3, bodyR * 1.6);
    ctx.lineTo(bodyR * 0.5, bodyR * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  } else if (name === 'pickaxe') {
    ctx.save();
    ctx.translate(-bodyR * 0.7, bodyCy - bodyR * 0.9);
    ctx.rotate(-0.7);
    ctx.strokeStyle = '#7a5c3e';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 6);
    ctx.stroke();
    ctx.strokeStyle = '#9098a4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -8);
    ctx.lineTo(5, -8);
    ctx.stroke();
    ctx.restore();
  }
}
