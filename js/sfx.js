/* Sonido sintetizado con Web Audio (sin archivos de audio): toques, cuenta regresiva, "shh" del peinado que sigue al dedo,
   notas que suben con cada hebra, fanfarria de victoria y un colchón suave durante el juego. Se activa con el primer toque
   (los celulares no dejan sonar antes) y se puede silenciar con el botón; la elección se recuerda. */
(function () {
  const TT = (window.TT = window.TT || {});
  const sfx = (TT.sfx = { muted: false, ctx: null });
  try { sfx.muted = TT.store && TT.store.get('tt_mute') === '1'; } catch (e) {}
  let master, noise, sw = null, pad = null;
  const ok = () => sfx.ctx && !sfx.muted && sfx.ctx.state !== 'closed';
  const hz = (semi) => 523.25 * Math.pow(2, semi / 12);                 // nota base: do5
  const PENTA = [0, 2, 4, 7, 9];

  sfx.unlock = function () {
    if (!sfx.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try {
        sfx.ctx = new AC(); const comp = sfx.ctx.createDynamicsCompressor();
        master = sfx.ctx.createGain(); master.gain.value = sfx.muted ? 0 : 0.8; master.connect(comp); comp.connect(sfx.ctx.destination);
        const n = sfx.ctx.sampleRate, b = sfx.ctx.createBuffer(1, n, n), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noise = b;
      } catch (e) { sfx.ctx = null; return; }
    }
    if (sfx.ctx.state === 'suspended') sfx.ctx.resume();
  };
  sfx.toggle = function () {
    sfx.muted = !sfx.muted; try { TT.store.set('tt_mute', sfx.muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(sfx.muted ? 0 : 0.8, sfx.ctx.currentTime, 0.03);
    if (!sfx.muted) { sfx.unlock(); sfx.tap(); }
    return sfx.muted;
  };

  function tone(f, t0, dur, o) {
    o = o || {}; const c = sfx.ctx, t = c.currentTime + (t0 || 0), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.15, t + (o.att || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + 0.05);
  }
  function burst(t0, dur, f, q, vol, type) {
    const c = sfx.ctx, t = c.currentTime + (t0 || 0), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise; fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q || 1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
  }

  sfx.tap = function () { if (!ok()) return; tone(520, 0, 0.09, { type: 'triangle', vol: 0.1, to: 820 }); };
  sfx.tick = function () { if (!ok()) return; tone(440, 0, 0.14, { vol: 0.16 }); tone(880, 0, 0.08, { vol: 0.04 }); };
  sfx.go = function () { if (!ok()) return; [0, 4, 7, 12].forEach((s, i) => tone(hz(s), i * 0.055, 0.3, { type: 'triangle', vol: 0.14 })); burst(0, 0.25, 6000, 0.6, 0.05); };
  sfx.low = function () { if (!ok()) return; tone(988, 0, 0.07, { type: 'square', vol: 0.045 }); };
  sfx.strand = function (n) {   // cada hebra liberada suena una nota más aguda (escala pentatónica)
    if (!ok()) return; const i = n - 1, s = PENTA[i % 5] + 12 * Math.min(2, Math.floor(i / 5)) - 12;
    tone(hz(s), 0, 0.42, { vol: 0.12 }); tone(hz(s) * 2, 0.01, 0.25, { type: 'triangle', vol: 0.04 });
  };
  sfx.ouch = function () { if (!ok()) return; tone(190, 0, 0.28, { type: 'sawtooth', vol: 0.09, to: 80 }); burst(0, 0.18, 400, 0.8, 0.08, 'lowpass'); };
  sfx.win = function () {
    if (!ok()) return; [0, 4, 7, 12, 16, 19].forEach((s, i) => { tone(hz(s), i * 0.09, 0.55, { type: 'triangle', vol: 0.13 }); tone(hz(s) * 2, i * 0.09 + 0.01, 0.35, { vol: 0.035 }); });
    [0, 4, 7, 12].forEach((s) => tone(hz(s) / 2, 0.6, 1.1, { vol: 0.07 })); burst(0.5, 0.7, 7000, 0.5, 0.05, 'highpass');
  };
  sfx.lose = function () { if (!ok()) return; [392, 349, 294].forEach((f, i) => tone(f, i * 0.16, 0.4, { type: 'triangle', vol: 0.11 })); };
  sfx.coupon = function () { if (!ok()) return; [1318, 1568, 1976, 2637].forEach((f, i) => tone(f, i * 0.07, 0.5, { vol: 0.06 })); };
  sfx.count = function (k) { if (!ok()) return; tone(900 + k * 40, 0, 0.04, { type: 'triangle', vol: 0.035 }); };

  /* "Shh" del peinado: ruido filtrado que sigue la velocidad del dedo (agudo hacia abajo, grave y áspero hacia arriba) */
  sfx.swishStart = function () {
    if (!ok() || sw) return; const c = sfx.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise; s.loop = true; fl.type = 'bandpass'; fl.Q.value = 0.9; fl.frequency.value = 2200; g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(); sw = { s, fl, g };
  };
  sfx.swish = function (speed, down) {
    if (!sw || !ok()) return; const t = sfx.ctx.currentTime, v = Math.min(1, speed / 6);
    sw.g.gain.setTargetAtTime(v * 0.16, t, 0.03); sw.fl.frequency.setTargetAtTime(down ? 1800 + v * 3200 : 500 + v * 700, t, 0.04);
  };
  sfx.swishStop = function () {
    if (!sw) return; const x = sw; sw = null;
    if (sfx.ctx) { x.g.gain.setTargetAtTime(0, sfx.ctx.currentTime, 0.04); setTimeout(() => { try { x.s.stop(); } catch (e) {} }, 250); }
  };

  /* Colchón suave de acordes mientras se juega */
  sfx.padStart = function () {
    if (!ok() || pad) return; const c = sfx.ctx, g = c.createGain(), fl = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain(), os = [];
    fl.type = 'lowpass'; fl.frequency.value = 800; lfo.frequency.value = 0.18; lg.gain.value = 300; lfo.connect(lg); lg.connect(fl.frequency); lfo.start();
    g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 1.6); fl.connect(g); g.connect(master);
    [261.6, 329.6, 392, 493.9].forEach((f, i) => { [-5, 5].forEach((d) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = d + i; o.connect(fl); o.start(); os.push(o); }); });
    pad = { g, os, lfo };
  };
  sfx.padStop = function () {
    if (!pad) return; const p = pad; pad = null;
    if (sfx.ctx) { p.g.gain.cancelScheduledValues(sfx.ctx.currentTime); p.g.gain.setTargetAtTime(0.0001, sfx.ctx.currentTime, 0.25); }
    setTimeout(() => { p.os.forEach((o) => { try { o.stop(); } catch (e) {} }); try { p.lfo.stop(); } catch (e) {} }, 1500);
  };
  document.addEventListener('visibilitychange', () => { if (!sfx.ctx) return; if (document.hidden) sfx.ctx.suspend(); else if (!sfx.muted) sfx.ctx.resume(); });
})();
