import { drawChick, drawContactShadow } from './chick.js';
import { drawOrb, drawOrbShadow } from './orb.js';
import { drawSpirit } from './spirit.js';

const ARRIVE_MS = 700;
const PLACING_MS = 950;
const ASCEND_MS = 3400;
const CLIMB_EASE_RATE = 5.0;
const SUMMIT_EASE_RATE = 8.0;
const MARKERS = [0.25, 0.5, 0.75];

// maps a 0..1 fraction to a "jewel tone" hue band (blue -> violet -> magenta
// -> red -> gold), deliberately skipping the murky yellow-green range so
// every task's palette reads as premium rather than a random rainbow
function jewelHue(frac) {
  return (200 + (((frac % 1) + 1) % 1) * 260) % 360;
}

// one task's full life: a new chick enters the world, walks up and takes hold
// of its sphere, carries it up the mountain while the task runs, then on
// completion dashes to the summit, sets the sphere down, and rises away as a
// spirit of light. This state machine is the whole visual metaphor.
export class Task {
  constructor(id, laneX, phase, now) {
    this.id = id;
    this.laneX = laneX;
    this.phase = phase;
    this.chickHue = jewelHue(phase / (Math.PI * 2));
    this.orbHue = jewelHue(phase / (Math.PI * 2) + 0.35);

    this.state = 'arriving';
    this.since = now;
    this.climbed = 0;
    this.climbTarget = 0;
    this.pulse = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.passedMarkers = new Set();
    this.flashes = [];
  }

  activity(now) {
    this.pulse = now;
    if (this.state === 'climbing') {
      this.climbTarget = Math.min(this.climbTarget + 0.07, 0.92);
    }
  }

  // the task finished - dash to the summit, place the sphere, and rise away
  complete(now) {
    if (this.state === 'ascending' || this.state === 'placing') return;
    this.state = 'summiting';
    this.since = now;
  }

  get finished() {
    return this.state === 'ascending' && Date.now() - this.since > ASCEND_MS;
  }

  update(dt, now, mountain) {
    const elapsed = now - this.since;

    if (this.state === 'arriving') {
      if (elapsed >= ARRIVE_MS) {
        this.state = 'climbing';
        this.since = now;
      }
    } else if (this.state === 'climbing') {
      const ease = 1 - Math.exp(-dt * CLIMB_EASE_RATE);
      this.climbed += (this.climbTarget - this.climbed) * ease;
      this.checkMarkers(now);
    } else if (this.state === 'summiting') {
      const ease = 1 - Math.exp(-dt * SUMMIT_EASE_RATE);
      this.climbed += (1 - this.climbed) * ease;
      this.checkMarkers(now);
      if (this.climbed > 0.995) {
        this.climbed = 1;
        this.state = 'placing';
        this.since = now;
      }
    } else if (this.state === 'placing') {
      if (elapsed >= PLACING_MS) {
        this.state = 'ascending';
        this.since = now;
      }
    }

    // age out the little progress-point flashes
    this.flashes = this.flashes.filter((f) => now - f.at < 600);
  }

  checkMarkers(now) {
    for (const m of MARKERS) {
      if (this.climbed >= m && !this.passedMarkers.has(m)) {
        this.passedMarkers.add(m);
        this.flashes.push({ p: m, at: now });
      }
    }
  }

  draw(ctx, mountain, t, now) {
    if (this.state === 'arriving') this.drawArriving(ctx, mountain, t);
    else if (this.state === 'climbing' || this.state === 'summiting') this.drawClimbing(ctx, mountain, t, now);
    else if (this.state === 'placing') this.drawPlacing(ctx, mountain, t, now);
    else if (this.state === 'ascending') this.drawAscending(ctx, t, now);
  }

