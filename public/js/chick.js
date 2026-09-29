import { drawHat } from './accessories.js';

// a hand-drawn chick instead of a static emoji, so the legs can actually swing -
// no emoji glyph has walk-cycle frames, which is why every emoji-based attempt
// at "walking" kept reading as sliding, hopping, or swaying instead.
//
// opts: { bodyR, hue, look, walkPhase, facingLeft, bump, armsRaised, pushing,
// strain, reachToward, isLeader, sitting, eating, happy, sweat }
// look: the chick's character from look.js (colors, tuft, eyes, hat) - when
// absent it falls back to plain hue-derived colors and the default face.
// happy: closed ^^ eyes (summit). sweat: 0..1, a bead of sweat in a storm.
// gaze: {x,y} -1..1 where the pupils look, in the chick's own facing space
// (x>0 ahead, x<0 back over its shoulder, y<0 up). blink: eyes shut this
// frame. tilt: extra lean around the feet (>0 forward, <0 back, as when
// looking up). tired: 0..1 heavy eyelids.
// reachToward: {x,y} in the chick's local "facing right" space to reach an arm
// (or, while pushing, both arms) toward the sphere, or null for a relaxed arm.
// sitting: a relaxed, upright, legs-tucked idle pose (for when there's
// nothing to climb toward) instead of the walking/leaning ones below.
export function drawChick(ctx, px, groundY, opts) {
  const {
    bodyR,
    hue,
    walkPhase,
    facingLeft,
    bump = 0,
    armsRaised = false,
    pushing = false,
    strain = 0,
    reachToward = null,
    look = null,
    isLeader = false,
    sitting = false,
    eating = false,
    happy = false,
    sweat = 0,
    gaze = null,
    blink = false,
    tilt = 0,
    tired = 0,
    t = 0,
  } = opts;
  const bodyColor = look ? look.body : `hsl(${hue}, 62%, 72%)`;
  const beakColor = look ? look.accent : `hsl(${(hue + 30) % 360}, 75%, 58%)`;
  const hat = look ? look.hat : 'none';
  const legL = bodyR;

  ctx.save();
  ctx.translate(px, groundY);
  // lean forward into the climb, before mirroring - defined in "facing right"
  // space so it always leans the same way no matter which way it's mirrored.
  // Kept small on purpose: a hard lean plus the wide body read as the chick
  // lying flat and swimming up the slope - it should stand on its feet, only
  // nodding into each push. A raised-arms celebration and just sitting
  // around both need no lean at all.
  ctx.rotate(armsRaised || sitting ? 0 : pushing ? 0.1 + strain * 0.5 : 0.05);
  if (facingLeft) ctx.scale(-1, 1);
  // after the mirror, so forward/back mean the same thing both ways
  if (tilt) ctx.rotate(tilt);

  let bodyCy;
  if (sitting) {
    // legs tucked under - a low, squashed-wide seated silhouette instead of
    // the walking scissor gait
    ctx.strokeStyle = beakColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-bodyR * 0.35, -bodyR * 0.3);
    ctx.lineTo(-bodyR * 0.35, 0);
    ctx.moveTo(bodyR * 0.35, -bodyR * 0.3);
    ctx.lineTo(bodyR * 0.35, 0);
    ctx.stroke();
    bodyCy = -bodyR * 0.95;
  } else {
    // legs: two lines swinging in opposite phase - a real scissor gait
    ctx.strokeStyle = beakColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const legOffset of [0, Math.PI]) {
      const swing = Math.sin(walkPhase * 3 + legOffset) * 0.5;
      const hipY = -legL;
      const footX = Math.sin(swing) * legL;
      const footY = hipY + Math.cos(swing) * legL;
      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(footX, footY);
      ctx.stroke();
    }
    bodyCy = -legL - bodyR * 0.85;
  }

  // arm(s): reaching toward the carried orb, or both raised for the summit
  // celebration
  ctx.strokeStyle = beakColor;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if (armsRaised) {
    ctx.beginPath();
    ctx.moveTo(bodyR * 0.2, bodyCy - bodyR * 0.6);
    ctx.lineTo(bodyR * 0.9, bodyCy - bodyR * 2.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-bodyR * 0.2, bodyCy - bodyR * 0.6);
    ctx.lineTo(-bodyR * 0.7, bodyCy - bodyR * 2.1);
    ctx.stroke();
  } else if (reachToward && !pushing) {
    ctx.beginPath();
    ctx.moveTo(bodyR * 0.3, bodyCy - bodyR * 0.2);
    ctx.lineTo(reachToward.x, reachToward.y);
    ctx.stroke();
  }

  // wing on its back - a gentle idle flap all the time, plus an excited
  // flurry right after a tool call, so it visibly reacts to what it's doing
  const idleFlap = opts.idleFlap ?? 0;
  const excitedFlap = opts.excitedFlap ?? 0;
  ctx.save();
  ctx.translate(-bodyR * 0.55, bodyCy + bodyR * 0.1);
  ctx.rotate(-0.3 + idleFlap + excitedFlap);
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyR * 0.6, bodyR * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // body
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  // an upright egg (taller than wide) - a wide one read as a body lying down
  ctx.ellipse(0, bodyCy, bodyR * 0.88, bodyR, 0, 0, Math.PI * 2);
  ctx.fill();

  // pushing arms are drawn AFTER the body, not with the other arm poses
  // above - the reach here is short (hands braced right against the
  // sphere), so drawing them before the body silhouette buried them
  if (pushing && reachToward) {
    ctx.strokeStyle = beakColor;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.8;
    for (const dy of [-bodyR * 0.28, bodyR * 0.32]) {
      ctx.beginPath();
      ctx.moveTo(bodyR * 0.55, bodyCy + dy * 0.2);
      ctx.lineTo(reachToward.x, reachToward.y + dy);
      ctx.stroke();
    }
  }

  // head tuft - hidden under the hats that cover the crown of the head
  if (hat !== 'beanie' && hat !== 'tophat') drawTuft(ctx, look ? look.tuft : 'curl', bodyR, bodyCy, beakColor);

  // beak, pointing the way it's facing
  ctx.fillStyle = beakColor;
  ctx.beginPath();
  ctx.moveTo(bodyR * 0.7, bodyCy - bodyR * 0.15);
  ctx.lineTo(bodyR * 0.7 + 5, bodyCy - bodyR * 0.3);
  ctx.lineTo(bodyR * 0.7 + 5, bodyCy);
  ctx.closePath();
  ctx.fill();

  // a small apple held up near the beak, its bite mark slowly deepening and
  // resetting - cheap, stateless, but enough to sell "snacking" over just
  // "sitting near a red dot"
  if (eating) {
    const nibble = (Math.sin(t * 1.2) + 1) / 2; // 0..1, slow enough to read as a bite, not a flicker
    const ax = bodyR * 1.25;
    const ay = bodyCy - bodyR * 0.1;
    const appleR = bodyR * 0.3;
    ctx.fillStyle = '#5a7a4a';
    ctx.beginPath();
    ctx.moveTo(ax, ay - appleR);
    ctx.lineTo(ax, ay - appleR - bodyR * 0.18);
    ctx.stroke();
    ctx.strokeStyle = '#5a7a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay - appleR);
    ctx.lineTo(ax, ay - appleR - bodyR * 0.18);
    ctx.stroke();
    ctx.fillStyle = '#df4a3a';
    ctx.beginPath();
    ctx.arc(ax, ay, appleR, 0.3, Math.PI * 2 - 0.3 - nibble * 1.1, false);
    ctx.lineTo(ax, ay);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,20,15,0.4)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // blush
  ctx.fillStyle = 'rgba(255,110,140,0.4)';
  ctx.beginPath();
  ctx.arc(bodyR * 0.4, bodyCy - bodyR * 0.05, bodyR * 0.22, 0, Math.PI * 2);
  ctx.fill();

  drawEye(ctx, happy ? 'happy' : blink ? 'closed' : look ? look.eyes : 'default', bodyR, bodyCy, bodyColor, gaze, tired);

  if (sweat > 0.05) {
    // a bead that slides down the back of the head and restarts
    const slide = (t * 0.8) % 1;
    const sx = -bodyR * 0.35;
    const sy = bodyCy - bodyR * 0.95 + slide * bodyR * 0.5;
    const sr = bodyR * 0.17;
    ctx.globalAlpha = Math.min(1, sweat * 1.4) * (1 - slide * 0.6);
    ctx.fillStyle = '#6cc8ff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(0.8, bodyR * 0.06);
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI);
    ctx.lineTo(sx, sy - sr * 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  let headTop;
  const hatLift = look ? drawHat(ctx, hat, bodyR, bodyCy, look.hatColor, t) : 0;

  // leader crown: whoever is furthest along the climb gets this, so "who's
  // winning" reads at a glance without any text - a small gold zigzag with
  // a gem, floating just above the head tuft where no accessory ever sits
  if (isLeader) {
    const cy = bodyCy - bodyR * 1.35 - hatLift - Math.sin(t * 3) * bodyR * 0.06;
    const cw = bodyR * 0.5;
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    ctx.moveTo(-cw, cy + bodyR * 0.22);
    ctx.lineTo(-cw, cy - bodyR * 0.05);
    ctx.lineTo(-cw * 0.5, cy + bodyR * 0.12);
    ctx.lineTo(0, cy - bodyR * 0.2);
    ctx.lineTo(cw * 0.5, cy + bodyR * 0.12);
    ctx.lineTo(cw, cy - bodyR * 0.05);
    ctx.lineTo(cw, cy + bodyR * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,75,10,0.6)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = '#ff5f6d';
    ctx.beginPath();
    ctx.arc(0, cy - bodyR * 0.12, bodyR * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  // how high above the feet the chick reaches (hat and crown included), so
  // a name label can float just over it - the lean is small enough to ignore
  headTop = bodyCy - bodyR * (isLeader ? 1.65 : 1.15) - hatLift;

  ctx.restore();

  return { bodyCy: groundY + bodyCy, headY: groundY + headTop };
}

export function drawContactShadow(ctx, px, groundY, scale = 1) {
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  // right under the feet - the old +12 offset dated from the emoji chick,
  // whose glyph sat higher, and left every drawn chick floating over its shadow
  ctx.ellipse(px, groundY + 1.5 * scale, 10 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawTuft(ctx, type, R, cy, color) {
  const top = cy - R * 0.95;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.2, R * 0.11);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (type === 'spikes') {
    for (const dx of [-0.28, 0, 0.26]) {
      ctx.moveTo(dx * R, top + R * 0.05);
      ctx.lineTo(dx * R * 1.5, top - R * 0.42);
    }
    ctx.stroke();
  } else if (type === 'mohawk') {
    ctx.moveTo(-R * 0.5, top + R * 0.12);
    const peaks = [-0.38, -0.12, 0.14];
    for (const px of peaks) {
      ctx.lineTo(px * R, top - R * 0.45);
      ctx.lineTo((px + 0.13) * R, top - R * 0.02);
    }
    ctx.lineTo(R * 0.3, top + R * 0.1);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'messy') {
    ctx.moveTo(-R * 0.2, top);
    ctx.quadraticCurveTo(-R * 0.65, top - R * 0.45, -R * 0.1, top - R * 0.3);
    ctx.moveTo(0, top);
    ctx.quadraticCurveTo(R * 0.1, top - R * 0.6, R * 0.35, top - R * 0.25);
    ctx.moveTo(-R * 0.05, top);
    ctx.quadraticCurveTo(-R * 0.2, top - R * 0.55, R * 0.05, top - R * 0.5);
    ctx.stroke();
  } else {
    // curl - the original single fluffy tuft
    ctx.moveTo(-R * 0.1, top);
    ctx.quadraticCurveTo(-R * 0.45, cy - R * 1.5, R * 0.05, cy - R * 1.15);
    ctx.stroke();
  }
}

function drawEye(ctx, type, R, cy, bodyColor, gaze = null, tired = 0) {
  const ex = R * 0.3;
  const ey = cy - R * 0.45;
  const dark = '#20140a';
  // how far the pupil sits from its resting spot - small, or the eye reads
  // as crossed rather than glancing
  const gx = gaze ? gaze.x * R * 0.1 : 0;
  const gy = gaze ? gaze.y * R * 0.09 : 0;

  if (type === 'closed') {
    // a blink: a short soft arc where the eye was
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, R * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - R * 0.2, ey + R * 0.02);
    ctx.quadraticCurveTo(ex, ey + R * 0.12, ex + R * 0.2, ey + R * 0.02);
    ctx.stroke();
    return;
  }

  if (type === 'happy') {
    // closed, smiling ^ - the summit face
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1.2, R * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - R * 0.2, ey + R * 0.06);
    ctx.lineTo(ex, ey - R * 0.14);
    ctx.lineTo(ex + R * 0.2, ey + R * 0.06);
    ctx.stroke();
    return;
  }

  if (type === 'curious') {
    // small beady eye with a raised brow - no white, reads as "hm?"
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(ex + R * 0.06 + gx * 0.6, ey + gy * 0.6, R * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex + R * 0.11 + gx * 0.6, ey - R * 0.06 + gy * 0.6, R * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, R * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ex + R * 0.06, ey - R * 0.1, R * 0.25, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    return;
  }

  const big = type === 'sparkle';
  const whiteR = R * (big ? 0.36 : 0.3);
  const pupilR = R * (big ? 0.22 : 0.18);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ex, ey, whiteR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(ex + R * 0.08 + gx, ey + gy, pupilR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ex + R * 0.18 + gx, ey - R * 0.1 + gy, R * (big ? 0.1 : 0.08), 0, Math.PI * 2);
  ctx.fill();
  if (big) {
    ctx.beginPath();
    ctx.arc(ex + R * 0.0 + gx, ey + R * 0.1 + gy, R * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // tiredness: an upper lid in the body color sliding down over the eye
  // (the 'sleepy' look below already has its own, heavier one)
  if (tired > 0.05 && type !== 'sleepy') {
    const lid = whiteR * 2 * Math.min(0.55, tired * 0.55);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, whiteR + 0.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = bodyColor;
    ctx.fillRect(ex - whiteR - 1, ey - whiteR - 1, whiteR * 2 + 2, lid + 1);
    ctx.restore();
  }

  if (type === 'sleepy') {
    // heavy upper lid in the body color, covering the top half of the eye
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(ex, ey, whiteR + 0.5, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, R * 0.08);
    ctx.beginPath();
    ctx.moveTo(ex - whiteR, ey);
    ctx.lineTo(ex + whiteR, ey);
    ctx.stroke();
  } else if (type === 'determined') {
    // brow slanting down toward the beak
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1.2, R * 0.11);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - R * 0.25, ey - R * 0.42);
    ctx.lineTo(ex + R * 0.28, ey - R * 0.26);
    ctx.stroke();
  }
}
