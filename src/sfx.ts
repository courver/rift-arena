// Procedural sound effects with WebAudio: no audio files to license.

export type SfxName =
  | 'shoot' | 'slash' | 'hit' | 'crit' | 'kill' | 'hurt' | 'blink' | 'nova'
  | 'boom' | 'rage' | 'pick' | 'spawn' | 'heal' | 'deny' | 'win' | 'lose' | 'ebullet';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = load();
const last: Partial<Record<SfxName, number>> = {};

function load() {
  try { return localStorage.getItem('rift-muted') === '1'; } catch { return false; }
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('rift-muted', muted ? '1' : '0'); } catch { /* ignore */ }
  return muted;
}

/** Browsers only allow audio after a user gesture; call from an input handler. */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, delay = 0) {
  if (!ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

export function sfx(name: SfxName) {
  if (!ctx || muted) return;
  const now = performance.now();
  if (now - (last[name] ?? 0) < 40) return; // throttle spammy sounds
  last[name] = now;
  switch (name) {
    case 'shoot': tone(880, 0.07, 'square', 0.12, 1400); break;
    case 'slash': noise(0.1, 0.35, 3500); tone(300, 0.08, 'sawtooth', 0.08, 120); break;
    case 'hit': noise(0.05, 0.3, 2000); break;
    case 'crit': noise(0.08, 0.45, 5000); tone(1500, 0.08, 'square', 0.1, 600); break;
    case 'kill': tone(520, 0.1, 'triangle', 0.18, 180); break;
    case 'hurt': tone(160, 0.2, 'sawtooth', 0.25, 60); noise(0.15, 0.3, 800); break;
    case 'blink': tone(400, 0.15, 'sine', 0.2, 1600); break;
    case 'nova': tone(1200, 0.3, 'triangle', 0.2, 300); noise(0.25, 0.2, 6000); break;
    case 'boom': noise(0.6, 0.6, 600); tone(90, 0.5, 'sine', 0.5, 30); break;
    case 'rage': tone(110, 0.5, 'sawtooth', 0.25, 220); noise(0.4, 0.3, 1200); break;
    case 'pick': [660, 880, 1320].forEach((f, i) => tone(f, 0.12, 'triangle', 0.18, undefined, i * 0.06)); break;
    case 'spawn': tone(200, 0.15, 'sine', 0.06, 400); break;
    case 'heal': tone(700, 0.15, 'sine', 0.15, 1100); break;
    case 'deny': tone(140, 0.08, 'square', 0.08); break;
    case 'ebullet': tone(500, 0.06, 'sine', 0.05, 300); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, undefined, i * 0.12)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.12, undefined, i * 0.15)); break;
  }
}
