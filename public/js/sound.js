// procedural audio - no external files, in keeping with the rest of the
// world (everything else is hand-drawn on canvas, not sprites/assets). Silent
// until the user explicitly opts in via enable() (a click handler): a tab
// that sits open in the background must never start making noise on its own,
// and browsers block unattended autoplay anyway.

// two octaves of a pentatonic scale - deliberately avoiding the intervals
// that can sound dissonant, so any hue-derived note still sounds pleasant
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

function noteForHue(hue) {
  const idx = Math.floor(((hue % 360) / 360) * SCALE.length) % SCALE.length;
  return SCALE[idx];
}

// a short, bouncy background tune - indices into SCALE, each with its own
// beat length, looped continuously while sound is on. Triangle wave (not
// the event sounds' square) so it sits underneath them, softer and sweeter
// rather than competing for the same bright timbre.
const MELODY = [
  { i: 4, d: 0.24 },
  { i: 5, d: 0.24 },
  { i: 6, d: 0.24 },
  { i: 5, d: 0.24 },
  { i: 4, d: 0.24 },
  { i: 2, d: 0.24 },
  { i: 4, d: 0.48 },
  { i: 3, d: 0.24 },
  { i: 4, d: 0.24 },
  { i: 5, d: 0.24 },
  { i: 3, d: 0.24 },
  { i: 2, d: 0.24 },
  { i: 0, d: 0.24 },
  { i: 2, d: 0.48 },
];
const MELODY_LOOP_MS = MELODY.reduce((sum, n) => sum + n.d, 0) * 1000;

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this._ambient = null;
    this._musicTimer = null;
  }

  toggle() {
    if (this.enabled) this.disable();
    else this.enable();
    return this.enabled;
  }

  enable() {
    if (this.enabled) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx.resume?.();
    this.enabled = true;
    this._startAmbient();
    this._scheduleMelodyLoop();
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this._stopAmbient();
    if (this._musicTimer) clearTimeout(this._musicTimer);
    this._musicTimer = null;
    const ctx = this.ctx;
    this.ctx = null;
    ctx.close().catch(() => {});
  }

  // schedules one loop of MELODY up front (it's short), then re-arms itself
  // via a plain timeout for the next loop - simple and drift-free enough at
  // this length, no need for a lookahead scheduler
  _scheduleMelodyLoop() {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0.035;
    bus.connect(ctx.destination);

    let when = ctx.currentTime + 0.05;
    for (const note of MELODY) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = SCALE[note.i];
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(1, when + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, when + note.d * 0.9);
      osc.connect(gain).connect(bus);
      osc.start(when);
      osc.stop(when + note.d);
      when += note.d;
    }

    this._musicTimer = setTimeout(() => {
      if (this.enabled) this._scheduleMelodyLoop();
    }, MELODY_LOOP_MS);
  }

  // a bright chiptune "coin" blip when a new chick joins the climb - a
  // square wave and a fast two-note upward hop, arcade rather than ambient
  playJoin(hue) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const root = noteForHue(hue);
    [
      [root, 0],
      [root * 1.5, 0.06],
    ].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const start = t0 + delay;
      gain.gain.setValueAtTime(0.05, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.1);
    });
  }

  // a "ta-ta-ta-TAAA" fanfare when a task reaches the summit: three quick
  // rising hits, then a held, lightly-vibrato'd open chord - a plain
  // ascending run didn't read as an arrival, just more of the same blip
  playSummit(hue) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const root = noteForHue(hue);

    [
      { mult: 1, start: 0 },
      { mult: 1.26, start: 0.09 },
      { mult: 1.5, start: 0.18 },
    ].forEach(({ mult, start }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = root * mult;
      const s = t0 + start;
      gain.gain.setValueAtTime(0.05, s);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
      osc.connect(gain).connect(ctx.destination);
      osc.start(s);
      osc.stop(s + 0.1);
    });

    // the held finish: an open octave-plus-fifth chord with a touch of
    // vibrato, so it shimmers instead of just cutting off
    const finishStart = t0 + 0.3;
    const finishDur = 0.5;
    [
      { mult: 2, type: 'square' },
      { mult: 3, type: 'triangle' },
    ].forEach(({ mult, type }) => {
      const freq = root * mult;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;

      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 6;
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.value = freq * 0.01;
      vibrato.connect(vibratoGain).connect(osc.frequency);
      vibrato.start(finishStart);
      vibrato.stop(finishStart + finishDur);

      gain.gain.setValueAtTime(0, finishStart);
      gain.gain.linearRampToValueAtTime(0.06, finishStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, finishStart + finishDur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(finishStart);
      osc.stop(finishStart + finishDur + 0.02);
    });
  }

  _startAmbient() {
    const ctx = this.ctx;

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // wind: looping noise through a slowly-modulated lowpass filter
    const windSource = ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.7;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.035;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(windFilter.frequency);

    windSource.connect(windFilter).connect(windGain).connect(ctx.destination);
    windSource.start();
    lfo.start();

    // (campfire crackle used to live here - short highpass-noise bursts at
    // random intervals - but it landed as a rapid clicky rattle rather than
    // a fire, so it's gone; wind is the whole ambient bed now)

    this._ambient = { windSource, lfo };
  }

  _stopAmbient() {
    if (!this._ambient) return;
    try {
      this._ambient.windSource.stop();
      this._ambient.lfo.stop();
    } catch {
      // already stopped
    }
    this._ambient = null;
  }
}
