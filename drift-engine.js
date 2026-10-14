// Sound-bath engine for the Frequency chamber.
// Each form = an evolving binaural drone + texture + generative struck instruments (bowls, gongs, chimes, kalimba).
// Optional 16-step drum machine layers on top (setBeat).
const N = n => 440 * Math.pow(2, (n - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
export const FORMS = {
  solar:    { color: '#D4A437', drone: [48, 55, 64], cut: 1600, tex: null, texLv: 0,
    inst: [{ kind: 'bowl', notes: [60, 64, 67, 72], gap: [7, 13], vel: 1 }, { kind: 'chime', notes: [84, 88, 91, 93, 96], gap: [10, 20], cluster: 3, vel: .7 }] },
  lunar:    { color: '#B8A7D9', drone: [45, 52, 57], cut: 1000, tex: 'ocean', texLv: .55,
    inst: [{ kind: 'rub', notes: [57, 64, 69, 72], gap: [11, 19], vel: 1 }, { kind: 'chime', notes: [81, 84, 88], gap: [16, 28], cluster: 2, vel: .5 }] },
  rhythm:   { color: '#53C7C0', drone: [50, 57, 62], cut: 1300, tex: null, texLv: 0,
    inst: [{ kind: 'pluck', notes: [62, 65, 69, 72, 74, 77], gap: [3, 6], motif: [3, 5], vel: .8 }, { kind: 'bowl', notes: [62, 69], gap: [12, 20], vel: .8 }] },
  ancestor: { color: '#C9945C', drone: [41, 48], cut: 800, tex: 'earth', texLv: .45,
    inst: [{ kind: 'gong', notes: [36, 41], gap: [16, 26], vel: .9 }, { kind: 'bowl', notes: [53, 60, 65], gap: [9, 16], vel: .9 }] },
  eclipse:  { color: '#D4B76A', drone: [35, 42, 47], cut: 600, tex: 'ocean', texLv: .25,
    inst: [{ kind: 'gong', notes: [35, 40], gap: [14, 24], vel: 1 }, { kind: 'chime', notes: [83, 86, 90, 95], gap: [11, 22], cluster: 4, vel: .5 }, { kind: 'rub', notes: [59, 66], gap: [12, 20], vel: .7 }] }
};
export const IDS = Object.keys(FORMS);
export const LANES = ['KICK', 'CLAP', 'HAT', 'SHAKER', 'CONGA', 'TOM'];
export function defaultPattern() {
  const on = s => Array.from({ length: 16 }, (_, i) => s.includes(i));
  return [on([0, 4, 8, 12]), on([4, 12]), on([2, 6, 10, 14]), on([1, 3, 5, 7, 9, 11, 13, 15]), on([3, 7, 10, 14]), on([15])];
}

export function createDrift() {
  let ctx, master, dry, wet, verb, an, noise, drumBus, drumSend, timer, step = 0, stepT = 0;
  const voices = {}, stepFns = [];
  const g = { depth: .5, breath: .4, space: .6, weights: {}, on: false, beat: false, bpm: 118, swing: .1, pattern: defaultPattern(), lanes: [.9, .7, .6, .5, .7, .6], len: 16, kit: 'organic', drumMix: 0 };
  const KITS = { organic: { p: 1, d: 1, b: 1 }, deep: { p: .78, d: 1.6, b: .7 }, tech: { p: 1.12, d: .65, b: 1.35 } };

  function impulse(sec) {
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2); }
    return b;
  }
  function lfo(rate, depth, target) { const o = ctx.createOscillator(), k = ctx.createGain(); o.frequency.value = rate; o.phase = Math.random(); k.gain.value = depth; o.connect(k); k.connect(target); o.start(ctx.currentTime + Math.random() * 4); return o; }
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 2.5; comp.attack.value = .05;
    an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = .82;
    dry = ctx.createGain(); wet = ctx.createGain(); verb = ctx.createConvolver(); verb.buffer = impulse(9);
    dry.connect(master); verb.connect(wet); wet.connect(master);
    master.connect(comp); comp.connect(an); an.connect(ctx.destination);
    noise = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = noise.getChannelData(c); let b = 0; for (let i = 0; i < d.length; i++) { b = .985 * b + .015 * (Math.random() * 2 - 1); d[i] = c === 0 ? b * 6 : (Math.random() * 2 - 1); } }
    drumBus = ctx.createGain(); drumBus.gain.value = .85; drumBus.connect(dry); drumSend = ctx.createGain(); drumSend.gain.value = .1; drumSend.connect(verb);
    IDS.forEach(id => {
      const f = FORMS[id], bus = ctx.createGain(), filt = ctx.createBiquadFilter(), ev = ctx.createGain();
      bus.gain.value = 0; filt.type = 'lowpass'; filt.frequency.value = f.cut; filt.Q.value = .5;
      lfo(.05, f.cut * .35, filt.frequency);
      f.drone.forEach((n, i) => {
        const base = .05 / (1 + i * .5), ng = ctx.createGain(); ng.gain.value = base;
        lfo(rnd(.012, .045), base * .7, ng.gain);
        const beat = rnd(.4, 1.3);
        [[0, -.7], [beat, .7]].forEach(([df, pan]) => {
          const o = ctx.createOscillator(), p = ctx.createStereoPanner(); o.type = 'sine'; o.frequency.value = N(n) + df; p.pan.value = pan;
          o.connect(p); p.connect(ng); o.start();
        });
        const o8 = ctx.createOscillator(), g8 = ctx.createGain(); o8.type = 'triangle'; o8.frequency.value = N(n) * 2; g8.gain.value = .25; o8.connect(g8); g8.connect(ng); o8.start();
        ng.connect(filt);
      });
      if (f.tex) {
        const src = ctx.createBufferSource(), tf = ctx.createBiquadFilter(), tg = ctx.createGain();
        src.buffer = noise; src.loop = true; tf.type = 'lowpass'; tf.frequency.value = f.tex === 'ocean' ? 650 : 170;
        tg.gain.value = f.texLv * .09; lfo(f.tex === 'ocean' ? .075 : .03, f.texLv * .075, tg.gain);
        src.connect(tf); tf.connect(tg); tg.connect(bus); src.start();
      }
      filt.connect(bus); ev.connect(bus); bus.connect(dry); bus.connect(verb);
      voices[id] = { bus, filt, ev, f, next: f.inst.map(() => 0) };
    });
    apply();
  }

  // ---- struck / rubbed instruments ----
  function partial(out, freq, amp, t, atk, dec, pan) {
    [-.6, .6].forEach((d, k) => {
      const o = ctx.createOscillator(), e = ctx.createGain(), p = ctx.createStereoPanner();
      o.type = 'sine'; o.frequency.value = freq + d * (freq > 2000 ? 1.6 : 1); p.pan.value = Math.max(-1, Math.min(1, pan + (k ? .25 : -.25)));
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(amp * .5 + 0.0001, t + atk); e.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
      o.connect(e); e.connect(p); p.connect(out); o.start(t); o.stop(t + atk + dec + .1);
    });
  }
  function strike(id, kind, note, t, vel) {
    const out = voices[id].ev, f0 = N(note), pan = rnd(-.6, .6), bright = .4 + g.depth * .9;
    if (kind === 'bowl') [[1, 1, 13], [2.71, .42, 8], [5.15, .2 * bright, 5], [8.5, .09 * bright, 3]].forEach(([r, a, d]) => partial(out, f0 * r, .16 * vel * a, t, .008, d, pan));
    else if (kind === 'rub') [[1, 1, 11], [2.71, .3, 8], [5.15, .1 * bright, 5]].forEach(([r, a, d]) => partial(out, f0 * r, .12 * vel * a, t, 2.2, d, pan));
    else if (kind === 'gong') [[1, 1, 20], [1.48, .6, 15], [2.12, .4, 11], [2.73, .3 * bright, 8], [3.41, .2 * bright, 6], [4.2, .12 * bright, 4]].forEach(([r, a, d]) => partial(out, f0 * r, .2 * vel * a, t, .06, d, pan * .5));
    else if (kind === 'chime') [[1, 1, 4.5], [3.01, .25 * bright, 2]].forEach(([r, a, d]) => partial(out, f0 * r, .05 * vel * a, t, .003, d, pan));
    else if (kind === 'pluck') [[1, 1, 1.8], [5.4, .18 * bright, .3]].forEach(([r, a, d]) => partial(out, f0 * r, .1 * vel * a, t, .004, d, pan));
  }
  function play(id, inst, t, w) {
    const v = inst.vel * Math.min(1, w * 1.2);
    if (inst.cluster) { const n = Math.ceil(rnd(1, inst.cluster)); for (let i = 0; i < n; i++) strike(id, 'chime', pick(inst.notes), t + i * rnd(.18, .55), v * rnd(.5, 1)); }
    else if (inst.motif) { const n = Math.round(rnd(inst.motif[0], inst.motif[1])); let k = Math.floor(rnd(0, inst.notes.length - 2)); for (let i = 0; i < n; i++) { k = Math.max(0, Math.min(inst.notes.length - 1, k + pick([-1, 1, 1, 2, -2]))); strike(id, 'pluck', inst.notes[k], t + i * .34, v * (i ? .75 : 1)); } }
    else strike(id, inst.kind, pick(inst.notes), t, v);
  }
  function gapFor(inst) { const dens = .45 + g.breath * 1.3; return rnd(inst.gap[0], inst.gap[1]) / dens * (g.beat ? 1.6 : 1); }

  // ---- drums ----
  function dominant() { let b = IDS[0], m = -1; IDS.forEach(id => { const w = g.weights[id] || 0; if (w > m) { m = w; b = id; } }); return FORMS[b]; }
  function drum(l, t, vel) {
    const f = dominant(), K = KITS[g.kit] || KITS.organic, out = ctx.createGain(); out.connect(drumBus); out.connect(drumSend);
    vel *= g.lanes[l] ?? 1; if (vel < .01) return;
    const env = (peak, dec0, a = .002) => { const dec = dec0 * K.d; out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(peak * vel, t + a); out.gain.exponentialRampToValueAtTime(0.0001, t + dec); };
    const tone = (f0, f1, dec) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0 * K.p, t); o.frequency.exponentialRampToValueAtTime(f1 * K.p, t + dec); o.connect(out); o.start(t); o.stop(t + 1.2); };
    const nz = (type, fq, q, dec) => { const s = ctx.createBufferSource(), bf = ctx.createBiquadFilter(); s.buffer = noise; bf.type = type; bf.frequency.value = fq * K.b; bf.Q.value = q; s.connect(bf); bf.connect(out); s.start(t, rnd(0, 3)); s.stop(t + dec + .05); };
    let root = N(f.drone[0]); while (root > 70) root /= 2;
    if (l === 0) { tone(root * 4, root, .12); env(.95, .5); }
    else if (l === 1) { nz('bandpass', 1500, .8, .2); out.gain.setValueAtTime(0.0001, t); [0, .011, .022].forEach(d => { out.gain.setValueAtTime(.5 * vel, t + d); out.gain.exponentialRampToValueAtTime(.08 * vel, t + d + .009); }); out.gain.exponentialRampToValueAtTime(0.0001, t + .22); }
    else if (l === 2) { nz('highpass', 7200, .7, .06); env(.2, .055); }
    else if (l === 3) { nz('bandpass', 4600, 1.4, .1); env(.14, .09, .012); }
    else if (l === 4) { const fq = N(f.drone[1] || f.drone[0]) * 2; tone(fq * 1.4, fq, .03); env(.32, .26); }
    else { const fq = N(f.drone[0]); tone(fq * 1.6, fq, .08); env(.4, .45); }
  }

  function schedule() {
    const now = ctx.currentTime;
    IDS.forEach(id => {
      const v = voices[id], w = g.weights[id] || 0;
      v.f.inst.forEach((inst, k) => {
        if (w < .06) { v.next[k] = 0; return; }
        if (!v.next[k]) v.next[k] = now + (k === 0 ? rnd(.3, 1.5) : rnd(3, 9));
        if (v.next[k] <= now + .1) { play(id, inst, Math.max(now + .02, v.next[k]), w); v.next[k] = now + gapFor(inst); }
      });
    });
    if (g.beat) {
      while (stepT < now + .12) {
        const s = step, at = stepT;
        g.pattern.forEach((lane, l) => { const v = lane[s]; if (v) drum(l, at, v === 2 ? 1 : .68); });
        setTimeout(() => stepFns.forEach(fn => fn(s)), Math.max(0, (at - now) * 1000));
        const base = 60 / g.bpm / 4; stepT += s % 2 === 0 ? base * (1 + g.swing) : base * (1 - g.swing);
        step = (step + 1) % g.len;
      }
    }
  }
  function apply() {
    if (!ctx) return; const t = ctx.currentTime;
    IDS.forEach(id => {
      const v = voices[id], w = g.weights[id] || 0;
      v.bus.gain.setTargetAtTime(w * (g.beat ? 1 - g.drumMix * .6 : 1), t, 1.2);
      v.filt.frequency.setTargetAtTime(v.f.cut * (.35 + g.depth * 1.5), t, .5);
    });
    drumBus.gain.setTargetAtTime(.4 + g.drumMix * .8, t, .2);
    wet.gain.setTargetAtTime(.25 + g.space * 1.2, t, .4); dry.gain.setTargetAtTime(1 - g.space * .5, t, .4);
  }
  return {
    FORMS, IDS,
    async start() { init(); if (ctx.state === 'suspended') await ctx.resume(); if (g.on) return; g.on = true; IDS.forEach(id => voices[id].next.fill(0)); master.gain.setTargetAtTime(.85, ctx.currentTime, 2); timer = setInterval(schedule, 40); },
    stop() { if (!ctx || !g.on) return; g.on = false; master.gain.setTargetAtTime(0, ctx.currentTime, 1.4); clearInterval(timer); if (g.beat) { g.beat = false; stepFns.forEach(fn => fn(-1)); } },
    isOn: () => g.on,
    setMix(w) { g.weights = w; apply(); },
    setDepth(v) { g.depth = v; apply(); },
    setBreath(v) { g.breath = v; },
    setSpace(v) { g.space = v; apply(); },
    setBeat(on) { if (on === g.beat) return; g.beat = on; step = 0; stepT = ctx ? ctx.currentTime + .08 : 0; if (!on) stepFns.forEach(fn => fn(-1)); apply(); },
    setPattern(p) { g.pattern = p; },
    setLanes(a) { g.lanes = a; },
    setLength(n) { g.len = n; if (step >= n) step = 0; },
    setKit(k) { g.kit = k; },
    setDrumMix(v) { g.drumMix = v; apply(); },
    setBpm(v) { g.bpm = v; },
    setSwing(v) { g.swing = v; },
    onStep(fn) { stepFns.push(fn); },
    hit(l) { if (ctx) drum(l, ctx.currentTime, 1); },
    level() { if (!an) return 0; const a = new Uint8Array(an.fftSize); an.getByteTimeDomainData(a); let s = 0; for (let i = 0; i < a.length; i++) { const x = (a[i] - 128) / 128; s += x * x; } return Math.sqrt(s / a.length); },
    spectrum(a) { if (an) an.getByteFrequencyData(a); else a.fill(0); },
    wave(a) { if (an) an.getByteTimeDomainData(a); else a.fill(128); },
    time: () => ctx ? ctx.currentTime : performance.now() / 1000,
    breath: () => g.breath
  };
}
