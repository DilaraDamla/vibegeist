import { drawChick, drawContactShadow } from './chick.js';
import { PALETTE } from './look.js';

// when nobody's actively climbing, the world shouldn't just look empty - a
// few chicks sit near camp and snack instead. Fixed seeds (not random per
// frame) so they don't jitter between positions/hues on every redraw.
const IDLE_CHICKS = [
  { dx: -26, phase: 0, look: idleLook(0, 'curl', 'sparkle', 'none', '#e2474b') },
  { dx: 10, phase: 2.4, look: idleLook(6, 'spikes', 'sleepy', 'beanie', '#3d7be0') },
  { dx: 40, phase: 4.7, look: idleLook(3, 'messy', 'curious', 'flower', '#f2c230') },
];

function idleLook(colorIdx, tuft, eyes, hat, hatColor) {
  const { body, accent, hue } = PALETTE[colorIdx];
  return { colorIdx, body, accent, hue, tuft, eyes, hat, hatColor };
}

// followSlope: the widget's camp sits on a diagonal slope, not the main
// view's flat clearing - without it the chicks either side of camp float
// above or sink into the ground
export function drawIdleChicks(ctx, route, t, scale = 1, followSlope = false) {
  const camp = route.pointAt(0, 0);
  const ahead = route.pointAt(0.01, 0);
  const slope = followSlope && ahead.x !== camp.x ? (ahead.y - camp.y) / (ahead.x - camp.x) : 0;
  for (const seed of IDLE_CHICKS) {
    const px = camp.x + seed.dx * scale;
    const groundY = camp.y + seed.dx * scale * slope;
    drawContactShadow(ctx, px, groundY, scale);
    drawChick(ctx, px, groundY, {
      bodyR: 11 * scale,
      hue: seed.look.hue,
      look: seed.look,
      walkPhase: 0,
      facingLeft: seed.dx > 0,
      sitting: true,
      eating: true,
      idleFlap: Math.sin(t * 1.5 + seed.phase) * 0.12,
      t: t + seed.phase,
    });
  }
}
