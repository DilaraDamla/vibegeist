import { pointOnMountain } from './geometry.js';

// the journey every task takes, as a sequence of named places rather than a
// featureless slope. Each waypoint is defined in the same (laneFrac, progress)
// space the mountain already uses, so screen positions still adapt to resize
// for free - only the path BETWEEN them now has real direction changes.
export const WAYPOINTS = [
  { name: 'camp', p: 0, lane: 0.5 },
  { name: 'forest', p: 0.16, lane: 0.3 },
  { name: 'bridge', p: 0.3, lane: 0.64 },
  { name: 'waterfall', p: 0.42, lane: 0.38 },
  { name: 'cave', p: 0.55, lane: 0.7 },
  { name: 'ridge', p: 0.65, lane: 0.42 },
  { name: 'temple', p: 0.77, lane: 0.56 },
  { name: 'peak', p: 1, lane: 0.5 },
];

export class Route {
  constructor(canvas) {
    this.canvas = canvas;
  }

  // screen position of a named waypoint, or by index
  anchor(wp) {
    return pointOnMountain(this.canvas, wp.lane, wp.p);
  }

  anchors() {
    return WAYPOINTS.map((wp) => ({ wp, pos: this.anchor(wp) }));
  }

  // position along the whole journey at a given 0..1 progress, with an
  // optional perpendicular offset (in px) so concurrent tasks walking the
  // same stretch don't perfectly overlap
  pointAt(progress, lateralOffset = 0) {
    const p = Math.max(0, Math.min(1, progress));
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const a = WAYPOINTS[i];
      const b = WAYPOINTS[i + 1];
      if (p >= a.p && p <= b.p) {
        const span = b.p - a.p || 1;
        const f = (p - a.p) / span;
        const pa = this.anchor(a);
        const pb = this.anchor(b);
        const x = pa.x + (pb.x - pa.x) * f;
        const y = pa.y + (pb.y - pa.y) * f;
        if (!lateralOffset) return { x, y };
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: x + (-dy / len) * lateralOffset, y: y + (dx / len) * lateralOffset };
      }
    }
    return this.anchor(WAYPOINTS[WAYPOINTS.length - 1]);
  }
}
