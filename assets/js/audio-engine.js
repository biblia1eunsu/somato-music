/* ─────────────────────────────────────────────────────────────
   내장 힐링 사운드 엔진 (Web Audio API) v3
   유튜브가 막히거나 네트워크가 없어도 수업이 끊기지 않도록
   패드 · 펠트 피아노 · 하프 · 오르골 · 싱잉볼을 실시간 합성합니다.
   외부 음원 파일 없이 100% 오프라인 재생.

   v3 — "맑고 조용한 소리"로 다시 설계
   · 화이트/핑크 노이즈로 만들던 빗소리 · 밤 자연음 · 바람 소리를 모두 걷어냈습니다
     (노이즈는 귀에 '쉬익' 하는 소리로 들려 맑음과 거리가 멀었습니다)
   · 톱니파(sawtooth) 보컬을 사인파 스택으로 바꾸고, 낮은 드론의 탁한 저역을
     하이패스로 걸러냈습니다
   · 마스터 메이크업 게인을 낮추고(1.65 → 1.0) 컴프레서를 부드럽게,
     톱은 5.2kHz에서 완만하게 정리해 쏘는 고음과 먹먹한 저역을 없앴습니다
   · 세기는 전반적으로 20~30% 낮춰 수업 공간에 은은하게 깔리도록 했습니다
   · 두 개의 덱(deck)을 두고 3.5초 크로스페이드 — 대기 음악 → 수업,
     구간 전환, 테마·모드 전환에서 소리가 끊기지 않고 겹쳐서 넘어갑니다
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const FADE_MS = 3500;

  /* 코드 진행 — 따뜻한 장조 위주, 마지막에 이완 */
  const CH = {
    warm:    [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]],
    open:    [[50, 57, 62, 65], [48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60]],
    piano:   [[53, 60, 65, 69], [48, 55, 60, 64], [50, 57, 62, 65], [55, 62, 67, 71]],
    neo:     [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]],
    mantra:  [[50, 57, 62, 69], [48, 55, 60, 67], [45, 52, 57, 64], [50, 57, 62, 69]],
    xmas:    [[48, 55, 60, 64], [53, 60, 65, 69], [55, 62, 67, 71], [50, 57, 62, 65]],
    night:   [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [38, 45, 50, 53]],
    drone:   [[45, 52, 57], [43, 50, 55], [41, 48, 53], [45, 52, 57]]
  };

  /* pad = 패드 세기 · density = 건반 밀도 · noteGain = 한 음의 세기 */
  const TEXTURES = {
    /* 수업 전 · 수업 후 대기 — 가장 잔잔하고 맑은 패드 */
    waiting: { chords: CH.warm, chordDur: 16, pad: 0.34, voice: 'felt', density: 0.12,
               noteGain: 0.07, shimmer: 0.004, bowlEvery: 40 },
    opening: { chords: CH.open, chordDur: 15, pad: 0.38, voice: 'felt', density: 0.22,
               noteGain: 0.085, shimmer: 0.005, bowlEvery: 30 },
    bridge:  { chords: CH.piano, chordDur: 12, pad: 0.16, voice: 'felt', density: 0.8,
               noteGain: 0.11, arp: true, shimmer: 0.002 },
    'flow-classic': { chords: CH.warm, chordDur: 13, pad: 0.28, voice: 'felt', density: 0.5,
               noteGain: 0.1, arp: true, shimmer: 0.003, bowlEvery: 50 },
    'flow-neo': { chords: CH.neo, chordDur: 12, pad: 0.2, voice: 'harp', density: 0.6,
               noteGain: 0.095, arp: true, shimmer: 0.002 },
    'flow-mantra': { chords: CH.mantra, chordDur: 16, pad: 0.4, voice: 'choir', density: 0.18,
               noteGain: 0.07, shimmer: 0.004, bowlEvery: 34 },
    'flow-xmas': { chords: CH.xmas, chordDur: 12, pad: 0.2, voice: 'box', density: 0.66,
               noteGain: 0.08, arp: true, shimmer: 0.002 },
    cooldown: { chords: CH.open, chordDur: 15, pad: 0.33, voice: 'harp', density: 0.2,
               noteGain: 0.075, shimmer: 0.004, bowlEvery: 44 },
    closing: { chords: CH.warm, chordDur: 16, pad: 0.32, voice: null, density: 0,
               noteGain: 0, shimmer: 0.003, bowlEvery: 22 },

    /* 사바아사나 */
    'sava-bowl': { chords: CH.warm, chordDur: 20, pad: 0.18, voice: null, density: 0,
               noteGain: 0, shimmer: 0.003, bowlEvery: 14, bowlGain: 0.7 },
    'sava-vocal': { chords: CH.mantra, chordDur: 18, pad: 0.42, voice: 'choir', density: 0.08,
               noteGain: 0.065, shimmer: 0.003, bowlEvery: 46 },
    'sava-song': { chords: CH.warm, chordDur: 21, pad: 0.26, voice: 'felt', density: 0.06,
               noteGain: 0.06, shimmer: 0.004, bowlEvery: 40 },
    'sava-piano': { chords: CH.piano, chordDur: 15, pad: 0.15, voice: 'felt', density: 0.34,
               noteGain: 0.09, arp: true, shimmer: 0.003, bowlEvery: 54 },
    'sava-nature-rain': { chords: CH.night, chordDur: 22, pad: 0.22, voice: 'felt', density: 0.08,
               noteGain: 0.06, shimmer: 0.005, drops: 1 },
    'sava-nature-night': { chords: CH.night, chordDur: 22, pad: 0.2, voice: null, density: 0,
               noteGain: 0, shimmer: 0.006 },
    'sava-harp': { chords: CH.piano, chordDur: 14, pad: 0.15, voice: 'harp', density: 0.42,
               noteGain: 0.095, arp: true, shimmer: 0.003 },
    'sava-box': { chords: CH.xmas, chordDur: 14, pad: 0.14, voice: 'box', density: 0.42,
               noteGain: 0.075, arp: true, shimmer: 0.002 },
    'sava-xmas': { chords: CH.xmas, chordDur: 15, pad: 0.2, voice: 'box', density: 0.36,
               noteGain: 0.075, arp: true, shimmer: 0.003, bellMelody: true },

    /* 바디스캔 명상 — 멜로디도 가사도 없이, 아주 낮은 드론과 숨결만 */
    bodyscan: { chords: CH.drone, chordDur: 34, pad: 0.15, voice: null, density: 0,
               noteGain: 0, shimmer: 0.006, drone: 1, bowlEvery: 60, bowlGain: 0.25 }
  };

  /* ── 엔진 ─────────────────────────────────── */
  function Engine() {
    this.ctx = null;
    this.ready = false;
    this.volume = 0.42;
    this.decks = [];
    this.active = -1;
    this.fadeMs = FADE_MS;
    this.playing = false;
    this.texture = null;
    this.streamDest = null;
    this.peakHold = 0;
  }

  Engine.FADE_MS = FADE_MS;
  Engine.TEXTURES = TEXTURES;

  Engine.prototype.init = function () {
    if (this.ctx) return this.ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    this.ctx = ctx;

    /* ── 출력단: 마스터 볼륨 → 저역/고역 정리 → 리미터 → 분석기 ── */
    const master = ctx.createGain();
    master.gain.value = 0;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.18;

    /* 아주 부드러운 컴프레서 — 큰 소리만 살짝 눌러 줍니다 */
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 18;
    comp.ratio.value = 2.0;
    comp.attack.value = 0.03;
    comp.release.value = 0.5;

    /* 탁한 저역과 쏘는 고음을 걷어내 맑게 */
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 62;
    hpf.Q.value = 0.5;

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 5200;
    lpf.Q.value = 0.3;

    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 3000;
    shelf.gain.value = -2.6;

    this.master = master;
    this.mix = ctx.createGain();
    this.mix.gain.value = 1;

    /* 타종은 배경 음악 위에서도 들려야 하므로 별도 버스 */
    this.fx = ctx.createGain();
    this.fx.gain.value = this.volume * 0.55;
    this.fx.connect(master);

    const reverb = ctx.createConvolver();
    reverb.buffer = this._impulse(3.2, 2.8);
    const wet = ctx.createGain(); wet.gain.value = 0.3;
    const dry = ctx.createGain(); dry.gain.value = 0.82;

    this.mix.connect(dry).connect(hpf);
    this.mix.connect(reverb).connect(wet).connect(hpf);
    hpf.connect(shelf).connect(lpf).connect(comp).connect(limiter).connect(master);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    master.connect(analyser);
    this.direct = ctx.destination;
    analyser.connect(this.direct);
    this.analyser = analyser;

    /* iOS: Web Audio 를 MediaStream 으로 <audio> 에 물려 화면이 꺼져도 재생이 이어지게 합니다. */
    try {
      if (ctx.createMediaStreamDestination) {
        this.streamDest = ctx.createMediaStreamDestination();
        this.viaElement = false;
      }
    } catch (e) { this.streamDest = null; }

    this.decks = [new Deck(this), new Deck(this)];
    this.active = 0;
    this.ready = true;
    return ctx;
  };

  Engine.prototype.useElement = function (on) {
    if (!this.ready || !this.streamDest) return false;
    if (on === !!this.viaElement) return on;
    try { this.analyser.disconnect(); } catch (e) {}
    this.analyser.connect(on ? this.streamDest : this.direct);
    this.viaElement = !!on;
    return on;
  };

  Engine.prototype.elementStream = function () {
    return (this.streamDest && this.streamDest.stream) || null;
  };

  Engine.prototype.level = function () {
    if (!this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  };

  Engine.prototype.peak = function () {
    if (!this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let m = 0;
    for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
    this.peakHold = Math.max(this.peakHold * 0.995, m);
    return this.peakHold;
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

  Engine.prototype.resume = function () {
    if (this.ctx && this.ctx.state !== 'running' && this.ctx.resume) this.ctx.resume();
  };

  Engine.prototype.setVolume = function (v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const target = this.playing ? Math.pow(this.volume, 1.25) * 0.9 : 0;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(target, t, 0.18);
    this.fx.gain.setTargetAtTime(this.volume * 0.55, t, 0.15);
  };

  /* ── 크로스페이드 재생 ─────────────────────────── */
  Engine.prototype.start = function (texture, opts) {
    this.init();
    if (!this.ready) return;
    this.resume();
    const fadeMs = (opts && opts.fadeMs != null) ? opts.fadeMs : this.fadeMs;
    const name = TEXTURES[texture] ? texture : 'waiting';

    const cur = this.decks[this.active];
    const next = this.decks[(this.active + 1) % this.decks.length];

    this.texture = name;
    next.start(name, opts, fadeMs);
    if (cur && cur.playing) cur.fadeOut(fadeMs);
    this.active = (this.active + 1) % this.decks.length;

    this.playing = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(Math.pow(this.volume, 1.25) * 0.9, t, 0.25);
  };

  Engine.prototype.stop = function (fade) {
    if (!this.ready) return;
    const ms = (fade == null ? 1.4 : fade) * 1000;
    this.decks.forEach((d) => { if (d.playing) d.fadeOut(ms); });
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.0001, t, Math.max(0.08, (ms / 1000) / 3));
    this.playing = false;
  };

  /* ── 덱 ──────────────────────────────────── */
  function Deck(eng) {
    this.eng = eng;
    this.out = eng.ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(eng.mix);
    this.playing = false;
    this.texture = null;
    this.pads = [];
    this.beds = [];
    this.timer = null;
    this.nextChordAt = null;
    this.nextNote = 0;
    this.nextBeat = 0;
    this.bowlAt = 0;
    this.chordIndex = 0;
    this.melodyStep = 0;
    this.fading = [];
    this._stale = false;
  }

  Deck.prototype._purge = function () {
    const t = this.eng.ctx.currentTime;
    const all = this.pads.concat(this.beds, this.fading);
    all.forEach((n) => {
      try { if (n.oscs) n.oscs.forEach((o) => o.stop(t + 0.02)); } catch (e) {}
      try { if (n.src && n.src.stop) n.src.stop(t + 0.02); } catch (e) {}
    });
    this.pads = [];
    this.beds = [];
    this.fading = [];
  };

  Deck.prototype.start = function (texture, opts, fadeMs) {
    const eng = this.eng;
    const ctx = eng.ctx;
    const t = ctx.currentTime;
    const cfg = TEXTURES[texture] || TEXTURES.waiting;

    this._purge();
    this.pads = [];
    this.beds = [];
    this.texture = texture;
    this.playing = true;
    this._stale = false;
    this.nextChordAt = t + 0.06;
    this.nextNote = t + 0.3;
    this.nextBeat = t + 0.5;
    this.chordIndex = 0;
    this.melodyStep = 0;
    this.bowlAt = t + ((opts && opts.firstBowl) ? 1.2 : 6);

    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(0.0001, t);
    this.out.gain.exponentialRampToValueAtTime(1, t + Math.max(0.35, fadeMs / 1000));

    eng._buildBeds(this);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 220);
    this.tick(true);
  };

  Deck.prototype.fadeOut = function (ms) {
    if (!this.playing) return;
    const eng = this.eng;
    const ctx = eng.ctx;
    const t = ctx.currentTime;
    const secs = Math.max(0.2, (ms == null ? eng.fadeMs : ms) / 1000);
    this.playing = false;
    this._stale = true;

    try {
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
      this.out.gain.exponentialRampToValueAtTime(0.0001, t + secs);
    } catch (e) {}

    const pads = this.pads, beds = this.beds;
    this.pads = [];
    this.beds = [];
    this.fading = this.fading.concat(pads).concat(beds);
    const self = this;
    setTimeout(() => { self.fading = self.fading.slice(pads.length + beds.length); }, (secs + 1) * 1000);
    pads.forEach((p) => {
      try { p.gain.gain.cancelScheduledValues(t);
            p.gain.gain.setValueAtTime(Math.max(0.0001, p.gain.gain.value), t);
            p.gain.gain.exponentialRampToValueAtTime(0.0001, t + secs); } catch (e) {}
      p.oscs.forEach((o) => { try { o.stop(t + secs + 0.4); } catch (e) {} });
    });
    beds.forEach((b) => {
      try { b.gain.gain.cancelScheduledValues(t);
            b.gain.gain.setTargetAtTime(0.0001, t, secs / 3); } catch (e) {}
      setTimeout(() => { try { b.src.stop(); } catch (e) {} }, (secs + 0.8) * 1000);
    });

    clearInterval(this.timer);
    this.timer = null;
  };

  Deck.prototype.tick = function (immediate) {
    if (!this.playing || !this.eng.ctx) return;
    const eng = this.eng;
    const cfg = TEXTURES[this.texture];
    if (!cfg) return;
    const now = eng.ctx.currentTime;
    const horizon = now + (immediate ? 0.9 : 0.6);

    // 코드 진행 (패드)
    if (cfg.pad > 0) {
      if (this.nextChordAt == null) this.nextChordAt = now + 0.05;
      while (this.nextChordAt < horizon) {
        const ch = cfg.chords[this.chordIndex % cfg.chords.length];
        const dur = cfg.chordDur;
        eng._pad(this, ch, this.nextChordAt, dur, cfg.pad);
        this.nextChordAt += dur;
        this.chordIndex++;
      }
    } else {
      this.nextChordAt = null;
    }

    // 멜로디/아르페지오
    if (cfg.voice && cfg.density > 0) {
      const beat = cfg.arp ? 0.62 : 1.9;
      if (this.nextNote < now - 1) this.nextNote = now + 0.2;
      while (this.nextNote < horizon) {
        if (Math.random() < cfg.density) {
          const ch = cfg.chords[this.chordIndex % cfg.chords.length];
          const pool = cfg.arp ? ch.concat([ch[0] + 12, ch[1] + 12]) : ch;
          const midi = pool[Math.floor(Math.random() * pool.length)] + (cfg.arp && Math.random() < 0.4 ? 12 : 0);
          eng._note(this, cfg.voice, mtof(midi), this.nextNote, cfg.noteGain, 2.6 + Math.random() * 1.4);
        }
        this.nextNote += beat * (0.85 + Math.random() * 0.3);
      }
    }

    // 크리스마스 사바아사나 — 조용한 캐럴 멜로디 (Silent Night 첫 구절)
    if (cfg.bellMelody) {
      const melody = [64, 64, 67, 64, 60, 59, 64, 67, 72, 71, 67, 64, 60, 59, 64, 67, 71];
      const beat = 0.95;
      if (this.nextBeat < now - 2) this.nextBeat = now + 0.3;
      while (this.nextBeat < horizon) {
        const m = melody[this.melodyStep % melody.length];
        if (this.melodyStep % 2 === 0 || Math.random() < 0.5) {
          eng._note(this, 'box', mtof(m), this.nextBeat, 0.055, 2.4);
        }
        if (this.melodyStep % 4 === 0) eng._note(this, 'felt', mtof(m - 12), this.nextBeat, 0.032, 3.2);
        this.melodyStep++;
        this.nextBeat += beat;
      }
    }

    // 싱잉볼 타종
    if (cfg.bowlEvery) {
      if (this.bowlAt < now - 4) this.bowlAt = now + 3;
      if (this.bowlAt < horizon) {
        eng.chime((cfg.bowlGain || 0.45) * (0.8 + Math.random() * 0.4), this.bowlAt);
        this.bowlAt += cfg.bowlEvery * (0.78 + Math.random() * 0.5);
      }
    }

    // 빗방울 — 유리알 같은 사인 톤만 아주 드물게
    if (cfg.drops && Math.random() < 0.35) eng._drop(this, now + Math.random() * 0.5);
    if (cfg.shimmer) eng._air(this, now + Math.random() * 0.5, cfg.shimmer);
  };

  /* ── 보이스 ───────────────────────────────── */
  Engine.prototype._pad = function (deck, chord, t, dur, level) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 620 + Math.random() * 220;
    filt.Q.value = 0.4;
    g.connect(filt).connect(deck.out);

    const oscs = [];
    chord.forEach((midi) => {
      const f = mtof(midi);
      // 사인파만 — 맑고 둥근 패드
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 5;
      const og = ctx.createGain();
      og.gain.value = 0.5;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 4.5);
      oscs.push(o);

      // 아주 옅은 옥타브 (유리 같은 윤기)
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = f * 2.002;
      o2.detune.value = (Math.random() - 0.5) * 4;
      const og2 = ctx.createGain();
      og2.gain.value = 0.08;
      o2.connect(og2).connect(g);
      o2.start(t);
      o2.stop(t + dur + 4.5);
      oscs.push(o2);
    });

    // 느린 숨결 같은 LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.04 + Math.random() * 0.05;
    const lg = ctx.createGain(); lg.gain.value = 90;
    lfo.connect(lg).connect(filt.frequency);
    lfo.start(t); lfo.stop(t + dur + 4.5);

    const peak = 0.05 * level * (0.9 + Math.random() * 0.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 3.4);
    g.gain.setValueAtTime(peak, t + dur * 0.82);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 4.2);
    deck.pads.push({ gain: g, oscs: oscs.concat([lfo]) });
    if (deck.pads.length > 8) {
      const old = deck.pads.shift();
      try { old.oscs.forEach((o) => o.stop(ctx.currentTime + 0.1)); } catch (e) {}
    }
  };

  Engine.prototype._note = function (deck, voice, freq, t, gain, dur) {
    const ctx = this.ctx;
    const out = deck.out;
    const g = ctx.createGain();
    g.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = (Math.random() - 0.5) * 0.35; }
    if (pan) g.connect(pan).connect(out); else g.connect(out);

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

    let attack = 0.008, decay = dur;
    if (voice === 'felt') {
      // 펠트 피아노 — 둥근 사인 + 옅은 배음
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.2;
      g.disconnect();
      g.connect(lp);
      if (pan) lp.connect(pan).connect(out); else lp.connect(out);
      add('sine', 1, 0.9);
      add('sine', 2.002, 0.09, (Math.random() - 0.5) * 5);
      add('sine', 3.01, 0.02);
      attack = 0.014;
    } else if (voice === 'harp') {
      add('triangle', 1, 0.5);
      add('sine', 2, 0.2);
      add('sine', 3, 0.04);
      decay = Math.min(dur, 2.4);
    } else if (voice === 'box') {
      // 오르골 — 맑고 짧은 사인 배음
      const parts = [[1, 0.5], [3.01, 0.14], [5.02, 0.04]];
      parts.forEach(([m, a]) => add('sine', m, a, (Math.random() - 0.5) * 4));
      decay = Math.min(dur, 1.9); attack = 0.003;
    } else if (voice === 'choir') {
      // 보컬 — 톱니파 대신 부드러운 사인 스택 (숨결 같은 비브라토)
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 720; bp.Q.value = 0.9;
      g.disconnect();
      g.connect(bp).connect(out);
      add('sine', 1, 0.34);
      add('sine', 2, 0.08);
      add('sine', 3, 0.02);
      const v = ctx.createOscillator(); v.frequency.value = 4.1 + Math.random();
      const vg = ctx.createGain(); vg.gain.value = 3.2;
      const o1 = oscs[0];
      v.connect(vg).connect(o1.detune); v.start(t); oscs.push(v);
      attack = 0.9; decay = Math.max(dur, 3);
    } else {
      add('sine', 1, 0.8); add('sine', 2, 0.12);
    }

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    oscs.forEach((o) => { try { o.stop(t + attack + decay + 0.3); } catch (e) {} });
  };

  /* 싱잉볼 타종 — 맑은 사인 배음만 (노이즈 타격음 없음) */
  Engine.prototype.chime = function (gain, at) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = at == null ? ctx.currentTime + 0.05 : at;
    const base = 196 * (0.94 + Math.random() * 0.12);
    const out = ctx.createGain();
    out.gain.value = (gain == null ? 0.6 : gain) * 0.26;
    out.connect(this.fx || this.mix);

    const parts = [[1, 0.5, 9], [2.76, 0.18, 6.5], [5.4, 0.07, 4.5], [8.9, 0.02, 3]];
    parts.forEach(([m, a, dec]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(a, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dec + 0.2);
    });
  };

  /* ── 환경음 (모두 사인 기반) ───────────────── */
  Engine.prototype._buildBeds = function (deck) {
    const cfg = TEXTURES[deck.texture];
    if (!cfg) return;
    const ctx = this.ctx, t = ctx.currentTime;

    if (cfg.shimmer) {
      // 아주 옅은 공기감 — 높은 사인 두 개가 천천히 부풀었다 잦아듭니다 (노이즈 아님)
      const bus = ctx.createGain();
      bus.gain.value = 0.0001;
      bus.gain.setTargetAtTime(cfg.shimmer, t, 3);
      bus.connect(deck.out);
      [1174.7, 1760].forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.002);
        const g = ctx.createGain();
        g.gain.value = i ? 0.4 : 1;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.045 + Math.random() * 0.03;
        const lg = ctx.createGain();
        lg.gain.value = i ? 0.25 : 0.6;
        lfo.connect(lg).connect(g.gain);
        o.connect(g).connect(bus);
        o.start(t); lfo.start(t);
        deck.beds.push({ src: o, gain: g });
        deck.beds.push({ src: lfo, gain: lg });
      });
    }

    if (cfg.drone) {
      // 바디스캔 — 아주 낮은 세 음의 드론과 아주 느린 숨결
      const bus = ctx.createGain();
      bus.gain.value = 0.42;
      bus.connect(deck.out);
      const base = mtof(cfg.chords[0][0] - 12);
      [[1, 0.32], [1.5, 0.07], [2, 0.03]].forEach(([mult, amp]) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = base * mult;
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        g.gain.setTargetAtTime(amp, t, 6);
        o.connect(g).connect(bus);
        o.start(t);
        deck.beds.push({ src: o, gain: g });
      });
      const breath = ctx.createOscillator();
      breath.frequency.value = 0.06;
      const bg = ctx.createGain(); bg.gain.value = 0.1;
      breath.connect(bg).connect(bus.gain);
      breath.start(t);
      deck.beds.push({ src: breath, gain: bg, bus });
    }
  };

  Engine.prototype._drop = function (deck, t) {
    const ctx = this.ctx;
    const base = 1100 + Math.random() * 1400;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.6, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.007 + Math.random() * 0.006, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(deck.out);
    o.start(t); o.stop(t + 0.22);
  };

  Engine.prototype._air = function (deck, t, gain) {
    const ctx = this.ctx;
    const base = 1400 + Math.random() * 1200;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = base;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 2.2);
    g.gain.linearRampToValueAtTime(0.0001, t + 5.5);
    o.connect(g).connect(deck.out);
    o.start(t); o.stop(t + 5.8);
  };

  global.SomatoAudio = { Engine, mtof, TEXTURES, FADE_MS };
})(typeof window !== 'undefined' ? window : globalThis);
