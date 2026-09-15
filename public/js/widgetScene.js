import { hashRand } from './utils.js';

// the compact widget view: no scenery, no waypoint iconography, just the
// track every task moves along and a glow marking the goal - but the track
// itself is jagged, the same noise technique mountain.js uses for the main
// silhouette, so this still reads as the same mountain and not a generic
// progress bar. Per-task position is drawn by Task#drawProgress, which
// reuses the actual chick/orb art from the main page at a smaller scale.
export class WidgetScene {
  constructor(canvas, sideRoute) {
    this.canvas = canvas;
    this.route = sideRoute;
    // fixed, resolution-independent jitter per point along the track (0..1
    // fraction + a perpendicular offset) - the real per-task route stays a
    // straight lerp (SideRoute#pointAt is unchanged), only this decorative
    // line is jagged, exactly like the main mountain's silhouette noise
    // doesn't affect the smooth route tasks actually walk
    this.jitters = Array.from({ length: 9 }, (_, i) => {
      const frac = (i + 1) / 10;
      const coarse = (hashRand(4000 + i) - 0.5) * 2;
      const fine = (hashRand(4100 + i) - 0.5) * 2;
      return { frac, offset: coarse * 0.6 + fine * 0.4 };
    });
  }

  draw(ctx, t) {
    const c = this.canvas;
    const sky = ctx.createLinearGradient(0, 0, 0, c.height);
    sky.addColorStop(0, '#100a20');
    sky.addColorStop(0.55, '#3a1e38');
    sky.addColorStop(1, '#7a3428');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, c.width, c.height);

    const { x0, x1, y0, y1 } = this.route.endpoints();

    // a soft warm glow marks the goal - no hard disc, just the redness
    const pulse = 0.85 + 0.15 * Math.sin(t * 1.5);
    const glow = ctx.createRadialGradient(x1, y1, 0, x1, y1, c.width * 0.18 * pulse);
    glow.addColorStop(0, 'rgba(255,180,120,0.4)');
    glow.addColorStop(0.5, 'rgba(255,130,80,0.18)');
    glow.addColorStop(1, 'rgba(255,90,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x1, y1, c.width * 0.18 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // the track: a jagged line, not a ruler-straight one - same silhouette
    // language as the main mountain, applied to a diagonal instead of a peak
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const jitterAmp = Math.min(c.width, c.height) * 0.045;

    ctx.strokeStyle = 'rgba(255,225,205,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (const j of this.jitters) {
      const px = x0 + dx * j.frac + perpX * j.offset * jitterAmp;
      const py = y0 + dy * j.frac + perpY * j.offset * jitterAmp;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(x1, y1);
    ctx.stroke();

    ctx.fillStyle = 'rgba(230,210,220,0.7)';
    ctx.beginPath();
    ctx.arc(x0, y0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
