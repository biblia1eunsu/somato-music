/* ─────────────────────────────────────────────────────────────
   내장 힐링 사운드 엔진 (Web Audio API)
   유튜브가 막히거나 네트워크가 없어도 수업이 끊기지 않도록
   패드 · 펠트 피아노 · 하프 · 오르골 · 싱잉볼 · 빗소리 · 파도 · 밤 자연음
   을 실시간 합성합니다. 외부 음원 파일 없이 100% 오프라인 재생.
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* 코드 진행 — 따뜻한 장조 위주, 마지막에 이완 */
  const CH = {
    warm:    [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]],
    open:    [[50, 57, 62, 65], [48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60]],
    piano:   [[53, 60, 65, 69], [48, 55, 60, 64], [50, 57, 62, 65], [55, 62, 67, 71]],
    neo:     [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]],
    mantra:  [[50, 57, 62, 69], [48, 55, 60, 67], [45, 52, 57, 64], [50, 57, 62, 69]],
    xmas:    [[48, 55, 60, 64], [53, 60, 65, 69], [55, 62, 67, 71], [50, 57, 62, 65]],
    night:   [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [38, 45, 50, 53]]
  };

  const TEXTURES = {
    /* 수업 전 · 수업 후 대기 — 가장 잔잔한 패드 */
    waiting: { chords: CH.warm, chordDur: 16, pad: 0.5, voice: 'felt', density: 0.16,
               noteGain: 0.1, air: 0.012, bowlEvery: 34 },
    opening: { chords: CH.open, chordDur: 15, pad: 0.55, voice: 'felt', density: 0.3,
               noteGain: 0.12, air: 0.016, bowlEvery: 26 },
    bridge:  { chords: CH.piano, chordDur: 12, pad: 0.24, voice: 'felt', density: 0.85,
               noteGain: 0.16, arp: true, air: 0.008 },
    'flow-classic': { chords: CH.warm, chordDur: 13, pad: 0.42, voice: 'felt', density: 0.6,
               noteGain: 0.15, arp: true, air: 0.01, bowlEvery: 48 },
    'flow-neo': { chords: CH.neo, chordDur: 12, pad: 0.3, voice: 'harp', density: 0.72,
               noteGain: 0.13, arp: true, air: 0.008 },
    'flow-mantra': { chords: CH.mantra, chordDur: 16, pad: 0.6, voice: 'choir', density: 0.22,
               noteGain: 0.1, air: 0.014, bowlEvery: 30, pulse: 2.1 },
    'flow-xmas': { chords: CH.xmas, chordDur: 12, pad: 0.3, voice: 'box', density: 0.8,
               noteGain: 0.11, arp: true, air: 0.006 },
    cooldown: { chords: CH.open, chordDur: 15, pad: 0.5, voice: 'harp', density: 0.24,
               noteGain: 0.1, air: 0.016, bowlEvery: 40 },
    closing: { chords: CH.warm, chordDur: 16, pad: 0.48, voice: null, density: 0,
               noteGain: 0, air: 0.01, bowlEvery: 20 },

    /* 사바아사나 */
    'sava-bowl': { chords: CH.warm, chordDur: 20, pad: 0.26, voice: null, density: 0,
               noteGain: 0, air: 0.012, bowlEvery: 13, bowlGain: 0.9 },
    'sava-vocal': { chords: CH.mantra, chordDur: 18, pad: 0.62, voice: 'choir', density: 0.12,
               noteGain: 0.085, air: 0.01, bowlEvery: 44 },
    'sava-nature-rain': { chords: CH.night, chordDur: 22, pad: 0.3, voice: 'felt', density: 0.1,
               noteGain: 0.09, air: 0.02, rain: 1 },
    'sava-nature-night': { chords: CH.night, chordDur: 22, pad: 0.26, voice: null, density: 0,
               noteGain: 0, air: 0.02, night: 1 },
    'sava-harp': { chords: CH.piano, chordDur: 14, pad: 0.22, voice: 'harp', density: 0.5,
               noteGain: 0.13, arp: true, air: 0.01 },
    'sava-box': { chords: CH.xmas, chordDur: 14, pad: 0.2, voice: 'box', density: 0.5,
               noteGain: 0.1, arp: true, air: 0.006 },
    'sava-xmas': { chords: CH.xmas, chordDur: 15, pad: 0.28, voice: 'box', density: 0.42,
               noteGain: 0.1, arp: true, air: 0.008, bellMelody: true }
  };

  function Engine() {
    this.ctx = null;
    this.ready = false;
    this.playing = false;
    this.texture = null;
    this.volume = 0.62;
    this.timer = null;
    this.nextNote = 0;
    this.step = 0;
    this.padNodes = [];
    this.beds = [];
    this.bowlAt = 0;
    this.chordIndex = 0;
    this.melodyStep = 0;
    this.nextBeat = 0;
  }

  Engine.prototype.init = function () {
    if (this.ctx) return this.ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24; comp.knee.value = 26; comp.ratio.value = 2.6;
    comp.attack.value = 0.02; comp.release.value = 0.4;
    const soft = ctx.createBiquadFilter();
    soft.type = 'lowpass'; soft.frequency.value = 7200; soft.Q.value = 0.4;

    this.master = master;
    this.mix = ctx.createGain();
    this.mix.gain.value = 0.9;

    // 타종은 배경 음악 위에서도 들려야 하므로 별도 버스로 보냅니다.
    this.fx = ctx.createGain();
    this.fx.gain.value = this.volume * 0.75;
    this.fx.connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = this._impulse(3.1, 2.4);
    const wet = ctx.createGain(); wet.gain.value = 0.42;
    const dry = ctx.createGain(); dry.gain.value = 0.72;

    this.mix.connect(dry).connect(soft);
    this.mix.connect(reverb).connect(wet).connect(soft);
    soft.connect(comp).connect(master).connect(ctx.destination);

    this.noise = this._noiseBuffer(3);
    this.ready = true;
    return ctx;
  };

  Engine.prototype._impulse = function (seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - t * 0.2);
      }
    }
    return buf;
  };

  Engine.prototype._noiseBuffer = function (seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      // 부드러운 핑크 노이즈
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
    }
    return buf;
  };

  Engine.prototype.resume = function () {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };

  Engine.prototype.setVolume = function (v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (!this.ready) return;
    const target = this.playing ? this.volume * 0.55 : 0;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.35);
    if (this.fx) this.fx.gain.setTargetAtTime(this.volume * 0.75, this.ctx.currentTime, 0.2);
  };

  /* ── 재생 제어 ─────────────────────────────── */
  Engine.prototype.start = function (texture, opts) {
    if (!this.init()) return;
    this.resume();
    this.texture = TEXTURES[texture] ? texture : 'waiting';
    this.playing = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.volume * 0.55, t, 0.6);

    this._clearPads(1.2);
    this._clearBeds(1.2);
    this.nextNote = t + 0.25;
    this.nextBeat = t + 0.4;
    this.chordIndex = 0;
    this.step = 0;
    this.bowlAt = t + (opts && opts.firstBowl ? 1.2 : 6);
    this._buildBeds();
    if (!this.timer) this.timer = setInterval(this._tick.bind(this), 220);
    this._tick(true);
  };

  Engine.prototype.stop = function (fade) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const f = fade == null ? 1.4 : fade;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.0001, t, f / 3);
    this._clearPads(f);
    this._clearBeds(f);
    clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
  };

  Engine.prototype._clearPads = function (fade) {
    const t = this.ctx.currentTime;
    this.padNodes.forEach((n) => {
      try {
        n.gain.gain.cancelScheduledValues(t);
        n.gain.gain.setTargetAtTime(0.0001, t, (fade || 1) / 3);
        n.oscs.forEach((o) => { try { o.stop(t + fade + 0.6); } catch (e) {} });
      } catch (e) {}
    });
    this.padNodes = [];
  };

  Engine.prototype._clearBeds = function (fade) {
    const t = this.ctx.currentTime;
    this.beds.forEach((b) => {
      try {
        b.gain.gain.cancelScheduledValues(t);
        b.gain.gain.setTargetAtTime(0.0001, t, (fade || 1) / 3);
        setTimeout(() => { try { b.src.stop(); } catch (e) {} }, (fade + 1) * 1000);
      } catch (e) {}
    });
    this.beds = [];
  };

  /* ── 스케줄러 ─────────────────────────────── */
  Engine.prototype._tick = function (immediate) {
    if (!this.playing || !this.ctx) return;
    const cfg = TEXTURES[this.texture];
    const now = this.ctx.currentTime;
    const horizon = now + (immediate ? 0.9 : 0.6);

    // 코드 진행 (패드)
    if (cfg.pad > 0 && this.nextChordAt == null) this.nextChordAt = now + 0.05;
    if (cfg.pad > 0) {
      while (this.nextChordAt < horizon) {
        const ch = cfg.chords[this.chordIndex % cfg.chords.length];
        const dur = cfg.chordDur;
        this._pad(ch, this.nextChordAt, dur, cfg.pad);
        this.nextChordAt += dur;
        this.chordIndex++;
      }
    } else {
      this.nextChordAt = null;
    }

    // 멜로디/아르페지오
    if (cfg.voice && cfg.density > 0) {
      const beat = cfg.arp ? 0.62 : 1.9;
      while (this.nextNote < horizon) {
        if (Math.random() < cfg.density) {
          const ch = cfg.chords[this.chordIndex % cfg.chords.length];
          const pool = cfg.arp ? ch.concat([ch[0] + 12, ch[1] + 12]) : ch;
          const midi = pool[Math.floor(Math.random() * pool.length)] + (cfg.arp && Math.random() < 0.4 ? 12 : 0);
          this._note(cfg.voice, mtof(midi), this.nextNote, cfg.noteGain, 2.6 + Math.random() * 1.4);
        }
        this.nextNote += beat * (0.85 + Math.random() * 0.3);
      }
    }

    // 크리스마스 사바아사나 — 조용한 캐럴 멜로디 (Silent Night 첫 구절)
    if (cfg.bellMelody) {
      const melody = [64, 64, 67, 64, 60, 59, 64, 67, 72, 71, 67, 64, 60, 59, 64, 67, 71];
      const beat = 0.95;
      while (this.nextBeat < horizon) {
        const m = melody[this.melodyStep % melody.length];
        if (this.melodyStep % 2 === 0 || Math.random() < 0.5) {
          this._note('box', mtof(m), this.nextBeat, 0.075, 2.4);
        }
        if (this.melodyStep % 4 === 0) this._note('felt', mtof(m - 12), this.nextBeat, 0.05, 3.2);
        this.melodyStep++;
        this.nextBeat += beat;
      }
    }

    // 만트라 결 — 낮은 심장 박동 같은 부드러운 펄스
    if (cfg.pulse) {
      while (this.nextBeat < horizon) {
        this._note('felt', mtof(cfg.chords[0][0] - 12), this.nextBeat, 0.05, 3.4);
        this.nextBeat += cfg.pulse;
      }
    }

    // 싱잉볼 타종
    if (cfg.bowlEvery) {
      if (this.bowlAt < horizon) {
        this.chime((cfg.bowlGain || 0.55) * (0.8 + Math.random() * 0.4), this.bowlAt);
        this.bowlAt += cfg.bowlEvery * (0.78 + Math.random() * 0.5);
      }
    }

    // 빗방울 · 자연음 랜덤
    if (cfg.rain && Math.random() < 0.5) this._drop(now + Math.random() * 0.5);
    if (cfg.night && Math.random() < 0.35) this._cricket(now + Math.random() * 0.5);
    if (cfg.air) this._air(now + Math.random() * 0.5, cfg.air);
  };

  /* ── 보이스 ───────────────────────────────── */
  Engine.prototype._pad = function (chord, t, dur, level) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 720 + Math.random() * 260;
    filt.Q.value = 0.6;
    g.connect(filt).connect(this.mix);

    const oscs = [];
    chord.forEach((midi, i) => {
      const f = mtof(midi);
      for (let k = 0; k < 2; k++) {
        const o = ctx.createOscillator();
        o.type = k ? 'triangle' : 'sine';
        o.frequency.value = f * (k ? 2.005 : 1);
        o.detune.value = (Math.random() - 0.5) * 8;
        const og = ctx.createGain();
        og.gain.value = k ? 0.18 : 0.5;
        o.connect(og).connect(g);
        o.start(t);
        o.stop(t + dur + 4.5);
        oscs.push(o);
      }
    });

    // 느린 숨결 같은 LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.05;
    const lg = ctx.createGain(); lg.gain.value = 140;
    lfo.connect(lg).connect(filt.frequency);
    lfo.start(t); lfo.stop(t + dur + 4.5);

    const peak = 0.055 * level * (0.9 + Math.random() * 0.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 3.2);
    g.gain.setValueAtTime(peak, t + dur * 0.82);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 4.2);
    this.padNodes.push({ gain: g, oscs: oscs.concat([lfo]) });
    if (this.padNodes.length > 8) this.padNodes.shift();
  };

  Engine.prototype._note = function (voice, freq, t, gain, dur) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = (Math.random() - 0.5) * 0.5; g.connect(pan).connect(this.mix); }
    else g.connect(this.mix);

    const oscs = [];
    const add = (type, mult, amp, detune) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq * mult;
      o.detune.value = detune || 0;
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t);
      oscs.push(o);
      return o;
    };

    let attack = 0.006, decay = dur;
    if (voice === 'felt') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2300; lp.Q.value = 0.3;
      g.disconnect(); if (pan) pan.disconnect();
      g.connect(lp);
      if (pan) lp.connect(pan).connect(this.mix); else lp.connect(this.mix);
      add('sine', 1, 0.9);
      add('sine', 2.002, 0.16, (Math.random() - 0.5) * 6);
      add('triangle', 3.01, 0.05);
      attack = 0.012;
    } else if (voice === 'harp') {
      add('triangle', 1, 0.7);
      add('sine', 2, 0.3);
      add('sine', 3, 0.08);
      decay = Math.min(dur, 2.4);
    } else if (voice === 'box') {
      // 오르골 — 배음이 맑고 짧게
      const parts = [[1, 0.6], [3.01, 0.22], [5.02, 0.08], [7.1, 0.04]];
      parts.forEach(([m, a]) => add('sine', m, a, (Math.random() - 0.5) * 4));
      decay = Math.min(dur, 1.9); attack = 0.002;
    } else if (voice === 'choir') {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 820; bp.Q.value = 1.1;
      const g2 = ctx.createGain(); g2.gain.value = 1;
      g.disconnect();
      g.connect(bp).connect(g2);
      if (pan) g2.connect(pan).connect(this.mix); else g2.connect(this.mix);
      const o = add('sawtooth', 1, 0.16);
      const v = ctx.createOscillator(); v.frequency.value = 4.4 + Math.random();
      const vg = ctx.createGain(); vg.gain.value = 5;
      v.connect(vg).connect(o.detune); v.start(t); oscs.push(v);
      add('sine', 2, 0.06);
      attack = 0.8; decay = Math.max(dur, 3);
    } else {
      add('sine', 1, 0.8); add('sine', 2, 0.2);
    }

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    oscs.forEach((o) => { try { o.stop(t + attack + decay + 0.3); } catch (e) {} });
  };

  /* 싱잉볼 타종 — 수업 중 은은하게 */
  Engine.prototype.chime = function (gain, at) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = at == null ? ctx.currentTime + 0.05 : at;
    const base = 196 * (0.94 + Math.random() * 0.12);
    const out = ctx.createGain();
    out.gain.value = (gain == null ? 0.6 : gain) * 0.34;
    out.connect(this.fx || this.mix);

    const parts = [[1, 0.5, 9], [2.76, 0.26, 6.5], [5.4, 0.13, 4.5], [8.9, 0.06, 3]];
    parts.forEach(([m, a, dec]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(a, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dec + 0.2);
    });

    // 망치가 닿는 소리
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.06, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp).connect(ng).connect(out);
    try { src.start(t); src.stop(t + 0.3); } catch (e) {}
  };

  /* ── 환경음 ───────────────────────────────── */
  Engine.prototype._buildBeds = function () {
    const cfg = TEXTURES[this.texture];
    if (!cfg) return;
    const ctx = this.ctx, t = ctx.currentTime;

    if (cfg.rain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2100;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 260;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.5, t, 2.2);
      src.connect(hp).connect(lp).connect(g).connect(this.mix);
      src.start(t);
      this.beds.push({ src, gain: g });
    }
    if (cfg.night) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.22, t, 2.5);
      src.connect(lp).connect(g).connect(this.mix);
      src.start(t);
      this.beds.push({ src, gain: g });
    }
    if (cfg.air) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.5;
      const g = ctx.createGain(); g.gain.value = cfg.air;
      src.connect(bp).connect(g).connect(this.mix);
      src.start(t);
      this.beds.push({ src, gain: g });
    }
  };

  Engine.prototype._drop = function (t) {
    const ctx = this.ctx;
    const base = 900 + Math.random() * 1800;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.02, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.mix);
    o.start(t); o.stop(t + 0.2);
  };

  Engine.prototype._cricket = function (t) {
    const ctx = this.ctx;
    const base = 3900 + Math.random() * 900;
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = base;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.055;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(0.012, s + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.035);
    }
    o.connect(g).connect(this.mix);
    o.start(t); o.stop(t + 0.3);
  };

  Engine.prototype._air = function (t, gain) {
    if (!this.noise) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 600 + Math.random() * 1200; bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain * 1.4, t + 1.4);
    g.gain.linearRampToValueAtTime(0.0001, t + 3.6);
    src.connect(bp).connect(g).connect(this.mix);
    src.start(t, Math.random() * 2, 3.8);
  };

  global.SomatoAudio = { Engine, mtof };
})(typeof window !== 'undefined' ? window : globalThis);
