// NYOTA FREQUENCY MACHINE — NFM-01 audio engine.
// Web Audio clock scheduling; five engines -> channel strips -> sends -> master.
// Sound sources are synthesized placeholders; swap the voice functions or add
// AudioBuffer playback per engine via the manifest-style ENGINE_DEFS below.

export const ENGINE_IDS = ['solar', 'lunar', 'rhythm', 'ancestor', 'eclipse'];
export const RHYTHM_LANES = ['KICK', 'CLAP', 'SHAKER', 'CONGA'];
export const PAD_DEFS = [
  { id: 'kick', label: 'KICK' }, { id: 'clap', label: 'CLAP' }, { id: 'shaker', label: 'SHKR' }, { id: 'perc', label: 'PERC' },
  { id: 'vocal', label: 'VOX' }, { id: 'stab', label: 'STAB' }, { id: 'fx', label: 'FX' }, { id: 'impact', label: 'IMPT' }
];
const P5 = [130.81, 155.56, 196.0, 233.08, 261.63, 311.13, 392.0, 523.25]; // C minor pentatonic

export function defaultParams() {
  return {
    solar:    { wave: 'triangle', tune: 0, blend: 0, cutoff: 0.72, res: 0.2, drive: 0.1, attack: 0.01, decay: 0.28, sustain: 0.12, release: 0.2, lfoRate: 0.3, lfoDepth: 0.25, lfoDest: 'FILTER', level: 0.7, pan: 0.12, sendA: 0.3, sendB: 0.25, mute: false, solo: false },
    lunar:    { wave: 'sine', tune: -12, blend: 0, cutoff: 0.5, res: 0.12, drive: 0, attack: 0.9, decay: 0.6, sustain: 0.7, release: 1.6, lfoRate: 0.12, lfoDepth: 0.35, lfoDest: 'PAN', level: 0.65, pan: -0.15, sendA: 0.75, sendB: 0.15, mute: false, solo: false },
    rhythm:   { wave: 'sine', tune: 0, blend: 0, cutoff: 0.9, res: 0.05, drive: 0.25, attack: 0.001, decay: 0.2, sustain: 0, release: 0.05, lfoRate: 0.2, lfoDepth: 0, lfoDest: 'LEVEL', level: 0.85, pan: 0, sendA: 0.08, sendB: 0.1, mute: false, solo: false },
    ancestor: { wave: 'sine', tune: 0, blend: 0, cutoff: 0.6, res: 0.15, drive: 0.15, attack: 0.003, decay: 0.35, sustain: 0.05, release: 0.25, lfoRate: 0.18, lfoDepth: 0.15, lfoDest: 'PITCH', level: 0.7, pan: -0.08, sendA: 0.35, sendB: 0.2, mute: false, solo: false },
    eclipse:  { wave: 'sine', tune: -24, blend: 0, cutoff: 0.32, res: 0.3, drive: 0.4, attack: 0.005, decay: 0.4, sustain: 0.6, release: 0.15, lfoRate: 0.25, lfoDepth: 0.2, lfoDest: 'FILTER', level: 0.75, pan: 0, sendA: 0.2, sendB: 0.25, mute: false, solo: false }
  };
}
function emptySeq(len) { return Array.from({ length: 16 }, () => false).map((v, i) => false) && new Array(16).fill(false); }
export function defaultSeq() {
  const s = {
    solar:    { length: 16, lanes: [new Array(16).fill(false)], notes: [4, 2, 5, 3, 4, 2, 6, 3, 4, 2, 5, 3, 7, 5, 6, 3] },
    lunar:    { length: 16, lanes: [new Array(16).fill(false)], notes: [0, 2, 1, 3, 0, 2, 1, 4, 0, 2, 1, 3, 0, 2, 4, 1] },
    rhythm:   { length: 16, lanes: RHYTHM_LANES.map(() => new Array(16).fill(false)) },
    ancestor: { length: 12, lanes: [new Array(16).fill(false)], notes: [1, 3, 2, 4, 1, 3, 2, 5, 1, 3, 2, 4, 1, 3, 2, 4] },
    eclipse:  { length: 16, lanes: [new Array(16).fill(false)], notes: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 3, 0, 0, 0] }
  };
  // PATCH 001 — FIRST LIGHT
  [0, 4, 8, 12].forEach(i => { s.rhythm.lanes[0][i] = true; });
  [4, 12].forEach(i => { s.rhythm.lanes[1][i] = true; });
  [2, 6, 7, 10, 14, 15].forEach(i => { s.rhythm.lanes[2][i] = true; });
  [3, 11, 13].forEach(i => { s.rhythm.lanes[3][i] = true; });
  [0, 8].forEach(i => { s.eclipse.lanes[0][i] = true; });
  [0, 3, 6, 10, 14].forEach(i => { s.solar.lanes[0][i] = true; });
  [0, 6].forEach(i => { s.ancestor.lanes[0][i] = true; });
  s.lunar.lanes[0][0] = true;
  return s;
}
export const PRESETS = [
  { name: 'FIRST LIGHT', num: '001' },
  { name: 'MOON RITUAL', num: '002', tweak: { lunar: { level: 0.85, sendA: 0.9 }, solar: { level: 0.3, cutoff: 0.4 }, rhythm: { level: 0.6 }, global: { space: 0.7, bpm: 118 } } },
  { name: 'ANCESTRAL PULSE', num: '003', tweak: { ancestor: { level: 0.9, sendB: 0.4 }, rhythm: { level: 0.8 }, lunar: { level: 0.4 }, global: { swing: 0.6, bpm: 120 } } },
  { name: 'ECLIPSE CLUB', num: '004', tweak: { eclipse: { level: 0.95, drive: 0.6, cutoff: 0.42 }, rhythm: { level: 0.95 }, solar: { cutoff: 0.85 }, global: { bpm: 128, echoFb: 0.45 } } }
];

