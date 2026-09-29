import { hashRand } from './utils.js';

// each chick's character: a body color from a hand-picked palette (clearly
// different colors, not one pastel with its hue nudged - those all read as
// the same pinkish-violet at widget size), plus a head tuft, an eye type and
// a hat. All derived from the session id, so the same Claude session always
// shows up as the same character instead of reshuffling.
//
// hue is only for the things still tinted by a single hue (spirit, gravestone)
export const PALETTE = [
  { name: 'sarı', body: '#ffd84a', accent: '#f08a24', hue: 48 },
  { name: 'turuncu', body: '#ffa24c', accent: '#c4531a', hue: 28 },
  { name: 'mercan', body: '#ff7f78', accent: '#b8363a', hue: 4 },
  { name: 'pembe', body: '#ffa3d0', accent: '#d2447f', hue: 330 },
  { name: 'lila', body: '#bba2ff', accent: '#6a47d0', hue: 258 },
  { name: 'gök', body: '#7ccbff', accent: '#2c72c6', hue: 205 },
  { name: 'nane', body: '#82e3b4', accent: '#2c9466', hue: 150 },
  { name: 'krem', body: '#f6eedb', accent: '#de8c36', hue: 40 },
  { name: 'kakao', body: '#a8764f', accent: '#f0b04a', hue: 26 },
  { name: 'kömür', body: '#6d6d86', accent: '#f2b93b', hue: 240 },
];

const TUFTS = ['curl', 'spikes', 'mohawk', 'messy'];
const EYES = ['sparkle', 'sleepy', 'determined', 'curious'];
const HATS = ['none', 'beanie', 'bandana', 'tophat', 'flower'];
const HAT_COLORS = ['#e2474b', '#3d7be0', '#2fa36b', '#f2c230', '#8c5ad8', '#f0f0f0'];

// session ids are hex hashes on the live server, but anything goes locally
function seedOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 100000;
}

function hexHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: sat, l };
}

// near-whites/greys clash on lightness, colors on hue
function colorsClash(a, b) {
  const x = hexHsl(a);
  const y = hexHsl(b);
  if (x.s < 0.3 || y.s < 0.3) return x.s < 0.3 && y.s < 0.3 && Math.abs(x.l - y.l) < 0.25;
  const dh = Math.abs(x.h - y.h);
  return Math.min(dh, 360 - dh) < 35;
}

function pick(list, seed, salt) {
  return list[Math.floor(hashRand(seed + salt) * list.length) % list.length];
}

// takenColors: palette indexes already worn by chicks on the mountain right
// now - the preferred color steps forward to the next free one, so two
// chicks climbing together never share a color (until all ten are in use)
export function pickLook(id, takenColors = new Set()) {
  const seed = seedOf(id);
  let colorIdx = Math.floor(hashRand(seed + 1) * PALETTE.length) % PALETTE.length;
  for (let i = 0; i < PALETTE.length && takenColors.has(colorIdx); i++) {
    colorIdx = (colorIdx + 1) % PALETTE.length;
  }
  const color = PALETTE[colorIdx];
  // a hat close to the body's own color vanishes into it (a yellow beanie
  // on a yellow chick) - step to the next hat color until they differ
  let hatIdx = Math.floor(hashRand(seed + 5) * HAT_COLORS.length) % HAT_COLORS.length;
  for (let i = 0; i < HAT_COLORS.length && colorsClash(HAT_COLORS[hatIdx], color.body); i++) {
    hatIdx = (hatIdx + 1) % HAT_COLORS.length;
  }
  const hatColor = HAT_COLORS[hatIdx];
  return {
    colorIdx,
    body: color.body,
    accent: color.accent,
    hue: color.hue,
    tuft: pick(TUFTS, seed, 2),
    eyes: pick(EYES, seed, 3),
    hat: pick(HATS, seed, 4),
    hatColor,
  };
}
