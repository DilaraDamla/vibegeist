// the compact widget view: nothing but a progress track. A corner widget is
// glanced at, not admired - so no scenery, no waypoint iconography, just the
// line every task moves along and a glow marking the goal. Per-task position
// is drawn separately by Task#drawProgress, also stripped down to a bare dot.
export class WidgetScene {
  constructor(canvas, sideRoute) {
    this.canvas = canvas;
    this.route = sideRoute;
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

    // the track itself: one clean line, start to goal
    ctx.strokeStyle = 'rgba(255,225,205,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    ctx.fillStyle = 'rgba(230,210,220,0.7)';
    ctx.beginPath();
    ctx.arc(x0, y0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
