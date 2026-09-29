// game rules shared by the deployed worker, the local dev server and the page, so the
// two can't drift apart. Pure functions over plain objects - no I/O here.

// --- item boxes (Mario Kart-style) ---------------------------------------
// a box sits at each of these step counts along the climb (0.07 progress per
// step, so roughly 21% / 49% / 77% of the way up). Each chick opens each box
// once per turn, in order.
export const BOX_STEPS = [3, 7, 11];
const MUSHROOM_STEPS = 2; // a boost forward
const BANANA_STEPS = 2; // how far the chick just behind slides back
const BANANA_CHANCE = 0.4;

// sessions: Map id -> { steps, boxes, name }. Call right after `id` climbed a
// step. Returns the broadcastable item event, or null if no box was reached.
export function pickupItem(sessions, id, rand = Math.random) {
  const s = sessions.get(id);
  const opened = s.boxes ?? 0;
  if (opened >= BOX_STEPS.length || (s.steps ?? 0) < BOX_STEPS[opened]) return null;
  s.boxes = opened + 1;

  // the banana only makes sense with someone right behind to slip on it
  let victimId = null;
  for (const [otherId, other] of sessions) {
    if (otherId === id || (other.steps ?? 0) >= s.steps) continue;
    if (!victimId || other.steps > sessions.get(victimId).steps) victimId = otherId;
  }
  if (victimId && rand() < BANANA_CHANCE) {
    const victim = sessions.get(victimId);
    victim.steps = Math.max(0, (victim.steps ?? 0) - BANANA_STEPS);
    return { type: 'item', id, box: opened, item: 'banana', steps: s.steps, target: victimId, targetSteps: victim.steps };
  }
  s.steps += MUSHROOM_STEPS;
  return { type: 'item', id, box: opened, item: 'mushroom', steps: s.steps };
}

// --- streaks (Duolingo-style) ---------------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000;
export function dayKeyOf(ms) {
  return new Date(ms).toDateString();
}

// streaks: name -> { last: dayKey, count }. Called when `name` summits.
export function bumpStreak(streaks, name, now) {
  const today = dayKeyOf(now);
  const prev = streaks[name];
  if (prev?.last === today) return;
  const continued = prev?.last === dayKeyOf(now - DAY_MS);
  streaks[name] = { last: today, count: continued ? prev.count + 1 : 1 };
}

// only streaks still alive (summited today or yesterday) - drops dead ones
// from the stored map too, so it can't grow forever on the public world
export function liveStreaks(streaks, now) {
  const alive = new Set([dayKeyOf(now), dayKeyOf(now - DAY_MS)]);
  const out = {};
  for (const [name, st] of Object.entries(streaks)) {
    if (alive.has(st.last)) out[name] = st.count;
    else delete streaks[name];
  }
  return out;
}

// --- weekly crown (Fall Guys-style) ---------------------------------------
// weeks start on Monday
export function weekKeyOf(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toDateString();
}

// week: { key, scores: name -> summits }. Resets itself when a new week starts.
export function bumpWeek(week, name, now) {
  const key = weekKeyOf(now);
  if (week.key !== key) {
    week.key = key;
    week.scores = {};
  }
  week.scores[name] = (week.scores[name] ?? 0) + 1;
}

// whoever has the most summits this week; the earlier one keeps it on a tie
export function weekChampion(week, now) {
  if (week.key !== weekKeyOf(now)) return null;
  let best = null;
  for (const [name, count] of Object.entries(week.scores)) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

// --- emotes -----------------------------------------------------------------
// a fixed set, never free text - nothing a viewer sends can say anything
export const EMOTES = ['wave', 'dance', 'heart', 'taunt'];
export const EMOTE_COOLDOWN_MS = 800;
