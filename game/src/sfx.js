// Procedural WebAudio SFX — no audio files. start() must be called from a user
// gesture (we hook pointer-lock). M toggles mute.
let actx = null, master = null, muted = false;

function ensure() {
  if (actx) return true;
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
  master = actx.createGain(); master.gain.value = 0.45; master.connect(actx.destination);
  // faint store hum
  const n = Math.floor(actx.sampleRate * 2), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
  const g = actx.createGain(); g.gain.value = 0.018;
  src.connect(f); f.connect(g); g.connect(master); src.start();
  return true;
}

function tone(freq, dur, type = 'sine', peak = 0.28, slideTo) {
  if (!actx || muted) return;
  const t0 = actx.currentTime;
  const o = actx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
}

function noise(dur, freq, peak = 0.3) {
  if (!actx || muted) return;
  const t0 = actx.currentTime;
  const n = Math.floor(actx.sampleRate * dur), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = actx.createGain();
  g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t0);
}

export const SFX = {
  start() { if (!ensure()) return; if (actx.state === 'suspended') actx.resume(); },
  toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.45; return muted; },
  grab() { tone(520, 0.12, 'triangle', 0.24, 800); },
  tick() { tone(880, 0.07, 'square', 0.14); },
  listDone() { [660, 880].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.26), i * 100)); },
  checkout() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.26), i * 90)); },
  error() { tone(300, 0.18, 'sawtooth', 0.2, 190); },
  thud() { noise(0.14, 260, 0.4); tone(90, 0.12, 'sine', 0.3, 55); },
  crash() { noise(0.5, 900, 0.5); tone(70, 0.35, 'sine', 0.4, 40); setTimeout(() => noise(0.25, 500, 0.3), 120); },
  clatter() { [0, 60, 130, 210].forEach((ms, i) => setTimeout(() => tone(700 + Math.random() * 500, 0.05, 'square', 0.12), ms)); },
};
