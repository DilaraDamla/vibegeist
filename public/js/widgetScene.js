import { hashRand } from './utils.js';

// two-octave value noise over world-space progress (0..1 across the WHOLE
// camp-to-peak journey, independent of whatever camera window is currently
// visible) - so panning to a different stretch of mountain actually reveals
// different terrain, instead of the same few decorative points restretched
function terrainOffset(p) {
  const coarseX = p * 22;
  const ci = Math.floor(coarseX);
  const cf = coarseX - ci;
  const coarse = hashRand(9000 + ci) * (1 - cf) + hashRand(9000 + ci + 1) * cf;
  const fineX = p * 70;
  const fi = Math.floor(fineX);
  const ff = fineX - fi;
  const fine = hashRand(9500 + fi) * (1 - ff) + hashRand(9500 + fi + 1) * ff;
  return (coarse - 0.5) * 0.6 + (fine - 0.5) * 0.4;
}

// ground detail is scattered over fixed slots in world-space progress (same
// idea as terrainOffset), each slot getting its look from hashRand on its own
// index - so it pans with the camera and never reshuffles between frames
const DETAIL_SLOTS = 520;

// how large ground detail draws for the current camera window: 1 at the
// default solo zoom, bigger as the camera closes in and smaller when a wide
// race pulls it back - so zooming in actually magnifies the terrain
function detailZoom(lo, hi) {
  return Math.max(0.6, Math.min(2.6, 0.13 / (hi - lo || 1e-6)));
}

