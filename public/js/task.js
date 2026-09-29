import { drawChick, drawContactShadow } from './chick.js';
import { drawOrb, drawOrbShadow, drawOrbTrail, drawOrbBurst } from './orb.js';
import { drawSpirit } from './spirit.js';
import { pickLook } from './look.js';
import { WAYPOINTS } from './route.js';
import { hashRand } from './utils.js';

const ARRIVE_MS = 700;
const PLACING_MS = 950;
const ASCEND_MS = 3400;
const CLIMB_EASE_RATE = 5.0;
const SUMMIT_EASE_RATE = 8.0;
// the real named landmarks between camp and peak (excluding those two
// endpoints, which already have their own arrival/placing ceremonies) -
// passing one now lights up that actual place, not just a milestone number
const LANDMARKS = WAYPOINTS.filter((wp) => wp.p > 0 && wp.p < 1);
// each activity ping climbs one step; the last stretch is only ever covered
// by the summit dash when the turn actually finishes
const STEP = 0.07;
const STEP_CAP = 0.92;
export function stepsToProgress(steps) {
  return Math.min(steps * STEP, STEP_CAP);
}
const WAIT_IDLE_MS = 20000;
const EMOTE_MS = 2200;
const CHEER_MS = 1600;
const STUMBLE_MS = 600;
const GLANCE_SLOT_S = 7; // an idle glance may start once per slot...
const GLANCE_S = 1.4; // ...and lasts this long
// how each eye type tends to behave - a little personality, from the same
// seed as the look: curious ones look around a lot, determined ones keep
// their eyes on the climb and rarely trip, sleepy ones tire early
const TEMPERAMENT = {
  curious: { glance: 0.75, tire: 1, stumble: 1 },
  sparkle: { glance: 0.5, tire: 0.8, stumble: 1 },
  determined: { glance: 0.2, tire: 0.5, stumble: 0.4 },
  sleepy: { glance: 0.35, tire: 1.6, stumble: 1.2 },
  default: { glance: 0.45, tire: 1, stumble: 1 },
};
const EFFECT_MS = 1400;
export const EMOTE_ICONS = { wave: '👋', dance: '💃', heart: '❤️', taunt: '😤' }; // no activity ping for this long reads as "waiting"
const BURST_MS = 500;
// how big chicks/orbs/gravestones draw in the compact widget, relative to the
// main view - one shared knob so the widget stays consistent when tuned
export const WIDGET_SCALE = 0.9;
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
  // takenColors: palette indexes worn by the chicks already on the mountain
  constructor(id, laneX, phase, now, takenColors = new Set(), name = '') {
    this.id = id;
    this.name = name;
    // where this frame's chick was drawn, for the name label (null = not drawn)
    this.labelAt = null;
    this.laneX = laneX;
    this.phase = phase;
    this.lateralOffset = (laneX - 0.5) * 34;
    this.look = pickLook(id, takenColors);
    this.chickHue = this.look.hue;
    this.orbHue = jewelHue(phase / (Math.PI * 2) + 0.35);

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
    this.overtakeAt = 0; // set by main.js when this task passes another - drives the widget's bounce
    this.effect = null; // { kind: 'boost' | 'slip', at } from an item box
    this.emote = null; // { kind, at } sent by the chick's own player from the page
    this.champion = false; // most summits this week - a 👑 by the name
    this.streak = 0; // days in a row with a summit
    this.joinedAt = now;
    this.lookAt = null; // { x, y, until } - something happening nearby, set by main.js
    this.neighbor = null; // { x, y } of the closest other chick, set by main.js
    this.peakAt = null; // { x, y } of the summit on the active route, set by main.js
    this.cheerAt = 0; // another chick just summited
    this.stumbleAt = 0;
    this.seed = Math.floor(phase * 1000);
    this.temper = TEMPERAMENT[this.look.eyes] || TEMPERAMENT.default;
  }

  // steps: the server's count of activity pings this turn - when present it
  // sets the target outright, so every viewer sees the same position
  // instead of each counting from whenever their page happened to open
  activity(now, steps) {
    this.pulse = now;
    // the odd misstep on the way up - rare, and rarer for determined ones
    if (this.state === 'climbing' && this.climbed > 0.05 && Math.random() < 0.04 * this.temper.stumble) this.stumbleAt = now;
    if (steps !== undefined) this.climbTarget = stepsToProgress(steps);
    else if (this.state === 'climbing') this.climbTarget = Math.min(this.climbTarget + STEP, STEP_CAP);
  }

  // a viewer connecting mid-race: jump straight to the server's position
  syncSteps(steps = 0) {
    this.climbTarget = this.climbed = stepsToProgress(steps);
  }

  // one short line for the race panel, so nobody has to guess what the
  // chick is doing from its pose alone
  status(now) {
    if (this.state === 'arriving') return 'yola çıktı';
    if (this.state === 'summiting' || this.state === 'placing') return 'zirveye koşuyor!';
    if (this.state === 'ascending') return '🏁 zirvede!';
    return now - (this.pulse || this.since) > WAIT_IDLE_MS ? 'soluklanıyor' : 'tırmanıyor';
  }

  // 0..100 as shown in the race panel - the summit dash counts as the finish
  get percent() {
    return this.state === 'placing' || this.state === 'ascending' ? 100 : Math.round(this.climbed * 100);
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
    this.flashes = this.flashes.filter((f) => now - f.at < 900);
  }

  checkMarkers(now) {
    for (const wp of LANDMARKS) {
      if (this.climbed >= wp.p && !this.passedMarkers.has(wp.name)) {
        this.passedMarkers.add(wp.name);
        this.flashes.push({ wp, at: now });
      }
    }
  }

  draw(ctx, route, t, now, isLeader = false, storm = 0) {
    this.labelAt = null;
    if (this.state === 'arriving') this.drawArriving(ctx, route, t, isLeader);
    else if (this.state === 'climbing' || this.state === 'summiting') this.drawClimbing(ctx, route, t, now, isLeader, storm);
    else if (this.state === 'placing') this.drawPlacing(ctx, route, t, now, isLeader);
    else if (this.state === 'ascending') this.drawAscending(ctx, t, now);
  }

  // the widget's whole-task render: the same pushing chick + sphere as the
  // main page, reused at a smaller scale with the extra dust/marker effects
  // dropped - the widget should read as the same world zoomed out, not a
  // separate abstract progress indicator.
  drawProgress(ctx, route, t, now, isLeader = false, storm = 0) {
    this.labelAt = null;
    const scale = WIDGET_SCALE;
    // a short pop right after overtaking another task - the widget's only
    // stand-in for the main view's activity-pulse bump, since a small
    // corner window needs its own visual payoff for the overtake sound
    const overtakeAge = now - this.overtakeAt;
    const overtakeBump = this.overtakeAt && overtakeAge < 400 ? 1 + 0.22 * (1 - overtakeAge / 400) : 1;
    const bodyR = BODY_R * scale * overtakeBump;

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

    // the widget has no lanes (lateral offset would sink chicks into the
    // rock), so chicks at the same progress - everyone who just started -
    // stood exactly on top of each other. A small forward stagger by lane
    // keeps each one visible without noticeably distorting the race.
    const stagger = this.laneX * 0.024;
    const progress = this.state === 'placing' ? 1 : Math.min(1, (this.state === 'arriving' ? 0 : this.climbed) + stagger);
    const pos = route.pointAt(progress, 0);
    const ahead = route.pointAt(Math.min(progress + 0.05, 1), 0);
    const facingLeft = ahead.x - pos.x < 0;
    this.lastX = pos.x;
    this.lastY = pos.y;

    const walkPhase = t * 0.5 + this.phase;

    if (this.state === 'placing') {
      drawContactShadow(ctx, pos.x, pos.y, scale);
      this.drawMarkers(ctx, route, now);
      const elapsed = now - this.since;
      const frac = Math.min(elapsed / PLACING_MS, 1);
      const orbR = (17 * (1 - frac) + 3 * frac) * scale;
      const orbX = pos.x + 8 * scale * (1 - frac);
      const orbY = pos.y - 7 * scale * (1 - frac) - 2 * scale;
      if (frac < 1) drawOrb(ctx, orbX, orbY, orbR, this.orbHue, t, this.phase, 1, 1);
      // the one-shot summit burst, scaled down to fit the widget - without
      // this the widget's summit moment was just a shrinking orb, no payoff
      if (elapsed < BURST_MS) drawOrbBurst(ctx, orbX, orbY, this.orbHue, elapsed / BURST_MS);
      this.drawChickAt(ctx, pos.x, pos.y, {
        bodyR,
        hue: this.chickHue,
        look: this.look,
        walkPhase,
        facingLeft: false,
        armsRaised: frac > 0.35,
        happy: frac > 0.35,
        isLeader,
        t,
      });
      return;
    }

    // a storm staggers the push sideways here too, same as the main view -
    // the widget should feel the weather, not just show a calmer replica
    const wobble = this.state === 'arriving' ? 0 : Math.sin(walkPhase) * (2 + storm * 7) * scale;
    const px = pos.x + wobble;
    drawContactShadow(ctx, px, pos.y, scale);
    if (this.state !== 'arriving') this.drawMarkers(ctx, route, now);

    const pushDist = 18 * scale;
    const orbR = (10 + this.climbed * 7) * scale;
    const dirSign = facingLeft ? -1 : 1;
    const groundPt = { x: px + dirSign * pushDist, y: pos.y };
    const orbY = groundPt.y - orbR;
    drawOrbShadow(ctx, groundPt.x, groundPt.y, orbR);
    drawOrb(ctx, groundPt.x, orbY, orbR, this.orbHue, t, this.phase, 1, this.climbed);
    this.drawChickAt(ctx, px, pos.y, {
      bodyR,
      hue: this.chickHue,
      look: this.look,
      walkPhase,
      facingLeft,
      pushing: true,
      reachToward: { x: Math.abs(groundPt.x - px) * 0.45, y: orbY - pos.y },
      sweat: storm,
      isLeader,
      t,
    });
  }

  // lights up the actual landmark just passed (its real position on the
  // mountain, not the task's own lane) - a soft glow plus an expanding
  // ring, like the place itself is answering "yes, you were here"
  // every chick pose goes through here, so emotes and item effects apply
  // the same way to every state and to both the main view and the widget
  // what the chick is paying attention to this frame: blinking, glancing
  // around or at a neighbor, looking toward something that just happened,
  // tiring on a long climb, perking up near the top, cheering when someone
  // else summits, the odd stumble. Returns overrides for drawChick plus a
  // hop height.
  mind(now, px, groundY, opts) {
    const sec = now / 1000;
    const r = opts.bodyR;
    const out = {};
    let hop = 0;
    const eyeY = groundY - r * 2.2;
    const toward = (p) => {
      const dx = p.x - px;
      const dy = p.y - eyeY;
      const lx = opts.facingLeft ? -dx : dx;
      const len = Math.hypot(lx, dy) || 1;
      return { x: lx / len, y: dy / len };
    };

    if (!opts.happy) {
      const period = 3.1 + (this.phase % 1.9);
      if ((sec + this.phase * 5) % period < 0.12) out.blink = true;
    }

    const climbing = this.state === 'climbing';
    const nearTop = climbing && this.climbed > 0.78;
    if (this.lookAt && now < this.lookAt.until) {
      out.gaze = toward(this.lookAt);
    } else if (nearTop && this.peakAt && (sec + this.phase) % 5 < 2) {
      // the summit is right there - keep glancing up at it
      out.gaze = toward(this.peakAt);
    } else {
      const slot = Math.floor((sec + this.phase * 7) / GLANCE_SLOT_S);
      const inSlot = (sec + this.phase * 7) % GLANCE_SLOT_S;
      const roll = hashRand(slot * 131 + this.seed);
      if (inSlot < GLANCE_S && roll < this.temper.glance) {
        const kind = hashRand(slot * 17 + this.seed + 5);
        if (this.neighbor && kind < 0.4) out.gaze = toward(this.neighbor);
        else if (kind < 0.6) out.gaze = { x: -0.9, y: -0.2 }; // back down the trail
        else if (kind < 0.8) out.gaze = { x: 0.3, y: -0.95 }; // up at the sky
        else out.gaze = { x: 0.8, y: 0.6 }; // down at the orb
      }
    }
    // a long look up tips the head back a touch
    if (out.gaze && out.gaze.y < -0.7) out.tilt = -0.1;

    if (climbing) {
      // tiredness creeps in after a couple of minutes of climbing, and the
      // last stretch perks it right back up
      const mins = (now - this.joinedAt) / 60000;
      const tired = Math.min(0.85, Math.max(0, (mins - 2) / 4) * this.temper.tire);
      out.tired = nearTop ? tired * 0.3 : tired;
      if (nearTop && now - this.pulse < 1500) out.excitedFlap = Math.sin(sec * 14) * 0.5;
    }

    const cheer = now - this.cheerAt;
    if (cheer < CHEER_MS) {
      const f = cheer / CHEER_MS;
      hop = Math.abs(Math.sin(f * Math.PI * 3)) * r * 0.55 * (1 - f);
      out.excitedFlap = Math.sin(sec * 24) * 0.6 * (1 - f);
    }

    const stumble = now - this.stumbleAt;
    if (stumble < STUMBLE_MS) out.tilt = (out.tilt || 0) + Math.sin((stumble / STUMBLE_MS) * Math.PI) * 0.45;

    return { out, hop };
  }

  // every chick pose goes through here, so emotes and item effects apply
  // the same way to every state and to both the main view and the widget
  drawChickAt(ctx, px, groundY, opts) {
    const now = Date.now();
    const r = opts.bodyR;
    const { out: mind, hop } = this.mind(now, px, groundY, opts);
    opts = { ...opts, ...mind };
    groundY -= hop;
    const emote = this.emote && now - this.emote.at < EMOTE_MS ? this.emote.kind : null;
    if (emote === 'dance') {
      groundY -= Math.abs(Math.sin(now / 110)) * r * 0.6;
      opts = { ...opts, facingLeft: Math.floor(now / 280) % 2 === 0, happy: true };
    } else if (emote === 'wave' || emote === 'heart') {
      opts = { ...opts, armsRaised: true, pushing: false, happy: emote === 'heart' };
    }
    const fx = this.effect && now - this.effect.at < EFFECT_MS ? this.effect : null;
    const fxFrac = fx ? (now - fx.at) / EFFECT_MS : 0;

    ctx.save();
    if (fx?.kind === 'slip') {
      // two full spins, easing out, around the body's middle
      const cy = groundY - r * 1.6;
      ctx.translate(px, cy);
      ctx.rotate((1 - (1 - fxFrac) ** 2) * Math.PI * 4);
      ctx.translate(-px, -cy);
    }
    const { headY } = drawChick(ctx, px, groundY, opts);
    ctx.restore();

    if (fx?.kind === 'boost') {
      // speed lines streaming off the back
      const back = opts.facingLeft ? 1 : -1;
      ctx.save();
      ctx.strokeStyle = `rgba(255,240,180,${0.8 * (1 - fxFrac)})`;
      ctx.lineWidth = Math.max(1.5, r * 0.14);
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const y = groundY - r * (0.9 + i * 0.7);
        const x0 = px + back * r * (1.2 + ((now / 60 + i * 7) % 6) * 0.15);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + back * r * 1.4, y);
        ctx.stroke();
      }
      ctx.restore();
    }
    this.labelAt = { x: px, y: headY, r };
  }

  // the player's name in a small pill over the chick - drawn by main.js after
  // every chick, so a label is never hidden behind another climber
  // placed: labels already drawn this frame - chicks bunched together at camp
  // would stack their names into an unreadable smear, so this one steps up
  // above any label it would overlap
  drawLabel(ctx, placed = []) {
    if (!this.labelAt) return;
    const { x, y, r } = this.labelAt;
    if (!this.name) {
      this.drawEmoteBubble(ctx, x, y - r * 0.6, r);
      return;
    }
    const text = `${this.champion ? '👑 ' : ''}${this.name}${this.streak > 1 ? ` 🔥${this.streak}` : ''}`;
    const size = Math.max(10, Math.round(r * 0.85));
    ctx.save();
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + size * 0.9;
    const h = size * 1.5;
    let cy = y - size * 0.5 - h / 2;
    for (let moved = true; moved; ) {
      moved = false;
      for (const p of placed) {
        if (Math.abs(p.x - x) < (p.w + w) / 2 + 2 && Math.abs(p.cy - cy) < h + 2) {
          cy = p.cy - h - 2;
          moved = true;
        }
      }
    }
    placed.push({ x, cy, w });
    ctx.fillStyle = 'rgba(16,10,32,0.72)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = this.look.body;
    ctx.fillText(text, x, cy + 0.5);
    ctx.restore();
    this.drawEmoteBubble(ctx, x, cy - h / 2, r);
  }

  // the emote's emoji popping up over the name, then floating off
  drawEmoteBubble(ctx, x, bottomY, r) {
    if (!this.emote) return;
    const age = Date.now() - this.emote.at;
    if (age > EMOTE_MS) return;
    const frac = age / EMOTE_MS;
    const pop = Math.min(1, age / 150);
    const size = Math.max(16, r * 1.5) * pop;
    ctx.save();
    ctx.globalAlpha = frac < 0.8 ? 1 : (1 - frac) / 0.2;
    ctx.font = `${Math.round(size)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(EMOTE_ICONS[this.emote.kind] || '', x, bottomY - 2 - frac * r);
    ctx.restore();
  }

  drawMarkers(ctx, route, now) {
    for (const f of this.flashes) {
      const age = (now - f.at) / 900;
      const pt = route.anchor(f.wp);
      const alpha = 1 - age;

      const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 22 + age * 10);
      glow.addColorStop(0, `hsla(${this.orbHue}, 85%, 80%, ${0.5 * alpha})`);
      glow.addColorStop(1, `hsla(${this.orbHue}, 85%, 80%, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 22 + age * 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `hsla(${this.orbHue}, 80%, 85%, 0.8)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6 + age * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawArriving(ctx, route, t, isLeader = false) {
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
    this.drawChickAt(ctx, px, groundY, {
      bodyR: BODY_R,
      hue: this.chickHue,
      walkPhase,
      facingLeft: startOffset > 1,
      idleFlap: Math.sin(t * 2.4 + this.phase) * 0.15,
      look: this.look,
      isLeader,
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

  drawClimbing(ctx, route, t, now, isLeader = false, storm = 0) {
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
    // a storm makes the stagger visibly worse - not just decoration, it
    // reads as the chick actually fighting the wind mid-climb
    const wobble = waiting ? 0 : Math.sin(walkPhase) * (2 + storm * 7);
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

    this.drawChickAt(ctx, px, groundY, {
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
      look: this.look,
      sweat: waiting ? 0 : storm,
      isLeader,
      t,
    });
  }

  drawPlacing(ctx, route, t, now, isLeader = false) {
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

    this.drawChickAt(ctx, px, groundY, {
      bodyR: BODY_R,
      hue: this.chickHue,
      walkPhase: t * 0.6 + this.phase,
      facingLeft: false,
      armsRaised: frac > 0.35,
      happy: frac > 0.35,
      idleFlap: Math.sin(t * 2.4 + this.phase) * 0.15,
      look: this.look,
      isLeader,
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
