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

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this._ambient = null;
    this._crackleId = null;
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
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this._stopAmbient();
    const ctx = this.ctx;
    this.ctx = null;
    ctx.close().catch(() => {});
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

  // a quick staccato square-wave run when a task reaches the summit - a
  // Mario-style "power-up" fanfare, echoing the visual dash-and-rise
  playSummit(hue) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const root = noteForHue(hue);
    [1, 1.25, 1.5, 2, 2.5, 3].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = root * mult;
      const start = t0 + i * 0.05;
      gain.gain.setValueAtTime(0.045, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.1);
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

    // campfire crackle: short highpass-noise bursts at random intervals
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.05;
    crackleGain.connect(ctx.destination);

    const crackle = () => {
      if (!this.enabled) return;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filt = ctx.createBiquadFilter();
      filt.type = 'highpass';
      filt.frequency.value = 2000 + Math.random() * 2000;
      const g = ctx.createGain();
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.6, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05 + Math.random() * 0.05);
      src.connect(filt).connect(g).connect(crackleGain);
      src.start(t0);
      src.stop(t0 + 0.15);
      this._crackleId = setTimeout(crackle, 150 + Math.random() * 400);
    };
    crackle();

    this._ambient = { windSource, lfo };
  }

  _stopAmbient() {
    if (this._crackleId) clearTimeout(this._crackleId);
    this._crackleId = null;
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
