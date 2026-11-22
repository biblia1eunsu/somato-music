/* ─────────────────────────────────────────────────────────────
   내장 힐링 사운드 엔진 (Web Audio API) v2
   유튜브가 막히거나 네트워크가 없어도 수업이 끊기지 않도록
   패드 · 펠트 피아노 · 하프 · 오르골 · 싱잉볼 · 빗소리 · 파도 · 밤 자연음
   을 실시간 합성합니다. 외부 음원 파일 없이 100% 오프라인 재생.

   v2 변경
   · 두 개의 덱(deck)을 두고 3.5초 크로스페이드 — 대기 음악 → 수업,
     구간 전환, 테마·모드 전환에서 소리가 끊기지 않고 겹쳐서 넘어갑니다
     (이전 덱은 exponentialRampToValueAtTime 으로 줄이고, 새 덱은 0에서 올립니다)
   · 바디스캔 전용 초저자극 텍스처(bodyscan) — 멜로디·가사 없이 느린 드론과 숨결만
   · 음질: 과하지 않은 메이크업 게인, 부드러운 저역 통과 · 하이 셸프 감쇠,
     리버브/컴프레서 + 브릭월 리미터로 디지털 클리핑과 쏘는 고음을 방지
   · iOS 백그라운드 재생을 위해 MediaStreamDestination 으로 <audio> 에 연결 가능
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

  const TEXTURES = {
    /* 수업 전 · 수업 후 대기 — 가장 잔잔한 패드 */
    waiting: { chords: CH.warm, chordDur: 16, pad: 0.46, voice: 'felt', density: 0.14,
               noteGain: 0.09, air: 0.01, bowlEvery: 34 },
    opening: { chords: CH.open, chordDur: 15, pad: 0.5, voice: 'felt', density: 0.26,
               noteGain: 0.11, air: 0.014, bowlEvery: 26 },
    bridge:  { chords: CH.piano, chordDur: 12, pad: 0.22, voice: 'felt', density: 0.8,
               noteGain: 0.15, arp: true, air: 0.007 },
    'flow-classic': { chords: CH.warm, chordDur: 13, pad: 0.38, voice: 'felt', density: 0.55,
               noteGain: 0.14, arp: true, air: 0.009, bowlEvery: 48 },
    'flow-neo': { chords: CH.neo, chordDur: 12, pad: 0.28, voice: 'harp', density: 0.66,
               noteGain: 0.12, arp: true, air: 0.007 },
    'flow-mantra': { chords: CH.mantra, chordDur: 16, pad: 0.54, voice: 'choir', density: 0.2,
               noteGain: 0.09, air: 0.012, bowlEvery: 30, pulse: 2.1 },
    'flow-xmas': { chords: CH.xmas, chordDur: 12, pad: 0.28, voice: 'box', density: 0.74,
               noteGain: 0.1, arp: true, air: 0.005 },
    cooldown: { chords: CH.open, chordDur: 15, pad: 0.45, voice: 'harp', density: 0.22,
               noteGain: 0.09, air: 0.014, bowlEvery: 40 },
    closing: { chords: CH.warm, chordDur: 16, pad: 0.44, voice: null, density: 0,
               noteGain: 0, air: 0.009, bowlEvery: 20 },

    /* 사바아사나 */
    'sava-bowl': { chords: CH.warm, chordDur: 20, pad: 0.24, voice: null, density: 0,
               noteGain: 0, air: 0.011, bowlEvery: 13, bowlGain: 0.85 },
    'sava-vocal': { chords: CH.mantra, chordDur: 18, pad: 0.56, voice: 'choir', density: 0.1,
               noteGain: 0.075, air: 0.009, bowlEvery: 44 },
    'sava-song': { chords: CH.warm, chordDur: 21, pad: 0.34, voice: 'felt', density: 0.07,
               noteGain: 0.07, air: 0.012, bowlEvery: 38 },
    'sava-piano': { chords: CH.piano, chordDur: 15, pad: 0.2, voice: 'felt', density: 0.36,
               noteGain: 0.12, arp: true, air: 0.008, bowlEvery: 52 },
    'sava-nature-rain': { chords: CH.night, chordDur: 22, pad: 0.28, voice: 'felt', density: 0.09,
               noteGain: 0.08, air: 0.018, rain: 1 },
    'sava-nature-night': { chords: CH.night, chordDur: 22, pad: 0.24, voice: null, density: 0,
               noteGain: 0, air: 0.018, night: 1 },
    'sava-harp': { chords: CH.piano, chordDur: 14, pad: 0.2, voice: 'harp', density: 0.46,
               noteGain: 0.12, arp: true, air: 0.009 },
    'sava-box': { chords: CH.xmas, chordDur: 14, pad: 0.18, voice: 'box', density: 0.46,
               noteGain: 0.09, arp: true, air: 0.005 },
    'sava-xmas': { chords: CH.xmas, chordDur: 15, pad: 0.26, voice: 'box', density: 0.4,
               noteGain: 0.09, arp: true, air: 0.007, bellMelody: true },

    /* 바디스캔 명상 — 멜로디도 가사도 없이, 아주 낮은 드론과 숨결만 */
    bodyscan: { chords: CH.drone, chordDur: 34, pad: 0.2, voice: null, density: 0,
               noteGain: 0, air: 0.02, drone: 1, bowlEvery: 56, bowlGain: 0.3 }
  };

  /* ── 엔진 ─────────────────────────────────── */
  function Engine() {
    this.ctx = null;
    this.ready = false;
    this.volume = 0.62;
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

    /* ── 출력단: 마스터 볼륨 → 안전 리미터 → 분석기 ── */
    const master = ctx.createGain();
    master.gain.value = 0;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2.5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 2.6;
    comp.attack.value = 0.02;
    comp.release.value = 0.45;

    const makeup = ctx.createGain();
    makeup.gain.value = 1.65;

    /* softly roll off the very top so nothing sounds glassy or hissy */
    const soft = ctx.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 6800;
    soft.Q.value = 0.35;

    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 3400;
    shelf.gain.value = -2.2;

    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 32;
    hpf.Q.value = 0.4;

    this.master = master;
    this.mix = ctx.createGain();
    this.mix.gain.value = 1;

    /* 타종은 배경 음악 위에서도 들려야 하므로 별도 버스 */
    this.fx = ctx.createGain();
    this.fx.gain.value = this.volume * 0.7;
    this.fx.connect(master);   // 타종도 마스터 볼륨과 리미터를 함께 탑니다

    const reverb = ctx.createConvolver();
    reverb.buffer = this._impulse(3.4, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.34;
    const dry = ctx.createGain(); dry.gain.value = 0.78;

    this.mix.connect(dry).connect(soft);
    this.mix.connect(reverb).connect(wet).connect(soft);
    soft.connect(shelf);
    shelf.connect(makeup).connect(comp).connect(limiter).connect(master);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    master.connect(analyser);
    this.direct = ctx.destination;
    analyser.connect(this.direct);   // 기본은 Web Audio 직접 출력
    this.analyser = analyser;

    /* iOS: Web Audio 를 MediaStream 으로 <audio> 에 물려 화면이 꺼져도 재생이 이어지게 합니다.
       연결 시점은 useElement(true) 로 옮기고, 평소에는 직접 출력이 소리를 냅니다. */
    try {
      if (ctx.createMediaStreamDestination) {
        this.streamDest = ctx.createMediaStreamDestination();
        this.viaElement = false;
      }
    } catch (e) { this.streamDest = null; }

    this.noise = this._noiseBuffer(3);

    this.decks = [new Deck(this), new Deck(this)];
    this.active = 0;
    this.ready = true;
    return ctx;
  };

  /* iOS 백그라운드 유지용 — 출력을 <audio>(MediaStream) 쪽으로 옮기거나 되돌립니다 */
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

  /* 실제로 소리가 나오고 있는지 확인하는 레벨 미터 (0~1) */
  Engine.prototype.level = function () {
    if (!this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  };

  /* 피크 미터 — 클리핑 점검용 */
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

  Engine.prototype._noiseBuffer = function (seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;   // 부드러운 핑크 노이즈
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
    const target = this.playing ? Math.pow(this.volume, 1.15) : 0;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(target, t, 0.18);
    this.fx.gain.setTargetAtTime(this.volume * 0.7, t, 0.15);
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
    this.master.gain.setTargetAtTime(Math.pow(this.volume, 1.15), t, 0.25);
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

  /* 이 덱에 남아 있는(사라지는 중인) 소리를 즉시 정리합니다 */
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

    this._purge();           // 같은 덱을 곧바로 다시 쓰면 남은 소리는 즉시 끊습니다
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
    this.bowlAt = t + ((opts && opts.firstBowl) ? 1.2 : 5);

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
          eng._note(this, 'box', mtof(m), this.nextBeat, 0.07, 2.4);
        }
        if (this.melodyStep % 4 === 0) eng._note(this, 'felt', mtof(m - 12), this.nextBeat, 0.045, 3.2);
        this.melodyStep++;
        this.nextBeat += beat;
      }
    }

    // 만트라 결 — 낮은 심장 박동 같은 부드러운 펄스
    if (cfg.pulse) {
      if (this.nextBeat < now - 2) this.nextBeat = now + 0.3;
      while (this.nextBeat < horizon) {
        eng._note(this, 'felt', mtof(cfg.chords[0][0] - 12), this.nextBeat, 0.045, 3.4);
        this.nextBeat += cfg.pulse;
      }
    }

    // 싱잉볼 타종
    if (cfg.bowlEvery) {
      if (this.bowlAt < now - 4) this.bowlAt = now + 3;
      if (this.bowlAt < horizon) {
        eng.chime((cfg.bowlGain || 0.5) * (0.8 + Math.random() * 0.4), this.bowlAt);
        this.bowlAt += cfg.bowlEvery * (0.78 + Math.random() * 0.5);
      }
    }

    // 빗방울 · 자연음 랜덤
    if (cfg.rain && Math.random() < 0.5) eng._drop(this, now + Math.random() * 0.5);
    if (cfg.night && Math.random() < 0.35) eng._cricket(this, now + Math.random() * 0.5);
    if (cfg.air) eng._air(this, now + Math.random() * 0.5, cfg.air);
  };

  /* ── 보이스 ───────────────────────────────── */
  Engine.prototype._pad = function (deck, chord, t, dur, level) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 700 + Math.random() * 240;
    filt.Q.value = 0.5;
    g.connect(filt).connect(deck.out);

    const oscs = [];
    chord.forEach((midi) => {
      const f = mtof(midi);
      for (let k = 0; k < 2; k++) {
        const o = ctx.createOscillator();
        o.type = k ? 'triangle' : 'sine';
        o.frequency.value = f * (k ? 2.004 : 1);
        o.detune.value = (Math.random() - 0.5) * 7;
        const og = ctx.createGain();
        og.gain.value = k ? 0.14 : 0.44;
        o.connect(og).connect(g);
        o.start(t);
        o.stop(t + dur + 4.5);
        oscs.push(o);
      }
    });

    // 느린 숨결 같은 LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.04 + Math.random() * 0.05;
    const lg = ctx.createGain(); lg.gain.value = 120;
    lfo.connect(lg).connect(filt.frequency);
    lfo.start(t); lfo.stop(t + dur + 4.5);

    const peak = 0.062 * level * (0.9 + Math.random() * 0.2);
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
    if (pan) { pan.pan.value = (Math.random() - 0.5) * 0.45; }
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

    let attack = 0.006, decay = dur;
    if (voice === 'felt') {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2100; lp.Q.value = 0.25;
      g.disconnect();
      g.connect(lp);
      if (pan) lp.connect(pan).connect(out); else lp.connect(out);
      add('sine', 1, 0.85);
      add('sine', 2.002, 0.14, (Math.random() - 0.5) * 6);
      add('triangle', 3.01, 0.04);
      attack = 0.012;
    } else if (voice === 'harp') {
      add('triangle', 1, 0.62);
      add('sine', 2, 0.26);
      add('sine', 3, 0.06);
      decay = Math.min(dur, 2.4);
    } else if (voice === 'box') {
      // 오르골 — 배음이 맑고 짧게
      const parts = [[1, 0.55], [3.01, 0.2], [5.02, 0.07], [7.1, 0.03]];
      parts.forEach(([m, a]) => add('sine', m, a, (Math.random() - 0.5) * 4));
      decay = Math.min(dur, 1.9); attack = 0.002;
    } else if (voice === 'choir') {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 780; bp.Q.value = 1.0;
      const g2 = ctx.createGain(); g2.gain.value = 1;
      g.disconnect();
      g.connect(bp).connect(g2);
      if (pan) g2.connect(pan).connect(out); else g2.connect(out);
      const o = add('sawtooth', 1, 0.13);
      const v = ctx.createOscillator(); v.frequency.value = 4.3 + Math.random();
      const vg = ctx.createGain(); vg.gain.value = 4.5;
      v.connect(vg).connect(o.detune); v.start(t); oscs.push(v);
      add('sine', 2, 0.05);
      attack = 0.8; decay = Math.max(dur, 3);
    } else {
      add('sine', 1, 0.75); add('sine', 2, 0.16);
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
    out.gain.value = (gain == null ? 0.6 : gain) * 0.3;
    out.connect(this.fx || this.mix);

    const parts = [[1, 0.5, 9], [2.76, 0.22, 6.5], [5.4, 0.1, 4.5], [8.9, 0.04, 3]];
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
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp).connect(ng).connect(out);
    try { src.start(t); src.stop(t + 0.3); } catch (e) {}
  };

  /* ── 환경음 ───────────────────────────────── */
  Engine.prototype._buildBeds = function (deck) {
    const cfg = TEXTURES[deck.texture];
    if (!cfg) return;
    const ctx = this.ctx, t = ctx.currentTime;

    if (cfg.rain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.4, t, 2.2);
      src.connect(hp).connect(lp).connect(g).connect(deck.out);
      src.start(t);
      deck.beds.push({ src, gain: g });
    }
    if (cfg.night) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 850;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.18, t, 2.5);
      src.connect(lp).connect(g).connect(deck.out);
      src.start(t);
      deck.beds.push({ src, gain: g });
    }
    if (cfg.air) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.5;
      const g = ctx.createGain(); g.gain.value = cfg.air;
      src.connect(bp).connect(g).connect(deck.out);
      src.start(t);
      deck.beds.push({ src, gain: g });
    }
    if (cfg.drone) {
      // 바디스캔 — 아주 낮은 세 음의 드론과 아주 느린 숨결
      const bus = ctx.createGain();
      bus.gain.value = 0.5;
      bus.connect(deck.out);
      const base = mtof(cfg.chords[0][0] - 12);
      [[1, 0.34], [1.5, 0.09], [2, 0.045]].forEach(([mult, amp]) => {
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
      const bg = ctx.createGain(); bg.gain.value = 0.12;
      breath.connect(bg).connect(bus.gain);   // 16초 주기의 아주 느린 숨결
      breath.start(t);
      deck.beds.push({ src: breath, gain: bg, bus });
    }
  };

  Engine.prototype._drop = function (deck, t) {
    const ctx = this.ctx;
    const base = 900 + Math.random() * 1700;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.014 + Math.random() * 0.012, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(deck.out);
    o.start(t); o.stop(t + 0.2);
  };

  Engine.prototype._cricket = function (deck, t) {
    const ctx = this.ctx;
    const base = 3800 + Math.random() * 900;
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = base;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.055;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(0.008, s + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.035);
    }
    o.connect(g).connect(deck.out);
    o.start(t); o.stop(t + 0.3);
  };

  Engine.prototype._air = function (deck, t, gain) {
    if (!this.noise) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 600 + Math.random() * 1100; bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain * 1.2, t + 1.4);
    g.gain.linearRampToValueAtTime(0.0001, t + 3.6);
    src.connect(bp).connect(g).connect(deck.out);
    src.start(t, Math.random() * 2, 3.8);
  };

  global.SomatoAudio = { Engine, mtof, TEXTURES, FADE_MS };
})(typeof window !== 'undefined' ? window : globalThis);
