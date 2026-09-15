import { hashRand } from './utils.js';
import { mountainGeometry, pointOnMountain, edgePointAt } from './geometry.js';

// the mystical mountain everyone's task climbs: a jagged rock silhouette with
// a lit/shadow ridge crease, scattered rock-chip facets, and a snow cap with
// an irregular snowline - built once and cached, regenerated only on resize.
export class Mountain {
  constructor(canvas) {
    this.canvas = canvas;
    this.resize();
  }

  resize() {
    const canvas = this.canvas;
    const m = mountainGeometry(canvas);
    const steps = 26;

    const side = (fromX, seedBase) => {
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const p = i / steps; // 0 at base corner, 1 at peak
        const x0 = fromX + (m.peakX - fromX) * p;
        const y0 = m.baseY + (m.peakY - m.baseY) * p;
        const taper = Math.sin(p * Math.PI);
        // three noise octaves - big rocky outcrops, sharper crags, and a fast
        // micro-jitter on top - a single smooth octave read as a rounded
        // hill, not a rugged rock face
        const coarse = (hashRand(seedBase + Math.floor(i / 2)) - 0.5) * 2;
        const fine = (hashRand(seedBase + 500 + i) - 0.5) * 2;
        const micro = (hashRand(seedBase + 1200 + i) - 0.5) * 2;
        const amp = 44 * taper;
        const jitter = coarse * 0.5 + fine * 0.32 + micro * 0.18;
        pts.push({ x: x0 + jitter * amp, y: y0 - Math.abs(jitter) * amp * 0.35, p });
      }
      return pts;
    };
    this.edges = { left: side(m.baseLeftX, 1), right: side(m.baseRightX, 50) };

