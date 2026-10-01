// Petit synthé WebAudio : aucun fichier son, tout est généré.
// Le son est coupé par défaut et ne démarre qu'après une action de l'utilisateur.

import { load, save } from './store';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = load<boolean>('sound', false);
const listeners = new Set<(on: boolean) => void>();

export function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const out = () => {
  audio();
  return master!;
};

export const soundEnabled = () => enabled;

export function setSound(on: boolean) {
  enabled = on;
  save('sound', on);
  if (on) audio();
  listeners.forEach((fn) => fn(on));
}

export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn);
}

function envelope(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** Note brève, utilisée par l'interface (frise, boutons). Respecte le réglage global. */
export function blip(freq: number, vol = 0.18, dur = 0.18) {
  if (!enabled) return;
  pluck(freq, audio().currentTime, vol, dur);
}

export function pluck(freq: number, t: number, vol = 0.2, dur = 0.25) {
  const c = audio();
  const o = c.createOscillator();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.value = freq;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq * 6, t);
  f.frequency.exponentialRampToValueAtTime(freq * 1.2, t + dur);
  envelope(g, t, vol, 0.004, dur);
  o.connect(f).connect(g).connect(out());
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function kick(t: number, vol = 0.9) {
  const c = audio();
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  envelope(g, t, vol, 0.002, 0.32);
  o.connect(g).connect(out());
  o.start(t);
  o.stop(t + 0.4);
}

let noiseBuffer: AudioBuffer | null = null;
function noise(c: AudioContext) {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  return src;
}

export function snare(t: number, vol = 0.45) {
  const c = audio();
  const n = noise(c);
  const f = c.createBiquadFilter();
  const g = c.createGain();
  f.type = 'bandpass';
  f.frequency.value = 1800;
  f.Q.value = 0.8;
  envelope(g, t, vol, 0.002, 0.16);
  n.connect(f).connect(g).connect(out());
  n.start(t);
  n.stop(t + 0.2);
  const o = c.createOscillator();
  const og = c.createGain();
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  envelope(og, t, vol * 0.6, 0.002, 0.09);
  o.connect(og).connect(out());
  o.start(t);
  o.stop(t + 0.12);
}

export function hat(t: number, vol = 0.16, open = false) {
  const c = audio();
  const n = noise(c);
  const f = c.createBiquadFilter();
  const g = c.createGain();
  f.type = 'highpass';
  f.frequency.value = 7500;
  envelope(g, t, vol, 0.001, open ? 0.22 : 0.045);
  n.connect(f).connect(g).connect(out());
  n.start(t);
  n.stop(t + 0.3);
}

/** Une approximation (assumée) d'un trombone : scie + filtre qui s'ouvre, léger vibrato. */
export function brass(freq: number, t: number, dur: number, vol = 0.22) {
  const c = audio();
  const o = c.createOscillator();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq * 0.97, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
  lfo.frequency.value = 5.5;
  lfoGain.gain.value = freq * 0.006;
  lfo.connect(lfoGain).connect(o.frequency);
  f.type = 'lowpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(freq * 1.2, t);
  f.frequency.linearRampToValueAtTime(freq * 5, t + 0.08);
  f.frequency.linearRampToValueAtTime(freq * 2.5, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.04);
  g.gain.setValueAtTime(vol * 0.85, t + dur * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  o.connect(f).connect(g).connect(out());
  o.start(t);
  lfo.start(t);
  o.stop(t + dur + 0.1);
  lfo.stop(t + dur + 0.1);
}

/** Gamme pentatonique mineure de la, pratique pour que tout sonne juste ensemble. */
export const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 784];
