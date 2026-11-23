// Marlin Cove — audio.js
// All sound is synthesised with WebAudio. No audio files, no network.
(function () {
  'use strict';
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, radioTimer = null, radioStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch (e) { /* audio is best-effort */ }
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (e) { /* best-effort */ }
  }

  const SFX = {
    shoot: function () { noiseBurst(0.12, 0.5, 2500); tone(180, 0.08, 'square', 0.15, 60); },
    shotgun: function () { noiseBurst(0.3, 0.7, 900); tone(120, 0.2, 'square', 0.2, 40); },
    punch: function () { noiseBurst(0.08, 0.35, 500); },
    pickup: function () { tone(660, 0.12, 'sine', 0.2); tone(990, 0.18, 'sine', 0.2); },
    cash: function () { tone(880, 0.1, 'triangle', 0.2); setTimeout(function () { tone(1320, 0.16, 'triangle', 0.2); }, 90); },
    busted: function () { tone(220, 0.5, 'sawtooth', 0.25, 110); },
    mission: function () { tone(523, 0.14, 'triangle', 0.25); setTimeout(function () { tone(784, 0.22, 'triangle', 0.25); }, 130); },
    ui: function () { tone(440, 0.06, 'sine', 0.15); },
    explosion: function () { noiseBurst(0.9, 0.8, 400); tone(70, 0.8, 'sine', 0.4, 30); }
  };

  function startEngine() {
    if (!ensure() || engineOsc) return;
    try {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 320;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    } catch (e) { /* best-effort */ }
  }

  function setEngine(speed01, on) {
    if (!engineOsc || !engineGain) return;
    try {
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, ctx.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0.0, ctx.currentTime, 0.1);
    } catch (e) { /* best-effort */ }
  }

  function startSiren() {
    if (!ensure() || sirenOsc) return;
    try {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.05;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); lfo.start();
    } catch (e) { /* best-effort */ }
  }

  function stopSiren() {
    if (sirenOsc) { try { sirenOsc.stop(); } catch (e) {} sirenOsc = null; }
  }

  // Radio: a simple looping synthwave bassline + hats on Tide FM.
  const BASSLINE = [55, 0, 55, 65.4, 0, 55, 82.4, 73.4, 55, 0, 55, 65.4, 98, 82.4, 73.4, 65.4];
  function startRadio() {
    if (!ensure() || radioTimer) return;
    radioTimer = setInterval(function () {
      if (muted) return;
      const n = BASSLINE[radioStep % BASSLINE.length];
      radioStep++;
      if (n) tone(n, 0.22, 'triangle', 0.12);
      if (radioStep % 2 === 0) noiseBurst(0.03, 0.05, 6000);
    }, 220);
  }
  function stopRadio() {
    if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
  }

  window.MC_AUDIO = {
    unlock, SFX, startEngine, setEngine, startSiren, stopSiren,
    startRadio, stopRadio,
    setMuted: function (m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.5; }
  };
})();
