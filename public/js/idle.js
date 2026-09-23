import { drawChick, drawContactShadow } from './chick.js';

// when nobody's actively climbing, the world shouldn't just look empty - a
// few chicks sit near camp and snack instead. Fixed seeds (not random per
// frame) so they don't jitter between positions/hues on every redraw.
const IDLE_CHICKS = [
  { dx: -26, hue: 25, phase: 0 },
  { dx: 10, hue: 130, phase: 2.4 },
  { dx: 40, hue: 300, phase: 4.7 },
];

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
      hue: seed.hue,
      walkPhase: 0,
      facingLeft: seed.dx > 0,
      sitting: true,
      eating: true,
      idleFlap: Math.sin(t * 1.5 + seed.phase) * 0.12,
      t: t + seed.phase,
    });
  }
}