// small loose stones lying on the slope face, a few px to a few dozen px
// below the ridge edge
function drawPebbles(ctx, lo, hi, ridgeAt, canvasH) {
  const span = hi - lo || 1e-6;
  const z = detailZoom(lo, hi);
  for (let k = Math.floor(lo * DETAIL_SLOTS) - 1; k <= Math.ceil(hi * DETAIL_SLOTS) + 1; k++) {
    if (hashRand(k * 3.1 + 11) > 0.55) continue;
    const f = ((k + hashRand(k + 5000)) / DETAIL_SLOTS - lo) / span;
    if (f < 0 || f > 1) continue;
    const base = ridgeAt(f);
    const y = base.y + (8 + hashRand(k * 1.7 + 71) * 90) * z;
    if (y > canvasH) continue;
    const r = (1.6 + hashRand(k * 2.3 + 17) * 3.4) * z;
    ctx.fillStyle = hashRand(k * 5.9 + 3) < 0.5 ? '#3d3566' : '#4d437a';
    ctx.beginPath();
    ctx.ellipse(base.x, y, r * 1.35, r, 0, 0, Math.PI * 2);
    ctx.fill();
    // a thin lit top edge so each stone reads as a lump, not a dot
    ctx.strokeStyle = 'rgba(210,190,230,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(base.x, y, r * 1.35, r, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}

// short tufts of grass growing up out of the ridge edge, swaying slightly
function drawGrass(ctx, lo, hi, ridgeAt, t) {
  const span = hi - lo || 1e-6;
  const z = detailZoom(lo, hi);
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6 * z;
  for (let k = Math.floor(lo * DETAIL_SLOTS) - 1; k <= Math.ceil(hi * DETAIL_SLOTS) + 1; k++) {
    if (hashRand(k * 4.7 + 29) > 0.5) continue;
    const f = ((k + hashRand(k + 7000)) / DETAIL_SLOTS - lo) / span;
    if (f < 0 || f > 1) continue;
    const base = ridgeAt(f);
    const blades = 3 + Math.floor(hashRand(k * 1.3 + 41) * 3);
    const h = (6 + hashRand(k * 2.9 + 13) * 9) * z;
    const sway = Math.sin(t * 1.6 + k) * 1.5 * z;
    ctx.strokeStyle = hashRand(k * 6.1 + 2) < 0.5 ? '#4f7a4c' : '#6a9558';
    for (let b = 0; b < blades; b++) {
      const spread = (b - (blades - 1) / 2) * 2.6 * z;
      const tipH = h * (0.75 + 0.25 * (Math.abs(spread) / (4 * z)));
      ctx.beginPath();
      ctx.moveTo(base.x + spread, base.y + 1);
      ctx.quadraticCurveTo(base.x + spread * 1.4 + sway * 0.5, base.y - h * 0.6, base.x + spread * 2 + sway, base.y - tipH);
      ctx.stroke();
    }
  }
}

// the compact widget view: a camera window onto a SLICE of the mountain
// (see main.js's camera tracking) rather than the whole camp-to-peak span,
// so whoever's leading renders up close. Deliberately never shows camp or
// the summit itself - just an anonymous stretch of slope, so it always
// reads as "still climbing" instead of "just started" or "almost there".
// Per-task position is drawn by Task#drawProgress, which reuses the actual
// chick/orb art from the main page at a smaller scale, through the same
// camera-mapped route.
export class WidgetScene {
  constructor(canvas, sideRoute) {
    this.canvas = canvas;
    this.route = sideRoute;
  }

  // how far the terrain bulges off the straight camp-to-peak line, in px.
  // Grows as the camera closes in, so a zoomed view shows real hills and dips
  // rather than the same near-straight slope just stretched longer
  terrainAmp(lo, hi) {
    const c = this.canvas;
    return Math.min(c.width, c.height) * 0.09 * Math.min(1.7, detailZoom(lo, hi));
  }

  // pixel displacement of the ground surface at a world progress - handed to
  // CameraRoute so chicks walk ON the drawn ridge instead of the straight
  // line beneath it (which would leave them floating over or sunk into the
  // bigger terrain)
  shiftFor(lo, hi) {
    const { x0, x1, y0, y1 } = this.route.endpoints();
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const amp = this.terrainAmp(lo, hi);
    return (p) => {
      const o = terrainOffset(Math.max(lo, Math.min(hi, p))) * amp;
      return { x: (-dy / len) * o, y: (dx / len) * o };
    };
  }

  draw(ctx, t, camera) {
    const c = this.canvas;
    const { lo, hi } = camera;
    const sky = ctx.createLinearGradient(0, 0, 0, c.height);
    sky.addColorStop(0, '#100a20');
    sky.addColorStop(0.55, '#3a1e38');
    sky.addColorStop(1, '#7a3428');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, c.width, c.height);

    const { x0, x1, y0, y1 } = this.route.endpoints();

    // the jagged ridge line, sampled from the continuous terrain function
    // across just the visible [lo, hi] slice and stretched to fill the
    // canvas - the same technique mountain.js uses for the main silhouette,
    // applied to a diagonal instead of a peak
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const jitterAmp = this.terrainAmp(lo, hi);
    const span = hi - lo || 1e-6;

    const ridgeAt = (frac) => {
      const offset = terrainOffset(lo + span * frac);
      return {
        x: x0 + dx * frac + perpX * offset * jitterAmp,
        y: y0 + dy * frac + perpY * offset * jitterAmp,
      };
    };
    // fine enough to resolve the terrain's small octave now that the camera
    // window is narrow - 18 steps used to smooth it away
    // sampled past the route's own ends out to both canvas edges, so the
    // slope never visibly starts or stops inside the frame - the mountain's
    // beginning/end must never show, even with the camera parked at camp
    const fracStart = -x0 / (dx || 1);
    const fracEnd = (c.width - x0) / (dx || 1);
    const steps = 56;
    const ridge = [];
    for (let i = 0; i <= steps; i++) ridge.push(ridgeAt(fracStart + ((fracEnd - fracStart) * i) / steps));

    // fill the slope below the ridge down to the bottom of the canvas - a
    // bare stroked line floated in empty sky and never actually read as a
    // mountain, just a decorative squiggle
    const rockGrad = ctx.createLinearGradient(0, y1, 0, c.height);
    rockGrad.addColorStop(0, '#2a2350');
    rockGrad.addColorStop(1, '#14101f');
    ctx.fillStyle = rockGrad;
    ctx.beginPath();
    ctx.moveTo(ridge[0].x, c.height);
    for (const p of ridge) ctx.lineTo(p.x, p.y);
    ctx.lineTo(ridge[ridge.length - 1].x, c.height);
    ctx.closePath();
    ctx.fill();

    drawPebbles(ctx, lo, hi, ridgeAt, c.height);

    // the ridge line itself, as a lit edge on top of the fill
    ctx.strokeStyle = 'rgba(255,225,205,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ridge[0].x, ridge[0].y);
    for (const p of ridge.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    drawGrass(ctx, lo, hi, ridgeAt, t);
  }
}
