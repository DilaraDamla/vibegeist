// mountain geometry: a lane narrows from the base up to a single peak point.
// climbProgress 0..1 maps a task's lane fraction (its seeded x) and height to
// an (x,y) point on the slope - more tool calls this turn = higher up the mountain.
export function mountainGeometry(canvas) {
  return {
    peakX: canvas.width / 2,
    peakY: canvas.height * 0.1,
    baseY: canvas.height - 6,
    baseLeftX: canvas.width * 0.06,
    baseRightX: canvas.width * 0.94,
  };
}

export function pointOnMountain(canvas, laneFrac, progress) {
  const m = mountainGeometry(canvas);
  const leftX = m.baseLeftX + (m.peakX - m.baseLeftX) * progress;
  const rightX = m.baseRightX + (m.peakX - m.baseRightX) * progress;
  return {
    x: leftX + (rightX - leftX) * laneFrac,
    y: m.baseY + (m.peakY - m.baseY) * progress,
  };
}

// finds the point on a jagged edge at a given climb fraction, interpolating
// between the two nearest generated points
export function edgePointAt(pts, targetP) {
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].p <= targetP && pts[i + 1].p >= targetP) {
      const span = pts[i + 1].p - pts[i].p || 1;
      const f = (targetP - pts[i].p) / span;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
    }
  }
  return pts[pts.length - 1];
}
