import { drawChick, drawContactShadow } from './chick.js';
import { drawOrb, drawOrbShadow, drawOrbTrail, drawOrbBurst } from './orb.js';
import { drawSpirit } from './spirit.js';
import { pickAccessory } from './accessories.js';

const ARRIVE_MS = 700;
const PLACING_MS = 950;
const ASCEND_MS = 3400;
const CLIMB_EASE_RATE = 5.0;
const SUMMIT_EASE_RATE = 8.0;
const MARKERS = [0.25, 0.5, 0.75];
const WAIT_IDLE_MS = 20000; // no activity ping for this long reads as "waiting"
const BURST_MS = 500;
const BODY_R = 13; // bumped up from the original 8 so the climb reads at a glance

// maps a 0..1 fraction to a "jewel tone" hue band (blue -> violet -> magenta
// -> red -> gold), deliberately skipping the murky yellow-green range so
// every task's palette reads as premium rather than a random rainbow
function jewelHue(frac) {
  return (200 + (((frac % 1) + 1) % 1) * 260) % 360;
}

// one task's full life: a new chick enters the world at camp, takes hold of
// its sphere, carries it along the mountain route while the task runs, then
// on completion dashes to the summit, sets the sphere down in a burst of
// light, and rises away as a spirit. This state machine is the whole visual
// metaphor and is intentionally unchanged from the earlier pass - only where
// positions come from (the route, not a bare lerp) and how much the world
// reacts around them has grown.
export class Task {
  constructor(id, laneX, phase, now) {
    this.id = id;
    this.laneX = laneX;
    this.phase = phase;
    this.lateralOffset = (laneX - 0.5) * 34;
    this.chickHue = jewelHue(phase / (Math.PI * 2));
    this.orbHue = jewelHue(phase / (Math.PI * 2) + 0.35);
    this.accessory = pickAccessory(phase);

    this.state = 'arriving';
    this.since = now;
    this.climbed = 0;
    this.climbTarget = 0;
    this.pulse = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.lastOrbX = 0;
    this.lastOrbY = 0;
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

  update(dt, now, route) {
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

  draw(ctx, route, t, now) {
    if (this.state === 'arriving') this.drawArriving(ctx, route, t);
    else if (this.state === 'climbing' || this.state === 'summiting') this.drawClimbing(ctx, route, t, now);
    else if (this.state === 'placing') this.drawPlacing(ctx, route, t, now);
    else if (this.state === 'ascending') this.drawAscending(ctx, t, now);
  }

  // the widget's whole-task render: the same pushing chick + sphere as the
  // main page, reused at a smaller scale with the extra dust/marker effects
  // dropped - the widget should read as the same world zoomed out, not a
  // separate abstract progress indicator.
  drawProgress(ctx, route, t, now) {
    const scale = 0.45;
    const bodyR = BODY_R * scale;

    if (this.state === 'ascending') {
      const elapsed = now - this.since;
      const frac = Math.min(elapsed / ASCEND_MS, 1);
      const base = route.pointAt(1, 0);
      const rise = 26 * Math.pow(frac, 0.7);
      const alpha = frac < 0.15 ? frac / 0.15 : 1 - Math.max(0, (frac - 0.6) / 0.4);
      this.lastX = base.x;
      this.lastY = base.y;
      drawSpirit(ctx, base.x, base.y - rise, Math.max(0, alpha), this.chickHue, t, this.phase);
      return;
    }

    const progress = this.state === 'placing' ? 1 : this.state === 'arriving' ? 0 : this.climbed;
    const pos = route.pointAt(progress, 0);
    const ahead = route.pointAt(Math.min(progress + 0.05, 1), 0);
    const facingLeft = ahead.x - pos.x < 0;
    this.lastX = pos.x;
    this.lastY = pos.y;

    const walkPhase = t * 0.5 + this.phase;
    drawContactShadow(ctx, pos.x, pos.y, scale);

    if (this.state === 'placing') {
      const elapsed = now - this.since;
      const frac = Math.min(elapsed / PLACING_MS, 1);
      const orbR = (17 * (1 - frac) + 3 * frac) * scale;
      const orbX = pos.x + 8 * scale * (1 - frac);
      const orbY = pos.y - 7 * scale * (1 - frac) - 2 * scale;
      if (frac < 1) drawOrb(ctx, orbX, orbY, orbR, this.orbHue, t, this.phase, 1, 1);
      drawChick(ctx, pos.x, pos.y, {
        bodyR,
        hue: this.chickHue,
        walkPhase,
        facingLeft: false,
        armsRaised: frac > 0.35,
        t,
      });
      return;
    }

    const pushDist = 18 * scale;
    const orbR = (10 + this.climbed * 7) * scale;
    const dirSign = facingLeft ? -1 : 1;
    const groundPt = { x: pos.x + dirSign * pushDist, y: pos.y };
    const orbY = groundPt.y - orbR;
    drawOrbShadow(ctx, groundPt.x, groundPt.y, orbR);
    drawOrb(ctx, groundPt.x, orbY, orbR, this.orbHue, t, this.phase, 1, this.climbed);
    drawChick(ctx, pos.x, pos.y, {
      bodyR,
      hue: this.chickHue,
      walkPhase,
      facingLeft,
      pushing: true,
      reachToward: { x: Math.abs(groundPt.x - pos.x) * 0.45, y: orbY - pos.y },
      t,
    });
  }

  drawMarkers(ctx, route, now) {
    for (const f of this.flashes) {
      const age = (now - f.at) / 600;
      const pt = route.pointAt(f.p, this.lateralOffset);
      ctx.globalAlpha = 1 - age;
      ctx.strokeStyle = `hsla(${this.orbHue}, 80%, 85%, 0.8)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4 + age * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawArriving(ctx, route, t) {
    const elapsed = Date.now() - this.since;
    const arriveFrac = Math.min(elapsed / ARRIVE_MS, 1);
    // a short walk-in within the camp itself, not an extrapolation of the
    // route (the route starts AT camp, it doesn't extend before it)
    const camp = route.pointAt(0, this.lateralOffset);
    const startOffset = 22 * (1 - arriveFrac);
    const walkPhase = t * 0.6 + this.phase;
    const px = camp.x + startOffset + Math.sin(walkPhase) * 3;
    const groundY = camp.y;
    this.lastX = px;
    this.lastY = groundY;

    drawContactShadow(ctx, px, groundY, BODY_R / 8);
    drawChick(ctx, px, groundY, {
      bodyR: BODY_R,
      hue: this.chickHue,
      walkPhase,
      facingLeft: startOffset > 1,
      idleFlap: Math.sin(t * 2.4 + this.phase) * 0.15,
      accessory: this.accessory,
      t,
    });

    // the sphere manifesting in its hands as it settles at camp
    if (arriveFrac > 0.35) {
      const growFrac = (arriveFrac - 0.35) / 0.65;
      const r = 9 * growFrac;
      const ox = px + 18;
      const oy = groundY - 18;
      drawOrb(ctx, ox, oy, r, this.orbHue, t, this.phase, growFrac, growFrac);
    }
  }

  drawClimbing(ctx, route, t, now) {
    const pulseAge = this.pulse ? now - this.pulse : 9999;
    // no activity for a long stretch reads as "waiting", not broken - the
    // chick settles into place and the sphere dims rather than the world
    // pretending nothing changed
    const waiting = this.state === 'climbing' && pulseAge > WAIT_IDLE_MS;

    const base = route.pointAt(this.climbed, this.lateralOffset);
    const ahead = route.pointAt(Math.min(this.climbed + 0.05, 1), this.lateralOffset);
    const upDx = ahead.x - base.x;
    const upDy = ahead.y - base.y;
    const upLen = Math.hypot(upDx, upDy) || 1;
    const dirX = upDx / upLen;
    const dirY = upDy / upLen;
    const facingLeft = dirX < 0;

    const speed = this.state === 'summiting' ? 1.4 : waiting ? 0.08 : 0.5;
    const walkPhase = t * speed + this.phase;
    const wobble = waiting ? 0 : Math.sin(walkPhase) * 2;
    const px = base.x + wobble;
    const groundY = base.y;
    this.lastX = px;
    this.lastY = groundY;

    const bump = !waiting && pulseAge < 400 ? 8 * (1 - pulseAge / 400) : 0;
    const bodyR = BODY_R + bump * 0.4;

    drawContactShadow(ctx, px, groundY, bodyR / 8);
    this.drawMarkers(ctx, route, now);

    // the sphere rests on the slope just uphill of the chick and gets
    // shoved along it, not carried - its ground contact point is a short
    // step along the same tangent used for facing direction (the route's
    // own waypoint-to-waypoint points are much too far apart to use
    // directly here), so it stays glued to the terrain under it
    const pushDist = 18;
    // cap how much a steep pitch can lift the sphere ahead of the chick -
    // without this it floats up near head height on the mountain's
    // steepest stretches and reads as carried again, not pushed
    const pushDirY = Math.max(dirY, -0.6);
    const orbR = 10 + this.climbed * 7;
    const strideKick = !waiting ? Math.sin(walkPhase * 3) : 0;
    const groundPt = { x: px + dirX * pushDist, y: groundY + pushDirY * pushDist };
    const orbX = groundPt.x;
    const orbY = groundPt.y - orbR + (waiting ? 0 : strideKick * 1.4);
    const orbGlow = waiting ? 0.45 : 1;
    if (this.lastOrbX) drawOrbTrail(ctx, orbX, orbY, this.lastOrbX, this.lastOrbY, orbR, this.orbHue, waiting ? 0 : this.climbed);
    this.lastOrbX = orbX;
    this.lastOrbY = orbY;
    drawOrbShadow(ctx, orbX, groundPt.y, orbR);
    drawOrb(ctx, orbX, orbY, orbR, this.orbHue, t, this.phase, orbGlow, this.climbed);

    // dust kicked up at the sphere's contact point on each downbeat -
    // cheap, stateless, but it's what sells "straining against it" over
    // just "standing next to it"
    if (!waiting && strideKick > 0.6) {
      const dustAlpha = (strideKick - 0.6) / 0.4;
      ctx.globalAlpha = dustAlpha * 0.3;
      ctx.fillStyle = '#cfae86';
      for (let i = 0; i < 3; i++) {
        const dist = 6 + i * 3;
        ctx.beginPath();
        ctx.arc(groundPt.x - dirX * dist, groundPt.y - dirY * dist + 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // pull the hand target back off the orb's center to its near surface,
    // so the hands land ON the sphere rather than reaching into its middle
    const reachDX = Math.abs(orbX - px);
    const reachDY = orbY - groundY;
    const reachDist = Math.hypot(reachDX, reachDY) || 1;
    const reachFrac = Math.max(0, reachDist - orbR * 0.75) / reachDist;

    drawChick(ctx, px, groundY, {
      bodyR,
      hue: this.chickHue,
      walkPhase,
      facingLeft,
      bump,
      pushing: true,
      strain: waiting ? 0 : strideKick * 0.06,
      idleFlap: waiting ? 0 : Math.sin(t * 2.4 + this.phase) * 0.15,
      excitedFlap: !waiting && pulseAge < 500 ? Math.sin(pulseAge * 0.05) * 0.7 * (1 - pulseAge / 500) : 0,
      // local space relative to the chick's feet (the draw origin), always a
      // forward-positive x since the whole chick gets mirrored as a group
      reachToward: { x: reachDX * reachFrac, y: reachDY * reachFrac },
      accessory: this.accessory,
      t,
    });
  }

  drawPlacing(ctx, route, t, now) {
    const elapsed = now - this.since;
    const frac = Math.min(elapsed / PLACING_MS, 1);
    const base = route.pointAt(1, this.lateralOffset);
    const px = base.x;
    const groundY = base.y;
    this.lastX = px;
    this.lastY = groundY;

    drawContactShadow(ctx, px, groundY, BODY_R / 8);

    // the sphere settles down and dissolves into the peak's own glow - the
    // task's effort feeding the mountain, not clutter left behind forever
    const settle = Math.min(frac / 0.5, 1);
    const dissolve = frac > 0.5 ? (frac - 0.5) / 0.5 : 0;
    const orbR = 17 * (1 - dissolve) + 3 * dissolve;
    const orbX = px + 18 * (1 - settle);
    const orbY = groundY - 15 * (1 - settle) - 6;
    if (dissolve < 1) drawOrb(ctx, orbX, orbY, orbR, this.orbHue, t, this.phase, 1 + dissolve * 1.5, 1);

    // the one-shot 100% burst, right as it lands
    if (elapsed < BURST_MS) drawOrbBurst(ctx, orbX, orbY, this.orbHue, elapsed / BURST_MS);

    drawChick(ctx, px, groundY, {
      bodyR: BODY_R,
      hue: this.chickHue,
      walkPhase: t * 0.6 + this.phase,
      facingLeft: false,
      armsRaised: frac > 0.35,
      idleFlap: Math.sin(t * 2.4 + this.phase) * 0.15,
      accessory: this.accessory,
      t,
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