    // a jagged central ridge splitting the face into a lit side and a shadowed
    // side - the strongest single cue that this is a solid 3D form
    const spineX = canvas.width * 0.5;
    const spine = [];
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const x0 = spineX + (m.peakX - spineX) * p;
      const y0 = m.baseY + (m.peakY - m.baseY) * p;
      const taper = Math.sin(p * Math.PI);
      const jitter = (hashRand(900 + i) - 0.5) * 2;
      const microJitter = (hashRand(1900 + i) - 0.5) * 2;
      const amp = 24 * taper;
      spine.push({ x: x0 + (jitter * 0.7 + microJitter * 0.3) * amp, y: y0 - Math.abs(jitter) * amp * 0.35, p });
    }
    this.spine = spine;

    // scattered irregular rock chips over each face for real low-poly texture -
    // randomly placed and sized, since a regular tiled ladder reads as a
    // staircase rather than rock
    const facets = (edgePts, seedBase) => {
      const f = [];
      const count = 22;
      for (let i = 0; i < count; i++) {
        const p = 0.05 + hashRand(seedBase + i * 3) * 0.88;
        const lane = hashRand(seedBase + i * 3 + 1);
        const edgePt = edgePointAt(edgePts, p);
        const spinePt = edgePointAt(this.spine, p);
        const cx = spinePt.x + (edgePt.x - spinePt.x) * lane;
        const cy = spinePt.y + (edgePt.y - spinePt.y) * lane;
        const size = 12 + hashRand(seedBase + i * 3 + 2) * 22;
        const angle = hashRand(seedBase + i * 7) * Math.PI * 2;
        f.push({ cx, cy, size, angle, shade: hashRand(seedBase + i * 11) });
      }
      return f;
    };
    this.facets = { left: facets(this.edges.left, 2000), right: facets(this.edges.right, 3000) };

    this.snowStart = 0.8;
  }

  pointAt(laneFrac, progress) {
    return pointOnMountain(this.canvas, laneFrac, progress);
  }

  draw(ctx) {
    const canvas = this.canvas;
    const m = mountainGeometry(canvas);
    const edges = this.edges;

    const rock = ctx.createLinearGradient(0, m.peakY, 0, m.baseY);
    rock.addColorStop(0, '#2a2350');
    rock.addColorStop(1, '#171233');
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(edges.left[0].x, edges.left[0].y);
    for (const pt of edges.left) ctx.lineTo(pt.x, pt.y);
    for (let i = edges.right.length - 1; i >= 0; i--) ctx.lineTo(edges.right[i].x, edges.right[i].y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(150,120,220,0.16)';
    ctx.beginPath();
    ctx.moveTo(edges.left[0].x, edges.left[0].y);
    for (const pt of edges.left) ctx.lineTo(pt.x, pt.y);
    for (let i = this.spine.length - 1; i >= 0; i--) ctx.lineTo(this.spine[i].x, this.spine[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.moveTo(this.spine[0].x, this.spine[0].y);
    for (const pt of this.spine) ctx.lineTo(pt.x, pt.y);
    for (let i = edges.right.length - 1; i >= 0; i--) ctx.lineTo(edges.right[i].x, edges.right[i].y);
    ctx.closePath();
    ctx.fill();

    for (const facet of [...this.facets.left, ...this.facets.right]) {
      ctx.fillStyle = facet.shade < 0.5 ? `rgba(0,0,0,${0.05 + facet.shade * 0.14})` : `rgba(255,255,255,${(facet.shade - 0.5) * 0.14})`;
      ctx.beginPath();
      ctx.moveTo(facet.cx + Math.cos(facet.angle) * facet.size, facet.cy + Math.sin(facet.angle) * facet.size * 0.6);
      ctx.lineTo(facet.cx + Math.cos(facet.angle + 2.3) * facet.size * 0.8, facet.cy + Math.sin(facet.angle + 2.3) * facet.size * 0.6);
      ctx.lineTo(facet.cx + Math.cos(facet.angle + 4.6) * facet.size * 0.9, facet.cy + Math.sin(facet.angle + 4.6) * facet.size * 0.6);
      ctx.closePath();
      ctx.fill();
    }

    this.drawPeakGlow(ctx, 1);

    const snowStart = this.snowStart;
    const leftSnowPts = edges.left.filter((p) => p.p >= snowStart);
    const rightSnowPts = edges.right.filter((p) => p.p >= snowStart);
    const leftSnowBase = edgePointAt(edges.left, snowStart);
    const rightSnowBase = edgePointAt(edges.right, snowStart);
    const snowlineSteps = 5;
    const snowlinePts = [];
    for (let i = 1; i < snowlineSteps; i++) {
      const laneFrac = i / snowlineSteps;
      const wobble = (hashRand(300 + i) - 0.5) * 0.22;
      snowlinePts.push(pointOnMountain(canvas, laneFrac, snowStart + wobble));
    }
    const snowGrad = ctx.createLinearGradient(0, m.peakY, 0, leftSnowBase.y);
    snowGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
    snowGrad.addColorStop(1, 'rgba(210,205,235,0.75)');
    ctx.fillStyle = snowGrad;
    ctx.beginPath();
    ctx.moveTo(leftSnowBase.x, leftSnowBase.y);
    for (const pt of leftSnowPts) ctx.lineTo(pt.x, pt.y);
    for (let i = rightSnowPts.length - 1; i >= 0; i--) ctx.lineTo(rightSnowPts[i].x, rightSnowPts[i].y);
    ctx.lineTo(rightSnowBase.x, rightSnowBase.y);
    for (let i = snowlinePts.length - 1; i >= 0; i--) ctx.lineTo(snowlinePts[i].x, snowlinePts[i].y);
    ctx.lineTo(leftSnowBase.x, leftSnowBase.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(120,108,175,0.4)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(m.peakX - 14, m.peakY + 22);
    ctx.lineTo(m.peakX - 34, leftSnowBase.y - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m.peakX + 22, m.peakY + 38);
    ctx.lineTo(m.peakX + 16, rightSnowBase.y - 4);
    ctx.stroke();
  }

  // exposed separately so a task's "placing" ceremony can pulse it brighter
  drawPeakGlow(ctx, intensity) {
    const m = mountainGeometry(this.canvas);
    const r = 90 * (0.85 + intensity * 0.15);
    const glow = ctx.createRadialGradient(m.peakX, m.peakY, 0, m.peakX, m.peakY, r);
    glow.addColorStop(0, `rgba(190,150,255,${0.35 * intensity})`);
    glow.addColorStop(1, 'rgba(190,150,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(m.peakX, m.peakY, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