  drawMarkers(ctx, mountain, now) {
    for (const f of this.flashes) {
      const age = (now - f.at) / 600;
      const pt = mountain.pointAt(this.laneX, f.p);
      ctx.globalAlpha = 1 - age;
      ctx.strokeStyle = `hsla(${this.orbHue}, 80%, 85%, 0.8)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4 + age * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawArriving(ctx, mountain, t) {
    const elapsed = Date.now() - this.since;
    const arriveFrac = Math.min(elapsed / ARRIVE_MS, 1);
    const progress = -0.045 * (1 - arriveFrac);
    const base = mountain.pointAt(this.laneX, progress);
    const walkPhase = t * 0.6 + this.phase;
    const px = base.x + Math.sin(walkPhase) * 3;
    const groundY = base.y;
    this.lastX = px;
    this.lastY = groundY;

    drawContactShadow(ctx, px, groundY);
    drawChick(ctx, px, groundY, {
      bodyR: 8,
      hue: this.chickHue,
      walkPhase,
      facingLeft: false,
      idleFlap: Math.sin(t * 2.4 + this.phase) * 0.15,
    });

    // the sphere manifesting in its hands as it settles at the mountain's foot
    if (arriveFrac > 0.35) {
      const growFrac = (arriveFrac - 0.35) / 0.65;
      const r = 6 * growFrac;
      const ox = px + 12;
      const oy = groundY - 13;
      drawOrb(ctx, ox, oy, r, this.orbHue, t, this.phase, growFrac);
    }
  }

  drawClimbing(ctx, mountain, t, now) {
    const base = mountain.pointAt(this.laneX, this.climbed);
    const ahead = mountain.pointAt(this.laneX, Math.min(this.climbed + 0.05, 1));
    const upDx = ahead.x - base.x;
    const upDy = ahead.y - base.y;
    const upLen = Math.hypot(upDx, upDy) || 1;
    const dirX = upDx / upLen;
    const dirY = upDy / upLen;
    const facingLeft = dirX < 0;

    const speed = this.state === 'summiting' ? 1.4 : 0.6;
    const walkPhase = t * speed + this.phase;
    const wobble = Math.sin(walkPhase) * 3;
    const px = base.x + wobble;
    const groundY = base.y;
    this.lastX = px;
    this.lastY = groundY;

    const pulseAge = this.pulse ? now - this.pulse : 9999;
    const bump = pulseAge < 400 ? 8 * (1 - pulseAge / 400) : 0;
    const bodyR = 8 + bump * 0.3;
    const legL = 8;
    const bodyCy = groundY - legL - bodyR * 0.7;

    drawContactShadow(ctx, px, groundY);
    this.drawMarkers(ctx, mountain, now);

    // the sphere, carried just uphill of the chick's hands as it's borne to
    // the summit - not pushed along the ground, held
    const carryDist = 14;
    const orbR = 6.5 + this.climbed * 4.5;
    const orbX = px + dirX * carryDist;
    const orbY = bodyCy - bodyR * 0.2 + dirY * carryDist * 0.5;
    drawOrbShadow(ctx, orbX, groundY + 10, orbR);
    drawOrb(ctx, orbX, orbY, orbR, this.orbHue, t, this.phase);

    drawChick(ctx, px, groundY, {
      bodyR,
      hue: this.chickHue,
      walkPhase,
      facingLeft,
      bump,
      idleFlap: Math.sin(t * 2.4 + this.phase) * 0.15,
      excitedFlap: pulseAge < 500 ? Math.sin(pulseAge * 0.05) * 0.7 * (1 - pulseAge / 500) : 0,
      // local space relative to the chick's feet (the draw origin), always a
      // forward-positive x since the whole chick gets mirrored as a group
      reachToward: { x: Math.abs(orbX - px) + bodyR * 0.5, y: orbY - groundY },
    });
  }

  drawPlacing(ctx, mountain, t, now) {
    const elapsed = now - this.since;
    const frac = Math.min(elapsed / PLACING_MS, 1);
    const base = mountain.pointAt(this.laneX, 1);
    const px = base.x;
    const groundY = base.y;
    this.lastX = px;
    this.lastY = groundY;

    drawContactShadow(ctx, px, groundY);

    // the sphere settles down and dissolves into the peak's own glow - the
    // task's effort feeding the mountain, not clutter left behind forever
    const settle = Math.min(frac / 0.5, 1);
    const dissolve = frac > 0.5 ? (frac - 0.5) / 0.5 : 0;
    const orbR = (6.5 + 4.5) * (1 - dissolve) + 2 * dissolve;
    const orbX = px + 12 * (1 - settle);
    const orbY = groundY - 10 * (1 - settle) - 4;
    if (dissolve < 1) drawOrb(ctx, orbX, orbY, orbR, this.orbHue, t, this.phase, 1 + dissolve * 1.5);

    drawChick(ctx, px, groundY, {
      bodyR: 8,
      hue: this.chickHue,
      walkPhase: t * 0.6 + this.phase,
      facingLeft: false,
      armsRaised: frac > 0.35,
      idleFlap: Math.sin(t * 2.4 + this.phase) * 0.15,
    });
  }

  drawAscending(ctx, t, now) {
    const elapsed = now - this.since;
    const frac = Math.min(elapsed / ASCEND_MS, 1);
    const rise = 90 * Math.pow(frac, 0.7);
    const alpha = frac < 0.15 ? frac / 0.15 : 1 - Math.max(0, (frac - 0.6) / 0.4);
    const sway = Math.sin(t * 1.6 + this.phase) * 8;
    drawSpirit(ctx, this.lastX + sway, this.lastY - rise, Math.max(0, alpha), this.chickHue, t, this.phase);
  }
}
