import { drawAccessory } from './accessories.js';

// a hand-drawn chick instead of a static emoji, so the legs can actually swing -
// no emoji glyph has walk-cycle frames, which is why every emoji-based attempt
// at "walking" kept reading as sliding, hopping, or swaying instead.
//
// opts: { bodyR, hue, walkPhase, facingLeft, bump, armsRaised, pushing, strain,
// reachToward, accessory, isLeader, sitting, eating }
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
    accessory = null,
    isLeader = false,
    sitting = false,
    eating = false,
    t = 0,
  } = opts;
  const bodyColor = `hsl(${hue}, 62%, 72%)`;
  const beakColor = `hsl(${(hue + 30) % 360}, 75%, 58%)`;
  const legL = bodyR;

  ctx.save();
  ctx.translate(px, groundY);
  // lean forward into the climb, before mirroring - defined in "facing right"
  // space so it always leans the same way no matter which way it's mirrored.
  // Pushing leans in hard, with a small per-stride surge as it drives into
  // the sphere - a raised-arms celebration and just sitting around both need
  // no lean at all.
  ctx.rotate(armsRaised || sitting ? 0 : pushing ? 0.36 + strain : 0.16);
  if (facingLeft) ctx.scale(-1, 1);

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
    bodyCy = -bodyR * 0.8;
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
    bodyCy = -legL - bodyR * 0.7;
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
  ctx.ellipse(0, bodyCy, bodyR, bodyR * 0.85, 0, 0, Math.PI * 2);
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

  // fluffy head tuft
  ctx.strokeStyle = beakColor;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-bodyR * 0.1, bodyCy - bodyR * 0.95);
  ctx.quadraticCurveTo(-bodyR * 0.45, bodyCy - bodyR * 1.5, bodyR * 0.05, bodyCy - bodyR * 1.15);
  ctx.stroke();

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

  // eye - white, pupil, and a little highlight dot for actual expression
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(bodyR * 0.3, bodyCy - bodyR * 0.45, bodyR * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20140a';
  ctx.beginPath();
  ctx.arc(bodyR * 0.38, bodyCy - bodyR * 0.45, bodyR * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(bodyR * 0.48, bodyCy - bodyR * 0.55, bodyR * 0.08, 0, Math.PI * 2);
  ctx.fill();

  if (accessory) drawAccessory(ctx, accessory, bodyR, bodyCy, hue, t);

  // leader crown: whoever is furthest along the climb gets this, so "who's
  // winning" reads at a glance without any text - a small gold zigzag with
  // a gem, floating just above the head tuft where no accessory ever sits
  if (isLeader) {
    const cy = bodyCy - bodyR * 1.35 - Math.sin(t * 3) * bodyR * 0.06;
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

  ctx.restore();

  return { bodyCy: groundY + bodyCy };
}

export function drawContactShadow(ctx, px, groundY, scale = 1) {
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(px, groundY + 12 * scale, 10 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
