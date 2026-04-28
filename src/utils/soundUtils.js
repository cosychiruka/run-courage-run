/* ══════════════════════════════════════════════════════════════════════════
   Web Audio API sound effects — no files, all procedural
   ══════════════════════════════════════════════════════════════════════════ */

let _ctx = null;
const ac = () => {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
};

/* ── Fly squash — downward splat crunch ── */
export function playSquash() {
  try {
    const c = ac();
    const osc = c.createOscillator();
    const noise = c.createOscillator();
    const g = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.5;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, c.currentTime + 0.18);
    noise.type = 'square';
    noise.frequency.setValueAtTime(300, c.currentTime);
    noise.frequency.exponentialRampToValueAtTime(50, c.currentTime + 0.1);

    [osc, noise].forEach(o => { o.connect(filter); filter.connect(g); g.connect(c.destination); });
    g.gain.setValueAtTime(0.5, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);
    osc.start(c.currentTime); osc.stop(c.currentTime + 0.22);
    noise.start(c.currentTime); noise.stop(c.currentTime + 0.12);
  } catch (_) {}
}

/* ── Repulse pulse — rising energy whoosh ── */
export function playRepulsePulse() {
  try {
    const c = ac();
    [0, 0.07, 0.14].forEach((delay, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.connect(g); g.connect(c.destination);
      const t = c.currentTime + delay;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150 + i * 60, t);
      osc.frequency.exponentialRampToValueAtTime(700 + i * 200, t + 0.3);
      g.gain.setValueAtTime(0.28 - i * 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t); osc.stop(t + 0.42);
    });
  } catch (_) {}
}

/* ── Ghost angry — grumbly distorted growl ── */
export function playGhostAngry() {
  try {
    const c = ac();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g); g.connect(c.destination);
    osc.type = 'square';
    const freqs = [220, 170, 240, 150, 200];
    freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, c.currentTime + i * 0.09));
    g.gain.setValueAtTime(0.22, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.52);
    osc.start(c.currentTime); osc.stop(c.currentTime + 0.55);
  } catch (_) {}
}

/* ── Courage escape sneaky shuffle ── */
export function playCourageSneak() {
  try {
    const c = ac();
    [0, 0.15, 0.3].forEach((delay, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.connect(g); g.connect(c.destination);
      const t = c.currentTime + delay;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180 + i * 40, t);
      osc.frequency.setValueAtTime(120 + i * 30, t + 0.08);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.start(t); osc.stop(t + 0.16);
    });
  } catch (_) {}
}

/* ── Ghost incoming spooky drone (loop) ── */
let _ghostLoop = null;
export function startGhostDrone() {
  if (_ghostLoop) return;
  try {
    const c = ac();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g); g.connect(c.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, c.currentTime);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(0.08, c.currentTime + 2);
    osc.start(c.currentTime);
    _ghostLoop = { osc, g };
  } catch (_) {}
}
export function stopGhostDrone() {
  if (!_ghostLoop) return;
  try {
    const { osc, g } = _ghostLoop;
    const c = ac();
    g.gain.setValueAtTime(g.gain.value, c.currentTime);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 0.5);
    osc.stop(c.currentTime + 0.6);
  } catch (_) {}
  _ghostLoop = null;
}
