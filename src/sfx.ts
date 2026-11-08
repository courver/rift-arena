// Procedural sound effects with WebAudio: no audio files to license.

export type SfxName =
  | 'shoot' | 'slash' | 'hit' | 'crit' | 'kill' | 'hurt' | 'blink' | 'nova'
  | 'boom' | 'rage' | 'pick' | 'spawn' | 'heal' | 'deny' | 'win' | 'lose' | 'ebullet'
  | 'zap' | 'flame' | 'block';

import { settings, saveSettings } from './settings';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const last: Partial<Record<SfxName, number>> = {};

export function isMuted() {
  return !settings.sound;
}

/** M key / settings: all sound on or off. */
export function toggleMute() {
  settings.sound = !settings.sound;
  saveSettings();
  applyVolumes();
  return !settings.sound;
}

export function setMusic(on: boolean) {
  settings.music = on;
  saveSettings();
  applyVolumes();
}

function applyVolumes() {
  if (!ctx || !master || !musicBus) return;
  master.gain.setTargetAtTime(settings.sound ? 0.22 : 0, ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(settings.music ? 0.55 : 0, ctx.currentTime, 0.2);
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
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    applyVolumes();
    window.setInterval(scheduleMusic, 50);
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
  if (!ctx || !settings.sound) return;
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
    case 'zap': noise(0.12, 0.35, 8000); tone(1800, 0.1, 'sawtooth', 0.08, 400); break;
    case 'flame': noise(0.08, 0.08, 1500); break;
    case 'block': tone(1200, 0.05, 'square', 0.08, 900); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, undefined, i * 0.12)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.12, undefined, i * 0.15)); break;
  }
}

// ------------------------------------------------------------------ music
// A tiny step sequencer: bass + arpeggio over a four-chord loop, with drums in combat
// and a faster, darker variation for boss fights. Scheduled slightly ahead of time.

export type MusicMood = 'menu' | 'battle' | 'boss';
let mood: MusicMood = 'menu';
let step = 0;
let nextTime = 0;

export function setMusicMood(m: MusicMood) {
  mood = m;
}

const CHORDS: Record<MusicMood, number[][]> = {
  menu: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
  battle: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
  boss: [[52, 55, 59], [52, 55, 58], [48, 52, 55], [50, 53, 57]],
};
const BPM: Record<MusicMood, number> = { menu: 84, battle: 118, boss: 138 };

function musicNote(midi: number, t: number, dur: number, type: OscillatorType, vol: number) {
  if (!ctx || !musicBus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function musicDrum(t: number, kick: boolean) {
  if (!ctx || !musicBus || !noiseBuf) return;
  if (kick) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(musicBus);
    o.start(t);
    o.stop(t + 0.17);
  } else {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f).connect(g).connect(musicBus);
    s.start(t);
    s.stop(t + 0.05);
  }
}

function scheduleMusic() {
  if (!ctx || !settings.music || ctx.state !== 'running') return;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.2) {
    const stepDur = 60 / BPM[mood] / 2; // eighth notes
    const chord = CHORDS[mood][Math.floor(step / 8) % 4];
    if (step % 4 === 0) musicNote(chord[0] - 12, nextTime, stepDur * 3.5, 'triangle', 0.16);
    const arp = mood === 'menu' ? [0, 1, 2, 1] : [0, 1, 2, 1, 2, 0, 1, 2];
    musicNote(chord[arp[step % arp.length]] + 12, nextTime, stepDur * 0.9, mood === 'menu' ? 'sine' : 'square', mood === 'menu' ? 0.05 : 0.025);
    if (mood !== 'menu') {
      if (step % 4 === 0 || (mood === 'boss' && step % 4 === 2)) musicDrum(nextTime, true);
      if (step % 2 === 1) musicDrum(nextTime, false);
    }
    nextTime += stepDur;
    step++;
  }
}
