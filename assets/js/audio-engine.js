/* ─────────────────────────────────────────────────────────────
   내장 힐링 사운드 엔진 (Web Audio API) v4
   유튜브가 막히거나 네트워크가 없어도 수업이 끊기지 않도록
   하프 · 펠트 피아노 · 오르골 · 싱잉볼을 실시간 합성합니다.
   외부 음원 파일 없이 100% 오프라인 재생.

   v4 — "맑은 어쿠스틱 아르페지오"로 다시 썼습니다
   · 지속되는 패드/드론(우웅거리는 신스음)을 전부 걷어냈습니다.
     배경에서 계속 울리는 화음이 귀에 무겁게 얹히던 원인이었습니다.
   · 공기감을 만들던 높은 사인 지속음(shimmer)도 없앴습니다.
   · 남은 것은 하프 · 펠트 피아노 · 오르골의 '뜯는 소리(pluck)' 하나입니다.
     한 음이 짧게 맑게 울리고 3.2초 잔향 속으로 사라집니다.
   · 음과 음 사이에 여백을 두어 수업 공간을 채우지 않고 비워 둡니다.
   · 두 개의 덱(deck)을 두고 3.5초 크로스페이드 — 대기 음악 → 수업,
     구간 전환, 테마·모드 전환에서 소리가 끊기지 않고 겹쳐서 넘어갑니다.
   · hardStop() — 유튜브로 넘어갈 때 두 덱을 즉시 완전 정지합니다.
     (한 번에 한 소리만 나도록 app.js 가 이 함수로 내장 사운드를 끕니다)
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const FADE_MS = 3500;

  /* 코드 진행 — 따뜻한 장조 위주, 마지막에 이완 */
  const CH = {
    warm:    [[50, 57, 62, 66], [47, 54, 59, 62], [45, 52, 57, 60], [43, 50, 55, 59]],
    open:    [[52, 59, 64, 67], [50, 57, 62, 65], [45, 52, 57, 60], [47, 54, 59, 62]],
    piano:   [[53, 60, 65, 69], [48, 55, 60, 64], [55, 62, 67, 71], [50, 57, 62, 65]],
    neo:     [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]],
    mantra:  [[50, 57, 62, 69], [48, 55, 60, 67], [45, 52, 57, 64], [50, 57, 62, 69]],
    xmas:    [[48, 55, 60, 64], [53, 60, 65, 69], [55, 62, 67, 71], [50, 57, 62, 65]],
    night:   [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [38, 45, 50, 53]],
    drone:   [[45, 52, 57], [43, 50, 55], [41, 48, 53], [45, 52, 57]]
  };

  /* pattern = 화음 구성음 순서(0~3 이 화음, 4~7 은 한 옥타브 위)
     step = 음 사이 간격(초) · density = 음이 나올 확률 · hold = 한 음이 사라지는 시간
     bass = 화음이 바뀔 때 낮은 근음을 살짝 뜯는 세기 */
  const TEXTURES = {
    /* 수업 전 · 수업 후 대기 — 가장 맑고 조용한 하프 */
    waiting: { chords: CH.warm, chordDur: 15, voice: 'harp', step: 0.78, density: 0.55,
               noteGain: 0.085, hold: 2.8, pattern: [0, 2, 1, 4, 3, 2, 1, 5], bass: 0.05 },
    opening: { chords: CH.open, chordDur: 16, voice: 'piano', step: 0.9, density: 0.45,
               noteGain: 0.08, hold: 3.0, pattern: [0, 2, 1, 3, 2, 4], bass: 0.045 },
    bridge:  { chords: CH.piano, chordDur: 12, voice: 'piano', step: 0.62, density: 0.8,
               noteGain: 0.09, hold: 2.4, pattern: [0, 2, 4, 1, 3, 5, 2, 4], bass: 0.05, double: 0.15 },
    breath:  { chords: CH.piano, chordDur: 12, voice: 'piano', step: 0.62, density: 0.8,
               noteGain: 0.09, hold: 2.4, pattern: [0, 2, 4, 1, 3, 5, 2, 4], bass: 0.05, double: 0.15 },
    'flow-classic': { chords: CH.warm, chordDur: 13, voice: 'harp', step: 0.6, density: 0.72,
               noteGain: 0.085, hold: 2.2, pattern: [0, 2, 1, 4, 3, 5, 2, 6], bass: 0.05 },
    'flow-neo': { chords: CH.neo, chordDur: 12, voice: 'piano', step: 0.58, density: 0.75,
               noteGain: 0.085, hold: 2.2, pattern: [0, 3, 1, 4, 2, 5, 3, 1], bass: 0.05 },
    'flow-mantra': { chords: CH.mantra, chordDur: 16, voice: 'harp', step: 0.95, density: 0.4,
               noteGain: 0.07, hold: 3.2, pattern: [0, 2, 1, 3], bass: 0.05 },
    'flow-xmas': { chords: CH.xmas, chordDur: 12, voice: 'glass', step: 0.66, density: 0.6,
               noteGain: 0.075, hold: 1.9, pattern: [0, 2, 4, 1, 3, 5], bass: 0.045 },
    cooldown: { chords: CH.open, chordDur: 15, voice: 'harp', step: 0.85, density: 0.55,
               noteGain: 0.075, hold: 2.8, pattern: [0, 2, 1, 3, 2, 5], bass: 0.045 },
    closing: { chords: CH.warm, chordDur: 16, voice: 'glass', step: 1.6, density: 0.3,
               noteGain: 0.06, hold: 2.6, pattern: [0, 2, 1, 3], bowlEvery: 24, bowlGain: 0.4 },

    /* 사바아사나 */
    'sava-bowl': { chords: CH.warm, chordDur: 20, voice: 'harp', step: 1.6, density: 0.25,
               noteGain: 0.06, hold: 3.6, pattern: [0, 2, 1, 3], bowlEvery: 14, bowlGain: 0.65 },
    'sava-vocal': { chords: CH.mantra, chordDur: 18, voice: 'piano', step: 1.2, density: 0.35,
               noteGain: 0.07, hold: 3.4, pattern: [0, 2, 1, 3], bass: 0.05 },
    'sava-song': { chords: CH.warm, chordDur: 21, voice: 'harp', step: 1.0, density: 0.4,
               noteGain: 0.07, hold: 3.0, pattern: [0, 2, 1, 4, 3], bass: 0.045 },
    'sava-piano': { chords: CH.piano, chordDur: 15, voice: 'piano', step: 0.66, density: 0.6,
               noteGain: 0.08, hold: 2.6, pattern: [0, 2, 1, 4, 3, 2], bass: 0.05 },
    'sava-nature-rain': { chords: CH.night, chordDur: 22, voice: 'harp', step: 0.9, density: 0.4,
               noteGain: 0.065, hold: 3.2, pattern: [0, 2, 1, 3], bass: 0.04 },
    'sava-nature-night': { chords: CH.night, chordDur: 22, voice: 'glass', step: 1.4, density: 0.3,
               noteGain: 0.055, hold: 3.0, pattern: [0, 2, 1, 3] },
    'sava-harp': { chords: CH.piano, chordDur: 14, voice: 'harp', step: 0.62, density: 0.62,
               noteGain: 0.085, hold: 2.4, pattern: [0, 2, 1, 4, 3, 5, 2, 1], bass: 0.045 },
    'sava-box': { chords: CH.xmas, chordDur: 14, voice: 'glass', step: 0.6, density: 0.6,
               noteGain: 0.07, hold: 1.8, pattern: [0, 2, 4, 1, 3, 5], bass: 0.04 },
    'sava-xmas': { chords: CH.xmas, chordDur: 15, voice: 'glass', step: 1.1, density: 0.28,
               noteGain: 0.06, hold: 2.2, pattern: [0, 2, 1, 3], melody: true, bass: 0.035 },

    /* 바디스캔 명상 — 멜로디도 가사도 없이, 아주 낮은 울림과 숨결만 */
    bodyscan: { chords: CH.drone, chordDur: 34, voice: null, step: 1, density: 0,
               noteGain: 0, hold: 1, pattern: [0], drone: 1, bowlEvery: 60, bowlGain: 0.25 }
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

    /* ── 출력단: 음악 게인 → 저역/고역 정리 → 컴프 → 리미터 → 출력 ── */
    const master = ctx.createGain();      // 음악만 통과하는 게이트 (멈추면 정확히 0)
    master.gain.value = 0;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.18;

    /* 아주 부드러운 컴프레서 — 뜯는 소리의 순간 피크만 살짝 눌러 줍니다 */
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 18;
    comp.ratio.value = 2.0;
    comp.attack.value = 0.03;
    comp.release.value = 0.5;

    /* 탁한 저역을 걷어내고 맑게 (하프의 저음은 살립니다) */
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 45;
    hpf.Q.value = 0.5;

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 6800;
    lpf.Q.value = 0.3;

    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 4200;
    shelf.gain.value = -1.8;

    this.master = master;
    this.mix = ctx.createGain();
    this.mix.gain.value = 1;

    /* 타종은 배경 음악 위에서도 들려야 하므로 별도 버스
       (음악 게이트를 지나지 않습니다 → 유튜브 재생 중에도 사용자가 켠 타종만 울립니다) */
    this.fx = ctx.createGain();
    this.fx.gain.value = 1;            // 타종 통로 — 음악 게이트와 분리되어 늘 열려 있습니다
    this.fxGain = ctx.createGain();
    this.fxGain.gain.value = this.volume * 0.5;
    this.fx.connect(this.fxGain);

    const reverb = ctx.createConvolver();
    reverb.buffer = this._impulse(3.2, 2.8);
    const wet = ctx.createGain(); wet.gain.value = 0.34;
    const dry = ctx.createGain(); dry.gain.value = 0.8;

    this.mix.connect(dry).connect(hpf);
    this.mix.connect(reverb).connect(wet).connect(hpf);
    hpf.connect(shelf).connect(lpf).connect(comp).connect(limiter).connect(master);

    const out = ctx.createGain();
    out.gain.value = 1;
    master.connect(out);
    this.fxGain.connect(out);
    this.out = out;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    out.connect(analyser);
    this.analyser = analyser;

    /* 음악만 재는 탭 — 유튜브 재생 중 내장 사운드가 정확히 0인지 실측할 때 씁니다
       (AnalyserNode 는 출력이 연결돼 있어야 처리되므로 0 게인 통로를 붙입니다) */
    const musicTap = ctx.createAnalyser();
    musicTap.fftSize = 1024;
    master.connect(musicTap);
    const tapSink = ctx.createGain();
    tapSink.gain.value = 0;
    musicTap.connect(tapSink);
    tapSink.connect(out);
    this.musicTap = musicTap;

    this.direct = ctx.destination;
    analyser.connect(this.direct);

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
    return this._rms(this.analyser);
  };

  Engine.prototype.musicLevel = function () {
    return this._rms(this.musicTap);
  };

  Engine.prototype.musicPeak = function () {
    if (!this.musicTap) return 0;
    const buf = new Float32Array(this.musicTap.fftSize);
    this.musicTap.getFloatTimeDomainData(buf);
    let m = 0;
    for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
    return m;
  };

  Engine.prototype._rms = function (node) {
    if (!node) return 0;
    const buf = new Float32Array(node.fftSize);
    node.getFloatTimeDomainData(buf);
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
    const target = this.playing ? Math.pow(this.volume, 1.2) * 1.1 : 0;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(target, t, 0.18);
    this.fxGain.gain.cancelScheduledValues(t);
    this.fxGain.gain.setTargetAtTime(this.volume * 0.5, t, 0.15);
  };

  /* ── 완전 정지 — 유튜브로 넘어갈 때 두 덱을 즉시 끕니다 ── */
  Engine.prototype.hardStop = function () {
    this.playing = false;
    this.texture = null;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    try {
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(0, t);
    } catch (e) {}
    this.decks.forEach((d) => d.kill(t));
  };

  /* ── 크로스페이드 재생 (내장 사운드끼리) ───────────── */
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
    this.master.gain.setTargetAtTime(Math.pow(this.volume, 1.2) * 1.1, t, 0.25);
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
    this.beds = [];
    this.fading = [];
    this.timer = null;
    this.nextAt = 0;
    this.stepPos = 0;
    this.chordIndex = 0;
    this.bowlAt = 0;
    this.melodyStep = 0;
    this.melodyAt = 0;
    this._stale = false;
  }

  Deck.prototype._purge = function (t) {
    const at = (t == null ? this.eng.ctx.currentTime : t) + 0.02;
    const all = this.beds.concat(this.fading);
    all.forEach((n) => {
      try { if (n.src && n.src.stop) n.src.stop(at); } catch (e) {}
    });
    this.beds = [];
    this.fading = [];
  };

  /* 즉시 정지 — 게인 0, 예약 취소, 소리 노드 전부 종료 */
  Deck.prototype.kill = function (t) {
    const ctx = this.eng.ctx;
    const now = (t == null ? ctx.currentTime : t);
    this.playing = false;
    this.texture = null;
    this._stale = true;
    clearInterval(this.timer);
    this.timer = null;
    this._purge(now);
    try {
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(0, now);
    } catch (e) {}
  };

  Deck.prototype.start = function (texture, opts, fadeMs) {
    const eng = this.eng;
    const ctx = eng.ctx;
    const t = ctx.currentTime;
    const cfg = TEXTURES[texture] || TEXTURES.waiting;

    this._purge(t);
    this.texture = texture;
    this.playing = true;
    this._stale = false;
    this.nextAt = t + 0.08;
    this.stepPos = 0;
    this.chordIndex = 0;
    this.melodyStep = 0;
    this.melodyAt = t + 4;
    this.bowlAt = t + ((opts && opts.firstBowl) ? 1.2 : 7);

    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(0.0001, t);
    this.out.gain.exponentialRampToValueAtTime(1, t + Math.max(0.35, fadeMs / 1000));

    eng._buildBeds(this);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 200);
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

    const beds = this.beds;
    this.beds = [];
    this.fading = this.fading.concat(beds);
    const self = this;
    setTimeout(() => { self.fading = []; beds.forEach((b) => { try { if (b.src && b.src.stop) b.src.stop(); } catch (e) {} }); }, (secs + 0.6) * 1000);

    clearInterval(this.timer);
    this.timer = null;
  };

  Deck.prototype.tick = function (immediate) {
    if (!this.playing || !this.eng.ctx) return;
    const eng = this.eng;
    const ctx = eng.ctx;
    const cfg = TEXTURES[this.texture];
    if (!cfg) return;
    const now = ctx.currentTime;
    const horizon = now + (immediate ? 1.0 : 0.7);

    /* ── 아르페지오 ─────────────────────────── */
    if (cfg.voice && cfg.density > 0) {
      const step = cfg.step || 0.8;
      const perChord = Math.max(1, Math.round((cfg.chordDur || 15) / step));
      const pattern = cfg.pattern || [0, 2, 1, 3];
      if (this.nextAt < now - 1) this.nextAt = now + 0.2;
      let guard = 0;
      while (this.nextAt < horizon && guard++ < 40) {
        if (this.stepPos > 0 && this.stepPos % perChord === 0) {
          this.chordIndex++;
          if (cfg.bass) {
            const root = cfg.chords[this.chordIndex % cfg.chords.length][0] - 12;
            eng._pluck(this, 'bass', mtof(root), this.nextAt, cfg.bass, 4.2);
          }
        }
        const chord = cfg.chords[this.chordIndex % cfg.chords.length];
        const at = this.nextAt + (Math.random() - 0.5) * 0.05;
        if (Math.random() < cfg.density) {
          const tone = this._tone(chord, pattern[this.stepPos % pattern.length]);
          const vel = cfg.noteGain * (0.82 + Math.random() * 0.36);
          eng._pluck(this, cfg.voice, mtof(tone), at, vel, cfg.hold);
          if (cfg.double && Math.random() < cfg.double) {
            eng._pluck(this, cfg.voice, mtof(tone + 12), at + 0.1, vel * 0.32, cfg.hold * 0.7);
          }
        }
        this.stepPos++;
        this.nextAt += step * (0.94 + Math.random() * 0.12);
      }
    }

    /* ── 크리스마스 사바아사나 — 조용한 캐럴 멜로디 (Silent Night 첫 구절) ── */
    if (cfg.melody) {
      const melody = [64, 64, 67, 64, 60, 59, 64, 67, 72, 71, 67, 64, 60, 59, 64, 67, 71];
      const beat = 1.15;
      if (this.melodyAt < now - 2) this.melodyAt = now + 0.4;
      let g2 = 0;
      while (this.melodyAt < horizon && g2++ < 12) {
        const m = melody[this.melodyStep % melody.length];
        if (this.melodyStep % 2 === 0 || Math.random() < 0.5) {
          eng._pluck(this, 'glass', mtof(m), this.melodyAt, 0.05, 2.0);
        }
        this.melodyStep++;
        this.melodyAt += beat;
      }
    }

    /* ── 싱잉볼 타종 ─────────────────────────── */
    if (cfg.bowlEvery) {
      if (this.bowlAt < now - 4) this.bowlAt = now + 3;
      if (this.bowlAt < horizon) {
        eng.chime((cfg.bowlGain || 0.45) * (0.8 + Math.random() * 0.4), this.bowlAt);
        this.bowlAt += cfg.bowlEvery * (0.78 + Math.random() * 0.5);
      }
    }
  };

  Deck.prototype._tone = function (chord, idx) {
    const n = chord.length;
    const oct = Math.floor(idx / n);
    return chord[idx % n] + 12 * oct;
  };

  /* ── 보이스: 뜯는 소리(pluck) ─────────────────
     한 음이 짧게 맑게 울렸다가 잔향으로 사라집니다.
     지속되는 패드/드론은 없습니다. */
  Engine.prototype._pluck = function (deck, voice, freq, t, gain, hold) {
    const ctx = this.ctx;
    if (!deck.playing || deck._stale) return;

    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.2;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = (Math.random() - 0.5) * 0.55;
    g.connect(lp);
    if (pan) lp.connect(pan).connect(deck.out); else lp.connect(deck.out);

    let attack = 0.006;
    let decay = Math.min(hold || 2.4, 3.4);
    let partials;       // [배음 배수, 세기, 파형]
    if (voice === 'harp') {
      lp.frequency.value = 4600;
      partials = [[1, 0.62, 'triangle'], [2, 0.2, 'sine'], [3, 0.06, 'sine'], [4.01, 0.025, 'sine']];
      attack = 0.005;
    } else if (voice === 'piano') {
      lp.frequency.value = 2400;
      partials = [[1, 0.74, 'sine'], [2.001, 0.11, 'sine'], [3.004, 0.025, 'sine']];
      attack = 0.012;
      decay = Math.min(decay, 2.9);
    } else if (voice === 'glass') {
      lp.frequency.value = 6200;
      partials = [[1, 0.5, 'sine'], [3.01, 0.13, 'sine'], [5.02, 0.035, 'sine']];
      attack = 0.003;
      decay = Math.min(decay, 2.1);
    } else if (voice === 'bass') {
      lp.frequency.value = 720;
      partials = [[1, 0.85, 'sine'], [2, 0.07, 'sine']];
      attack = 0.022;
      decay = Math.min(hold || 4, 5);
    } else {
      lp.frequency.value = 3000;
      partials = [[1, 0.7, 'sine'], [2, 0.1, 'sine']];
    }

    const norm = 1 / partials.reduce((a, p) => a + p[1], 0);
    const stopAt = t + attack + decay + 0.3;
    partials.forEach(([mult, amp, type]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq * mult;
      o.detune.value = (Math.random() - 0.5) * 3;
      const og = ctx.createGain();
      og.gain.value = amp * norm;
      o.connect(og).connect(g);
      try { o.start(t); o.stop(stopAt); } catch (e) {}
    });

    const peak = Math.max(0.0002, gain) * 0.95;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };

  /* 싱잉볼 타종 — 맑은 사인 배음만 (노이즈 타격음 없음) */
  Engine.prototype.chime = function (gain, at) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = at == null ? ctx.currentTime + 0.05 : at;
    const base = 196 * (0.94 + Math.random() * 0.12);
    const out = ctx.createGain();
    out.gain.value = (gain == null ? 0.6 : gain) * 0.26;
    out.connect(this.fx);
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(out);

    const parts = [[1, 0.5, 9], [2.76, 0.18, 6.5], [5.4, 0.07, 4.5], [8.9, 0.02, 3]];
    parts.forEach(([m, a, dec]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(a, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + dec + 0.2);
    });
  };

  /* ── 바닥 울림 (바디스캔 명상 전용 — 아주 낮고 조용하게) ── */
  Engine.prototype._buildBeds = function (deck) {
    const cfg = TEXTURES[deck.texture];
    if (!cfg || !cfg.drone) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const bus = ctx.createGain();
    bus.gain.value = 0.12;
    bus.connect(deck.out);
    const base = mtof(cfg.chords[0][0] - 12);
    [[1, 0.3], [1.5, 0.06]].forEach(([mult, amp]) => {
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
    /* 아주 느린 숨결 — 들리지 않을 만큼만 */
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.06;
    const bg = ctx.createGain();
    bg.gain.value = 0.06;
    breath.connect(bg).connect(bus.gain);
    breath.start(t);
    deck.beds.push({ src: breath, gain: bg });
  };

  global.SomatoAudio = { Engine, mtof, TEXTURES, FADE_MS };
})(typeof window !== 'undefined' ? window : globalThis);
