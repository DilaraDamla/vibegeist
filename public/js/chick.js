import { drawAccessory } from './accessories.js';

// a hand-drawn chick instead of a static emoji, so the legs can actually swing -
// no emoji glyph has walk-cycle frames, which is why every emoji-based attempt
// at "walking" kept reading as sliding, hopping, or swaying instead.
//
// opts: { bodyR, hue, walkPhase, facingLeft, bump, armsRaised, reachToward, accessory }
// reachToward: {x,y} in the chick's local "facing right" space to reach an arm
// toward (the carried orb), or null for a relaxed arm.
export function drawChick(ctx, px, groundY, opts) {
  const { bodyR, hue, walkPhase, facingLeft, bump = 0, armsRaised = false, reachToward = null, accessory = null, t = 0 } = opts;
  const bodyColor = `hsl(${hue}, 62%, 72%)`;
  const beakColor = `hsl(${(hue + 30) % 360}, 75%, 58%)`;
  const legL = 8;

  ctx.save();
  ctx.translate(px, groundY);
  // lean forward into the climb, before mirroring - defined in "facing right"
  // space so it always leans the same way no matter which way it's mirrored
  ctx.rotate(armsRaised ? 0 : 0.16);
  if (facingLeft) ctx.scale(-1, 1);

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

  const bodyCy = -legL - bodyR * 0.7;

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
  } else if (reachToward) {
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

  ctx.restore();

  return { bodyCy: groundY + bodyCy };
}

export function drawContactShadow(ctx, px, groundY) {
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(px, groundY + 12, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