export function createNFM() {
  let ctx = null, master, comp, masterFilter, widener;
  let spaceIn, spaceVerb, spaceOut, echoIn, echoDelay, echoFb, echoFilter, echoOut;
  let analysers = {}, chans = {};
  const params = defaultParams();
  const seq = defaultSeq();
  const g = { bpm: 124, swing: 0.54, space: 0.45, spaceDecay: 0.6, echoDiv: 0.375, echoFb: 0.32, echoMix: 0.4, eclipse: 0, xy: { x: 0.55, y: 0.5 }, master: 0.85 };
  let playing = false, step = 0, nextT = 0, timer = null, patch = 0;
  let stepListeners = [];

  function impulse(secs, decay) {
    const r = ctx.sampleRate, n = r * secs, b = ctx.createBuffer(2, n, r);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    masterFilter = ctx.createBiquadFilter(); masterFilter.type = 'lowpass'; masterFilter.frequency.value = 18000;
    master = ctx.createGain(); master.gain.value = g.master;
    masterFilter.connect(comp); comp.connect(master); master.connect(ctx.destination);
    spaceIn = ctx.createGain(); spaceVerb = ctx.createConvolver(); spaceVerb.buffer = impulse(3.4, 3.2);
    spaceOut = ctx.createGain(); spaceOut.gain.value = g.space;
    spaceIn.connect(spaceVerb); spaceVerb.connect(spaceOut); spaceOut.connect(masterFilter);
    echoIn = ctx.createGain(); echoDelay = ctx.createDelay(2); echoFb = ctx.createGain(); echoFb.gain.value = g.echoFb;
    echoFilter = ctx.createBiquadFilter(); echoFilter.type = 'lowpass'; echoFilter.frequency.value = 3200;
    echoOut = ctx.createGain(); echoOut.gain.value = g.echoMix;
    echoIn.connect(echoDelay); echoDelay.connect(echoFilter); echoFilter.connect(echoFb); echoFb.connect(echoDelay);
    echoFilter.connect(echoOut); echoOut.connect(masterFilter);
    syncEcho();
    ENGINE_IDS.forEach(id => {
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass';
      const drive = ctx.createWaveShaper(); setDrive(drive, params[id].drive);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      const level = ctx.createGain();
      const an = ctx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.7;
      const sA = ctx.createGain(), sB = ctx.createGain();
      filter.connect(drive); drive.connect(pan); pan.connect(level);
      level.connect(masterFilter); level.connect(an);
      level.connect(sA); sA.connect(spaceIn); level.connect(sB); sB.connect(echoIn);
      chans[id] = { filter, drive, pan, level, sA, sB };
      analysers[id] = an;
      applyChan(id);
    });
  }
  function setDrive(node, amt) {
    const n = 128, c = new Float32Array(n), k = 1 + amt * 14;
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
    node.curve = c;
  }
  function cutoffHz(v) { return 60 * Math.pow(300, v); } // 60Hz..18kHz
  function applyChan(id) {
    if (!ctx) return;
    const p = params[id], c = chans[id], t = ctx.currentTime;
    c.filter.frequency.setTargetAtTime(cutoffHz(p.cutoff), t, 0.03);
    c.filter.Q.setTargetAtTime(0.5 + p.res * 14, t, 0.03);
    setDrive(c.drive, p.drive);
    if (c.pan.pan) c.pan.pan.setTargetAtTime(p.pan, t, 0.03);
    const anySolo = ENGINE_IDS.some(k => params[k].solo);
    const audible = !p.mute && (!anySolo || p.solo);
    c.level.gain.setTargetAtTime(audible ? p.level : 0, t, 0.06);
    c.sA.gain.setTargetAtTime(p.sendA, t, 0.05);
    c.sB.gain.setTargetAtTime(p.sendB, t, 0.05);
  }
  function syncEcho() { if (echoDelay) echoDelay.delayTime.setTargetAtTime(60 / g.bpm * 4 * g.echoDiv, ctx.currentTime, 0.08); }

  // ── voices (placeholder synthesis; replace with sample playback later) ──
  function env(gn, t, vol, p, hold) {
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(vol, t + Math.max(0.001, p.attack));
    gn.gain.linearRampToValueAtTime(vol * p.sustain, t + p.attack + p.decay);
    const off = t + p.attack + p.decay + (hold || 0);
    gn.gain.setValueAtTime(Math.max(0.0001, vol * p.sustain), off);
    gn.gain.exponentialRampToValueAtTime(0.0001, off + Math.max(0.02, p.release));
    return off + p.release + 0.1;
  }
  function tone(id, t, f, vol, hold) {
    const p = params[id], c = chans[id];
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = p.wave === 'noise' ? 'sawtooth' : p.wave;
    o.frequency.value = f * Math.pow(2, p.tune / 12);
    o.detune.value = (Math.random() - 0.5) * 6;
    const end = env(gn, t, vol, p, hold);
    o.connect(gn); gn.connect(c.filter); o.start(t); o.stop(end);
    if (p.wave === 'noise') { o.frequency.value *= 0.5; o.detune.value = Math.random() * 1200; }
    if (p.lfoDepth > 0.02) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 0.2 + p.lfoRate * 7.8;
      if (p.lfoDest === 'PITCH') { lg.gain.value = p.lfoDepth * 45; l.connect(lg); lg.connect(o.detune); }
      else if (p.lfoDest === 'LEVEL') { lg.gain.value = p.lfoDepth * vol * 0.5; l.connect(lg); lg.connect(gn.gain); }
      l.start(t); l.stop(end);
    }
  }
  function noise(t, dst, vol, dur, type, fq, q) {
    const n = Math.ceil(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    s.buffer = b; f.type = type; f.frequency.value = fq; f.Q.value = q || 1;
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gn); gn.connect(dst); s.start(t);
  }
  function membrane(t, dst, f0, f1, vol, dur) {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(dst); o.start(t); o.stop(t + dur + 0.05);
  }
  const rhythmVoice = [
    (t, dst) => membrane(t, dst, 140, 44, 0.9, 0.26),
    (t, dst) => { noise(t, dst, 0.4, 0.09, 'bandpass', 1600, 2); noise(t + 0.012, dst, 0.3, 0.07, 'bandpass', 1900, 2); },
    (t, dst) => noise(t, dst, 0.22, 0.05, 'highpass', 7500),
    (t, dst) => membrane(t, dst, 300, 210, 0.4, 0.12)
  ];
  const ancestorVoice = (t, dst, note) => {
    const f = 80 + note * 22;
    membrane(t, dst, f * 1.6, f, 0.55, 0.3);
    noise(t, dst, 0.12, 0.07, 'bandpass', 800 + note * 160, 3);
  };

  function trigger(id, lane, stepIdx, t) {
    const c = chans[id], s = seq[id];
    if (id === 'rhythm') { rhythmVoice[lane](t, c.filter); return; }
    const note = (s.notes && s.notes[stepIdx]) || 0;
    if (id === 'ancestor') { ancestorVoice(t, c.filter, note); return; }
    const f = id === 'eclipse' ? P5[note] / 2 : P5[note];
    tone(id, t, f, id === 'lunar' ? 0.28 : 0.34, id === 'lunar' ? 0.6 : 0.05);
  }

  // ── transport ────────────────────────────────────────────────────────
  function schedule() {
    while (nextT < ctx.currentTime + 0.12) {
      const t16 = 60 / g.bpm / 4;
      const swingOff = (step % 2 === 1) ? (g.swing - 0.5) * 2 * t16 : 0;
      const t = nextT + swingOff;
      ENGINE_IDS.forEach(id => {
        const s = seq[id], local = step % s.length;
        s.lanes.forEach((lane, li) => { if (lane[local]) trigger(id, li, local, t); });
      });
      const cur = step;
      stepListeners.forEach(fn => fn(cur, t - ctx.currentTime));
      step = (step + 1) % 16;
      nextT += t16;
    }
  }
  function padVoice(i, t) {
    const dst = masterFilter;
    switch (PAD_DEFS[i].id) {
      case 'kick': membrane(t, dst, 150, 42, 0.9, 0.3); break;
      case 'clap': noise(t, dst, 0.5, 0.1, 'bandpass', 1500, 2); break;
      case 'shaker': noise(t, dst, 0.3, 0.06, 'highpass', 7000); break;
      case 'perc': membrane(t, dst, 320, 180, 0.5, 0.14); break;
      case 'vocal': { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(180, t + 0.3);
        f.type = 'bandpass'; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1400, t + 0.25); f.Q.value = 6;
        gn.gain.setValueAtTime(0.4, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(f); f.connect(gn); gn.connect(spaceIn); gn.connect(dst); o.start(t); o.stop(t + 0.5); break; }
      case 'stab': [0, 3, 7].forEach(st => { const o = ctx.createOscillator(), gn = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = P5[2] * Math.pow(2, st / 12);
        gn.gain.setValueAtTime(0.14, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(gn); gn.connect(dst); gn.connect(echoIn); o.start(t); o.stop(t + 0.3); }); break;
      case 'fx': noise(t, spaceIn, 0.3, 1.2, 'bandpass', 2400, 4); break;
      case 'impact': { membrane(t, dst, 90, 30, 0.9, 0.9); noise(t, spaceIn, 0.35, 1.0, 'lowpass', 500); break; }
    }
  }

  return {
    async boot() { init(); if (ctx.state === 'suspended') await ctx.resume(); },
    play() { if (playing) return; playing = true; step = 0; nextT = ctx.currentTime + 0.06; timer = setInterval(schedule, 25); },
    stop() { playing = false; if (timer) clearInterval(timer); timer = null; },
    isPlaying: () => playing,
    onStep(fn) { stepListeners.push(fn); },
    pad(i) { if (ctx) padVoice(i, ctx.currentTime); },
    params, seq, global: g,
    setParam(id, key, val) { params[id][key] = val; applyChan(id); },
    setBpm(v) { g.bpm = Math.max(90, Math.min(150, v)); syncEcho(); },
    setSwing(v) { g.swing = Math.max(0.5, Math.min(0.7, v)); },
    setSpace(v) { g.space = v; if (spaceOut) spaceOut.gain.setTargetAtTime(v, ctx.currentTime, 0.1); },
    setEchoFb(v) { g.echoFb = v; if (echoFb) echoFb.gain.setTargetAtTime(Math.min(0.85, v), ctx.currentTime, 0.1); },
    setEchoMix(v) { g.echoMix = v; if (echoOut) echoOut.gain.setTargetAtTime(v, ctx.currentTime, 0.1); },
    setEchoDiv(v) { g.echoDiv = v; syncEcho(); },
    setMaster(v) { g.master = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    setEclipse(v) { // master macro: filter closes, space+echo swell, drive
      g.eclipse = v;
      if (!ctx) return;
      const t = ctx.currentTime;
      masterFilter.frequency.setTargetAtTime(18000 * Math.pow(0.04, v) + 120, t, 0.08);
      spaceOut.gain.setTargetAtTime(g.space + v * 0.7, t, 0.1);
      echoFb.gain.setTargetAtTime(Math.min(0.86, g.echoFb + v * 0.45), t, 0.1);
      master.gain.setTargetAtTime(g.master * (1 - v * 0.15), t, 0.1);
    },
    setXY(x, y) { // DARK<->LIGHT, GROUND<->SKY macro
      g.xy = { x, y };
      const set = (id, lv) => { params[id].level = Math.max(0.05, Math.min(1, lv)); applyChan(id); };
      set('solar', 0.25 + x * 0.75 * (0.4 + y * 0.6));
      set('lunar', 0.25 + y * 0.7 * (1 - x * 0.4));
      set('rhythm', 0.45 + (1 - y) * 0.5);
      set('ancestor', 0.25 + (1 - x) * 0.65 * (0.5 + (1 - y) * 0.5));
      set('eclipse', 0.35 + (1 - x) * 0.3 + (1 - y) * 0.3);
      params.solar.cutoff = 0.35 + x * 0.6; applyChan('solar');
      this.setSpace(0.25 + y * 0.5);
    },
    toggleStep(id, lane, i) { seq[id].lanes[lane][i] = !seq[id].lanes[lane][i]; },
    setSeqLength(id, len) { seq[id].length = len; },
    getWave(id, arr) { if (analysers[id]) analysers[id].getByteTimeDomainData(arr); },
    getLevel(id) { if (!analysers[id]) return 0; const a = new Uint8Array(64); analysers[id].getByteFrequencyData(a); let s = 0; for (let i = 0; i < 64; i++) s += a[i]; return s / (64 * 255); },
    evolve() { // musically safe changes
      ENGINE_IDS.forEach(id => {
        const p = params[id];
        p.cutoff = Math.max(0.15, Math.min(0.95, p.cutoff + (Math.random() - 0.5) * 0.25));
        p.sendA = Math.max(0, Math.min(1, p.sendA + (Math.random() - 0.5) * 0.2));
        applyChan(id);
      });
      ['solar', 'ancestor'].forEach(id => {
        const s = seq[id], lane = s.lanes[0];
        for (let k = 0; k < 3; k++) { const i = Math.floor(Math.random() * s.length); lane[i] = !lane[i]; }
        if (!lane.slice(0, s.length).some(Boolean)) lane[0] = true;
      });
      const sh = seq.rhythm.lanes[2];
      for (let k = 0; k < 2; k++) { const i = Math.floor(Math.random() * 16); if (i % 4 !== 0) sh[i] = !sh[i]; }
    },
    mutate(amt) {
      ENGINE_IDS.forEach(id => {
        const p = params[id];
        ['cutoff', 'res', 'decay', 'lfoRate', 'lfoDepth', 'sendB'].forEach(k => {
          if (Math.random() < amt) p[k] = Math.max(0.02, Math.min(0.95, p[k] + (Math.random() - 0.5) * amt));
        });
        applyChan(id);
        if (id !== 'rhythm' && Math.random() < amt) {
          const lane = seq[id].lanes[0];
          for (let k = 0; k < Math.ceil(amt * 5); k++) { const i = Math.floor(Math.random() * seq[id].length); lane[i] = !lane[i]; }
          if (!lane.slice(0, seq[id].length).some(Boolean)) lane[0] = true;
        }
      });
    },
    loadPreset(i) {
      patch = i;
      const pr = PRESETS[i];
      const base = defaultParams(), baseSeq = defaultSeq();
      ENGINE_IDS.forEach(id => { Object.assign(params[id], base[id]); Object.assign(seq[id], baseSeq[id]); });
      Object.assign(g, { bpm: 124, swing: 0.54, space: 0.45, echoFb: 0.32 });
      if (pr.tweak) { ENGINE_IDS.forEach(id => { if (pr.tweak[id]) Object.assign(params[id], pr.tweak[id]); });
        if (pr.tweak.global) { if (pr.tweak.global.bpm) g.bpm = pr.tweak.global.bpm; if (pr.tweak.global.swing) g.swing = pr.tweak.global.swing; if (pr.tweak.global.space != null) g.space = pr.tweak.global.space; if (pr.tweak.global.echoFb != null) g.echoFb = pr.tweak.global.echoFb; } }
      if (ctx) { ENGINE_IDS.forEach(applyChan); syncEcho(); this.setSpace(g.space); this.setEchoFb(g.echoFb); }
      return pr;
    },
    getPatch: () => ({ i: patch, ...PRESETS[patch] })
  };
}
