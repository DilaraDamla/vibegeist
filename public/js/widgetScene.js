import { WAYPOINTS } from './route.js';

// small icon glyphs for each waypoint marker - tiny enough to read at a
// glance, distinct enough not to blur into each other
const MARKER_COLOR = {
  camp: '#ff9d4d',
  forest: '#4caf6e',
  bridge: '#b98a52',
  waterfall: '#7fc4e8',
  cave: '#e0975a',
  ridge: '#8a8aa0',
  temple: '#e8cf96',
  peak: '#c9a8ff',
};

// the compact widget view: a single one-sided slope, progress running left
// to right, with small waypoint markers instead of full scenery - a corner
// widget needs a glanceable status, not a diorama to admire
export class WidgetScene {
  constructor(canvas, sideRoute) {
    this.canvas = canvas;
    this.route = sideRoute;
  }

  draw(ctx, t) {
    const c = this.canvas;
    const sky = ctx.createLinearGradient(0, 0, 0, c.height);
    sky.addColorStop(0, '#0a0714');
    sky.addColorStop(1, '#171233');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, c.width, c.height);

    const { x0, x1, y0, y1 } = this.route.endpoints();

    // peak glow at the high end
    const glow = ctx.createRadialGradient(x1, y1, 0, x1, y1, c.width * 0.22);
    glow.addColorStop(0, 'rgba(190,150,255,0.35)');
    glow.addColorStop(1, 'rgba(190,150,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x1, y1, c.width * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // the single slope, as a solid ramp with a lit top edge
    const thickness = c.height * 0.16;
    const rockGrad = ctx.createLinearGradient(x0, y0, x1, y1);
    rockGrad.addColorStop(0, '#241d3c');
    rockGrad.addColorStop(1, '#312a52');
    ctx.fillStyle = rockGrad;
    ctx.beginPath();
    ctx.moveTo(x0 - 14, y0 + thickness * 0.5);
    ctx.lineTo(x0 - 14, c.height + 10);
    ctx.lineTo(x1 + 14, c.height + 10);
    ctx.lineTo(x1 + 14, y1 + thickness * 0.4);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(190,175,225,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // waypoint markers along the slope
    for (const wp of WAYPOINTS) {
      const pos = this.route.pointAt(wp.p, 0);
      const onLine = { x: pos.x, y: pos.y - 3 };
      const pulse = wp.name === 'peak' ? 0.6 + 0.4 * Math.sin(t * 1.5) : 1;
      ctx.fillStyle = MARKER_COLOR[wp.name] || '#ccc';
      ctx.globalAlpha = 0.9 * pulse;
      ctx.beginPath();
      ctx.arc(onLine.x, onLine.y, wp.name === 'peak' ? 3.4 : 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
