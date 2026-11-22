/* ─────────────────────────────────────────────────────────────
   소마토센서리 요가 클래스 플레이어
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const DATA = window.SOMATO_DATA || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const mmss = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  };

  const LS_KEY = 'somato-music:v1';
  const FADE = 3500;   // 모든 전환은 약 3.5초 크로스페이드로 이어집니다
  const AMBIENT_SCALE = 0.68;   // 대기 음악은 설정 볼륨의 68%로 더 은은하게
  const VOLUME_CURVE = 2;       // 62% → 42% 로 낮춘 기본 볼륨 (한 번만 적용)
  const DEFAULT_PREFS = {
    theme: 'soma', savaMin: 10, pool: 'random', volume: 42,
    sourceMode: 'auto', chime: true, wake: true, dark: false, custom: {}, volCurve: VOLUME_CURVE,
    excluded: {}, pins: {},
  };

  const state = Object.assign({}, DEFAULT_PREFS);
  let plan = [];
  let mode = 'idle';
  let startedAt = 0, pausedTotal = 0, pausedAt = 0, activeIndex = -1;
  let tickTimer = null;
  let wakeLock = null;
  let audio = null;
  let keepAlive = null;          // iOS 백그라운드 유지용 <audio>
  let bodyscanOn = false;        // 바디스캔 명상 모드 (저장하지 않는 런타임 상태)

  /* ── 저장 ───────────────────────────────────── */
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch (e) {}
    if (!state.custom || typeof state.custom !== 'object') state.custom = {};
    if (!state.excluded || typeof state.excluded !== 'object') state.excluded = {};
    if (!state.pins || typeof state.pins !== 'object') state.pins = {};
    /* v6에서 플로우 테마를 은수 님 폴더 구조로 바꿨습니다 — 예전 이름이 남아 있으면 첫 테마로 */
    if (!FLOW_THEMES[state.theme]) state.theme = DEFAULT_PREFS.theme;
    state.savaMin = Number(state.savaMin) === 5 ? 5 : 10;
    /* 이미 62%로 저장해 두신 기기에서도 한 번만 더 낮춘 볼륨으로 맞춥니다 */
    if (state.volCurve !== VOLUME_CURVE) {
      const prev = Number(state.volume);
      state.volume = Number.isFinite(prev) ? Math.round(prev * 0.68) : DEFAULT_PREFS.volume;
      state.volCurve = VOLUME_CURVE;
      savePrefs();
    }
  }
  function savePrefs() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ── 테마 · 화면 ─────────────────────────────── */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.dark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.dark ? '#121110' : '#F3EFE7');
  }
  function showScreen(name) {
    $$('.screen').forEach((el) => el.classList.remove('is-active'));
    const el = $('#screen' + name[0].toUpperCase() + name.slice(1));
    if (el) el.classList.add('is-active');
    mode = name;
    $('#app').dataset.mode = name;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
  }

  /* ── 수업 구성 ───────────────────────────────── */
  const FLOW_THEMES = {
    soma: { name: '소마토 · 연주 & 핸드팬 플로우', short: '소마토 연주', texture: 'flow-classic',
      desc: '핸드팬 · 뉴에이지 · 피아노 연주' },
    mantra: { name: '만트라 · 리프레쉬 플로우', short: '만트라', texture: 'flow-mantra',
      desc: '만트라 · 키르탄 · 보컬 힐링' },
    pop: { name: '감성 팝 · 슬로우 플로우', short: '감성 팝', texture: 'flow-neo',
      desc: '팝 · 어쿠스틱 · 슬로우' },
    christmas: { name: '크리스마스 · 연말 캐롤 모드', short: '캐롤', texture: 'flow-xmas',
      desc: '잔잔한 피아노 · 어쿠스틱 캐롤' }
  };

  const SAVA_POOLS = {
    random: { name: '오늘의 랜덤 추천 · 감성곡 + 힐링곡', short: '랜덤', texture: 'sava-bowl' },
    song: { name: '감성곡 · 가사 있는 사바아사나', short: '감성곡', texture: 'sava-song' },
    piano: { name: '가사 없는 힐링 건반', short: '건반', texture: 'sava-piano' },
    bowl: { name: '싱잉볼 · 명상', short: '싱잉볼', texture: 'sava-bowl' },
    vocal: { name: '만트라 · 보컬 힐링', short: '만트라', texture: 'sava-vocal' },
    bodyscan: { name: '바디스캔 · 잔잔한 앰비언트', short: '바디스캔', texture: 'bodyscan' },
    harp: { name: '하프 · 오르골', short: '하프', texture: 'sava-harp' },
    christmas: { name: '크리스마스 잔잔한 캐롤', short: '캐롤', texture: 'sava-xmas' }
  };

  function buildPlan() {
    const sava = state.savaMin === 5 ? 5 : 10;
    return [
      { id: 'opening', name: '오프닝', en: 'OPENING', min: 15,
        desc: '호흡을 바닥으로 내려놓는 15분', texture: 'opening' },
      { id: 'breath', name: '호흡', en: 'BREATH', min: 3,
        desc: '들이쉬고 내쉬는 3분, 긴 호흡의 음악', texture: 'breath' },
      { id: 'flow', name: '메인 플로우', en: 'MAIN FLOW', min: 30,
        desc: FLOW_THEMES[state.theme].desc, texture: FLOW_THEMES[state.theme].texture },
      { id: 'cooldown', name: '컴다운', en: 'COOLDOWN', min: 30,
        desc: '심박을 천천히 가라앉히는 30분', texture: 'cooldown' },
      { id: 'savasana', name: '사바아사나', en: 'SAVASANA', min: sava,
        desc: '몸이 스스로 회복하는 시간', texture: 'sava-bowl' }
    ];
  }

  function planTotalMs() {
    return plan.reduce((a, s) => a + s.min * 60000, 0);
  }
  function boundaries() {
    const out = []; let acc = 0;
    plan.forEach((s) => { out.push(acc); acc += s.min * 60000; });
    out.push(acc);
    return out;
  }
  function currentIndex(now) {
    const t = elapsedMs(now);
    const b = boundaries();
    for (let i = 0; i < plan.length; i++) if (t < b[i + 1]) return i;
    return plan.length - 1;
  }
  function elapsedMs(now) {
    if (mode !== 'class') return 0;
    const t = now || Date.now();
    return clamp(t - startedAt - pausedTotal - (pausedAt ? t - pausedAt : 0), 0, planTotalMs());
  }

  /* ── 트랙 ───────────────────────────────────── */
  function baseTracks(key) {
    const T = DATA.tracks || {};
    if (!T) return [];
    const path = key.split(':');
    let node = T;
    for (const p of path) { node = node && node[p]; }
    return Array.isArray(node) ? node.slice() : [];
  }
  function customTracks(key) {
    const arr = (state.custom && state.custom[key]) || [];
    return arr.map((c) => ({ t: c.t || '추가한 곡', a: '직접 추가', y: c.y, custom: true }));
  }
  /* ── 선곡 관리 ────────────────────────────────
     state.pins[key]     = 맨 앞에 세울 곡 ID 순서
     state.excluded[key] = 수업에서 뺀 곡 ID (localStorage 저장)
     순서: 직접 추가한 곡 → 고정한 곡 → 기본 큐레이션 순 */
  function rawTracks(key) {
    return customTracks(key).concat(baseTracks(key));
  }
  function pinsOf(key) {
    const arr = (state.pins && state.pins[key]) || [];
    return Array.isArray(arr) ? arr : [];
  }
  function excludedOf(key) {
    const arr = (state.excluded && state.excluded[key]) || [];
    return Array.isArray(arr) ? arr : [];
  }
  function isExcluded(key, y) {
    return excludedOf(key).indexOf(y) !== -1;
  }
  function orderedTracks(key) {
    const all = rawTracks(key);
    const seen = new Set();
    const out = [];
    const push = (t) => {
      if (!t || !t.y || seen.has(t.y)) return;
      seen.add(t.y);
      out.push(t);
    };
    pinsOf(key).forEach((id) => push(all.filter((t) => t.y === id)[0]));
    all.forEach(push);
    const kept = out.filter((t) => !isExcluded(key, t.y));
    const list = kept.length ? kept : out;   // 한 파트의 모든 곡을 뺀 때만 안전 fallback
    const pinSet = new Set(pinsOf(key));
    let pinN = 0;
    while (pinN < list.length && pinSet.has(list[pinN].y)) pinN++;
    return { list: list, pinN: pinN, all: out };
  }
  /* 재생 목록 — 앞에 고정한 곡은 순서를 지키고 그 뒤만 섞습니다.
     고정한 곡이 없으면 원래 큐레이션의 첫 곡을 지킵니다. */
  function queuedList(key) {
    const o = orderedTracks(key);
    const headN = o.pinN > 0 ? o.pinN : Math.min(1, o.list.length);
    return o.list.slice(0, headN).concat(shuffle(o.list.slice(headN)));
  }

  function pinCount(key) {
    return orderedTracks(key).pinN;
  }
  function keyForSection(sec, index) {
    if (sec.id === 'flow') return 'flow:' + state.theme;
    if (sec.id === 'savasana') return 'savasana:' + (state.pool === 'random' ? 'mix' : state.pool);
    return sec.id;
  }
  function todayPool() {
    // 오늘의 랜덤 추천 — 내장 사운드 결은 날짜에 따라 정갈하게 고릅니다
    const pools = ['sava-song', 'sava-piano', 'sava-bowl', 'sava-vocal', 'sava-harp'];
    const d = new Date();
    const seed = d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
    return pools[seed % pools.length];
  }
  /* 오늘의 랜덤 추천 — 감성곡과 가사 없는 힐링곡이 번갈아 섞인 대기열 */
  function savaMixList() {
    const song = queuedList('savasana:song');   // 고정한 곡 · 첫 곡은 큐레이션 순서를 지킵니다
    const calm = shuffle(queuedList('savasana:piano')
      .concat(queuedList('savasana:bowl'), queuedList('savasana:vocal')));
    const rest = song.slice(1);
    const out = [];
    if (song[0]) out.push(song[0]);
    const n = Math.max(rest.length, calm.length);
    for (let i = 0; i < n; i++) {
      if (rest[i]) out.push(rest[i]);
      if (calm[i]) out.push(calm[i]);
    }
    return out;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ── 재생 엔진 ──────────────────────────────── */
  /* 소리의 주인은 언제나 하나입니다.
       owner === 'youtube'  → 내장 사운드 두 덱은 즉시 완전 정지(gain 0 + stop)
       owner === 'builtin'  → 유튜브는 mute() + stopVideo()
     볼륨을 올리는 모든 길은 owner === 'youtube' 일 때만 열립니다.
     그래서 늦게 도착한 타이머·콜백이 소리를 겹치게 만들 수 없습니다. */
  let owner = 'none';            // 'none' | 'youtube' | 'builtin'

  const yt = {
    apiReady: false, player: null, ready: false, loading: false,
    queue: [], qi: 0, errors: 0, currentKey: '', expected: '',
    volume: 0,                    // 유튜브 플레이어가 지금 내는 볼륨(0~100)
    fadeTimer: null, adTimer: null, watchdog: null,
    transitionTimer: null, stopTimer: null, playTimer: null,
    stallRetried: false, started: false
  };

  function ensureAudio() {
    if (!audio) audio = new window.SomatoAudio.Engine();
    audio.init();
    audio.resume();
    audio.setVolume(outVolume() / 100);
    return audio;
  }

  /* 대기 음악은 설정 볼륨보다 한 단계 더 낮춰, 수업 전 공간에 은은하게 깔립니다 */
  function outVolume() {
    return clamp(state.volume * (mode === 'class' ? 1 : AMBIENT_SCALE), 0, 100);
  }
  function applyVolume(fadeMs) {
    const v = outVolume();
    if (owner === 'youtube') ytFadeTo(v, fadeMs || 900);
    if (audio) audio.setVolume(v / 100);
  }

  function ensureYT() {
    if (yt.player || yt.loading) return;
    yt.loading = true;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => { yt.loading = false; };
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = createYT;
    setTimeout(() => { if (!yt.player) yt.loading = false; }, 9000);
  }

  function createYT() {
    if (yt.player) return;
    const host = $('#ytHost');
    const div = document.createElement('div');
    div.id = 'ytPlayer';
    host.appendChild(div);
    try {
      yt.player = new YT.Player('ytPlayer', {
        width: 200, height: 120,
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0,
          modestbranding: 1, playsinline: 1, origin: location.origin
        },
        events: {
          onReady: () => {
            yt.ready = true; yt.loading = false;
            try { yt.player.setVolume(0); yt.player.mute(); } catch (e) {}
            yt.volume = 0;
            setTimeout(ensurePreviewYT, 900);   // 미리듣기 플레이어도 앱을 열 때 함께 준비
            warmFirstTrack();                    // 첫 대기곱 메타데이터를 미리 불러 둡니다
            if (mode === 'class' && owner === 'builtin' && state.sourceMode !== 'builtin') {
              playSection(activeIndex, { soft: true });
            } else if (mode === 'idle' && state.ambientOn && owner === 'builtin') {
              playAmbient(true);
            }
          },
          onStateChange: (e) => {
            if (e.data === 1) yt.errors = 0;
            if (e.data === 0 && owner === 'youtube') nextTrack(true, { crossfade: false });
          },
          onError: (e) => {
            if (owner !== 'youtube') return;      // 내장 사운드가 주인일 때는 무시
            const code = e.data;
            if (code === 2 || code === 5 || code === 100 || code === 101 || code === 150) {
              yt.errors++;
              const cur = yt.queue[yt.qi];
              if (cur) cur.failed = true;
              if (yt.errors >= 2) fallbackToBuiltin('유튜브 재생이 제한되어 내장 사운드로 이어갑니다.');
              else nextTrack(true, { crossfade: false });
            } else {
              fallbackToBuiltin('재생이 지연되어 내장 사운드로 이어갑니다.');
            }
          }
        }
      });
    } catch (e) { yt.loading = false; }
  }

  function clearYTTimers() {
    clearInterval(yt.fadeTimer); yt.fadeTimer = null;
    clearInterval(yt.adTimer); yt.adTimer = null;
    clearTimeout(yt.watchdog); yt.watchdog = null;
    clearTimeout(yt.transitionTimer); yt.transitionTimer = null;
    clearTimeout(yt.stopTimer); yt.stopTimer = null;
    clearTimeout(yt.playTimer); yt.playTimer = null;
  }

  /* 유튜브 볼륨 램프 — 0으로 내리는 것만 언제나 허용하고,
     올리는 것은 유튜브가 소리의 주인일 때만 허용합니다. */
  function ytFadeTo(target, ms) {
    if (!yt.player || !yt.player.setVolume) return;
    if (target > 0 && owner !== 'youtube') target = 0;
    if (target > 0) { try { yt.player.unMute(); } catch (e) {} }
    clearInterval(yt.fadeTimer);
    const from = yt.volume;
    const steps = Math.max(1, Math.round((ms || FADE) / 60));
    let i = 0;
    yt.fadeTimer = setInterval(() => {
      i++;
      const s = i / steps;
      const e = s * s * (3 - 2 * s);       // S-커브
      const v = from + (target - from) * e;
      yt.volume = v;
      try { yt.player.setVolume(clamp(v, 0, 100)); } catch (e2) {}
      if (i >= steps) { clearInterval(yt.fadeTimer); yt.fadeTimer = null; }
    }, 60);
  }

  /* 유튜브를 완전히 무음으로: 볼륨 0 + 음소거 + 정지 */
  function silenceYT() {
    yt.volume = 0;
    if (!yt.player) return;
    try { yt.player.setVolume(0); } catch (e) {}
    try { yt.player.mute(); } catch (e) {}
    try { yt.player.stopVideo(); } catch (e) {}
  }

  /* 내장 사운드 두 덱 즉시 완전 정지 */
  function stopBuiltinHard() {
    if (audio) audio.hardStop();
  }

  /* ── 소리의 주인 바꾸기 ─────────────────────── */
  function takeYT() {
    if (owner === 'youtube') return;
    stopBuiltinHard();          // 유튜브가 소리를 낼 때 내장 사운드는 0
    owner = 'youtube';
  }

  function takeBuiltin() {
    clearYTTimers();
    silenceYT();                // 내장이 소리를 낼 때 유튜브는 mute + stop
    if (owner === 'builtin') return;   // 내장끼리는 3.5초 크로스페이드로 이어집니다
    stopBuiltinHard();
    owner = 'builtin';
  }

  function setBadge(kind) {
    const b = $('#sourceBadge');
    if (!b) return;
    const builtin = kind === 'builtin' || kind === 'builtin-bodyscan';
    b.textContent =
      kind === 'ad' ? '광고 · 잠시 무음' :
      kind === 'builtin-bodyscan' ? '내장 사운드 · 바디스캔' :
      builtin ? '내장 사운드' : 'YouTube';
    b.classList.toggle('is-builtin', builtin);
  }

  /* ── 유튜브 감시 ──────────────────────────────
     광고 여부는 IFrame API가 알려주지 않습니다. 재생 길이(광고 ≤ 100초,
     수록곡 ≥ 3분)와 재생 중인 영상 ID로 판별합니다.
     광고 구간에는 어떤 소리도 내지 않습니다 — 내장 사운드도 켜지 않습니다.
     (v23의 '광고 후 20초 → 내장 사운드' 규칙은 여기서 없앴습니다) */
  function watchPlayback() {
    clearInterval(yt.adTimer);
    let waited = 0;
    yt.adTimer = setInterval(() => {
      if (owner !== 'youtube' || !yt.player) { clearInterval(yt.adTimer); yt.adTimer = null; return; }
      waited += 150;
      let dur = 0, st = -1, vid = '', ct = 0;
      try {
        dur = yt.player.getDuration() || 0;
        st = yt.player.getPlayerState();
        ct = yt.player.getCurrentTime() || 0;
        const vd = yt.player.getVideoData ? (yt.player.getVideoData() || {}) : {};
        vid = vd.video_id || '';
      } catch (e) { return; }

      const isAd = (dur > 0 && dur < 100) || (!!vid && !!yt.expected && vid !== yt.expected);
      if (isAd) {
        try { yt.player.setVolume(0); yt.player.mute(); } catch (e) {}
        yt.volume = 0;
        setBadge('ad');
        return;
      }
      /* 재생 중인지 — 브라우저에 따라 상태값이 -1 로 남는 경우가 있어 재생 시간으로도 봅니다.
         소리는 본 영상이 흐르기 시작한 순간에 0.6초(첫 시작) / 0.9초(전환) 만에 올라옵니다. */
      if (st === 1 || ct > 0.2 || (dur >= 100 && st === 3)) {
        setBadge('youtube');
        try { yt.player.unMute(); } catch (e) {}
        ytFadeTo(outVolume(), yt.started ? 900 : 600);
        yt.started = true;
        clearInterval(yt.adTimer); yt.adTimer = null;
        clearTimeout(yt.watchdog); yt.watchdog = null;
      } else if (waited > 120000) {
        /* 2분이 지나도 길이를 알려주지 않는 경우 — 더 기다리면 무음이 길어집니다 */
        setBadge('youtube');
        try { yt.player.unMute(); } catch (e) {}
        ytFadeTo(outVolume(), 800);
        clearInterval(yt.adTimer); yt.adTimer = null;
      }
    }, 150);
  }

  /* 재생이 실제로 시작되지 않았을 때만 다시 시도하고, 두 번째에도 안 되면
     유튜브를 완전히 멈춘 뒤 내장 사운드로 넘어갑니다. */
  function armWatchdog(ms) {
    clearTimeout(yt.watchdog);
    yt.watchdog = setTimeout(() => {
      yt.watchdog = null;
      if (owner !== 'youtube' || !yt.player) return;
      let st = -1, ct = 0;
      try { st = yt.player.getPlayerState(); ct = yt.player.getCurrentTime() || 0; } catch (e) { return; }
      if (st === 1 || ct > 1) return;           // 실제로 재생 중 — 광고 포함
      if (st === 3 && (yt.bufferWaits || 0) < 3) {
        yt.bufferWaits = (yt.bufferWaits || 0) + 1;   // 버퍼링 — 조금 더 지켜봅니다
        armWatchdog(12000);
        return;
      }
      if (!yt.stallRetried) {
        yt.stallRetried = true;
        try { yt.player.playVideo(); } catch (e) {}
        armWatchdog(10000);
        return;
      }
      fallbackToBuiltin('유튜브 재생이 지연되어 내장 사운드로 이어갑니다.');
    }, ms || 14000);
  }

  function ytPlayTrack(track, opts) {
    opts = opts || {};
    if (!track || !track.y || !yt.player || !yt.ready) return false;

    takeYT();                 // 내장 사운드 두 덱 즉시 완전 정지
    clearYTTimers();          // 이전 감시 · 예약 전환 · 정지 예약을 모두 취소
    yt.expected = track.y;
    yt.stallRetried = false;
    yt.bufferWaits = 0;
    renderNow(track);
    setBadge('youtube');
    $('#nowCard').classList.add('is-playing');

    const doLoad = () => {
      if (owner !== 'youtube' || !yt.player) return;
      try { yt.player.mute(); yt.player.setVolume(0); } catch (e) {}
      yt.volume = 0;
      let same = false;
      try {
        const vd = yt.player.getVideoData ? (yt.player.getVideoData() || {}) : {};
        same = !!vd.video_id && vd.video_id === track.y;
      } catch (e) { same = false; }
      try {
        if (same) {
          /* 이미 열려 있는 곡이면 다시 불러오지 않고 바로 재생 — 광고 재요청과 로딩 지연이 없습니다 */
          try { if ((yt.player.getCurrentTime() || 0) > 0.4) yt.player.seekTo(0, true); } catch (e) {}
        } else {
          yt.player.loadVideoById({ videoId: track.y, startSeconds: 0 });
        }
        yt.player.playVideo();       // 대기 없이 같은 제스처 안에서 바로
      } catch (e) {
        fallbackToBuiltin('유튜브를 불러오지 못해 내장 사운드로 이어갑니다.');
        return;
      }
      armWatchdog(14000);
      watchPlayback();
    };

    /* 지금 소리가 나고 있으면 먼저 3.5초에 걸쳐 줄인 뒤 새 곡이 0에서 올라옵니다 */
    if (opts.crossfade !== false && yt.volume > 2) {
      ytFadeTo(0, opts.fadeOut || FADE);
      yt.transitionTimer = setTimeout(doLoad, (opts.fadeOut || FADE) + 150);
    } else {
      doLoad();
    }
    return true;
  }

  /* 사바아사나는 고른 풀의 결로 내장 사운드를 맞춥니다. */
  function sectionTexture(sec) {
    if (!sec) return 'waiting';
    if (sec.id === 'savasana') {
      const p = state.pool === 'random' ? todayPool() : state.pool;
      return (SAVA_POOLS[p] && SAVA_POOLS[p].texture) || 'sava-bowl';
    }
    return sec.texture || 'waiting';
  }

  /* 지금 유튜브에서 소리가 나고 있는지 — 크로스페이드가 필요한지 판단할 때 씁니다 */
  function ytAudible() {
    return owner === 'youtube' && yt.volume > 2 && !!yt.player;
  }

  function startBuiltin(texture, label, fadeMs) {
    takeBuiltin();                 // 유튜브는 mute + stopVideo, 내장 덱은 정리
    const eng = ensureAudio();
    ensureKeepAlive();
    eng.start(texture, { firstBowl: false, fadeMs: fadeMs || FADE });
    setBadge(texture === 'bodyscan' ? 'builtin-bodyscan' : 'builtin');
    $('#nowCard').classList.add('is-playing');
    renderBuiltin(label || builtinLabel(texture));
  }

  function builtinLabel(texture) {
    const map = {
      waiting: ['대기 음악', '맑은 하프 아르페지오'],
      opening: ['그라운딩 피아노', '느린 펠트 건반'],
      breath: ['호흡 피아노', '느린 아르페지오'],
      bridge: ['펠트 피아노', '느린 아르페지오'],
      'flow-classic': ['뉴에이지 하프', '잔잔한 아르페지오'],
      'flow-neo': ['네오클래식 피아노', '맑은 건반'],
      'flow-mantra': ['낮은 하프', '느린 만트라 결'],
      'flow-xmas': ['오르골 캐럴', '잔잔한 연말 결'],
      cooldown: ['이완 하프', '느린 아르페지오'],
      closing: ['마무리 오르골', '드문드문 울리는 음'],
      bodyscan: ['바디스캔 명상', '아주 낮은 울림 · 숨결'],
      'sava-song': ['감성 사바아사나 하프', '잔잔한 결의 내장 사운드'],
      'sava-piano': ['사바아사나 피아노', '느리고 낮은 건반'],
      'sava-bowl': ['싱잉볼 사운드스케이프', '주기적인 타종'],
      'sava-vocal': ['낮은 하프 힐링', '느린 아르페지오'],
      'sava-nature-rain': ['조용한 하프', '낮은 결'],
      'sava-nature-night': ['오르골 밤', '성긴 음'],
      'sava-harp': ['하프 자장가', '느린 아르페지오'],
      'sava-box': ['오르골 자장가', '맑은 벨'],
      'sava-xmas': ['오르골 캐럴', '고요한 밤']
    };
    const v = map[texture] || ['내장 사운드', '실시간 합성'];
    return { t: v[0], a: v[1] };
  }

  function renderBuiltin(label) {
    $('#nowTitle').textContent = label.t;
    $('#nowArtist').textContent = label.a;
    $('#nextTitle').textContent = '실시간으로 생성되는 사운드';
    updateMediaSession({ t: label.t, a: label.a }, true);
  }

  function renderNow(track) {
    if (!track) return;
    $('#nowTitle').textContent = track.t || '—';
    $('#nowArtist').textContent = track.a || '—';
    updateMediaSession(track, false);
  }

  /* ── MediaSession — 잠금 화면 · 이어폰 버튼으로 조작 ── */
  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const act = (name, fn) => { try { ms.setActionHandler(name, fn); } catch (e) {} };
    act('play', () => {
      if (mode === 'class' && $('#app').classList.contains('is-paused')) togglePause();
      else if (mode !== 'class' && !state.ambientOn) playAmbient();
      if (keepAlive && keepAlive.paused) keepAlive.play().catch(() => {});
    });
    act('pause', () => {
      if (mode === 'class' && !$('#app').classList.contains('is-paused')) togglePause();
      else if (mode !== 'class' && state.ambientOn) stopAmbient();
    });
    act('previoustrack', () => { if (mode === 'class') prevTrack(); });
    act('nexttrack', () => { if (mode === 'class') nextTrack(); });
  }
  function updateMediaSession(track, builtin) {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: (track && track.t) || '소마토센서리 요가',
        artist: (track && track.a) || '',
        album: builtin ? '내장 힐링 사운드' : '소마토센서리 요가 클래스',
        artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.playbackState = 'playing';
    } catch (e) {}
  }

  /* ── iOS 백그라운드 유지 — Web Audio 를 <audio> 로 내보냅니다 ──
     iOS 사파리는 화면이 꺼지면 Web Audio 가 멈추지만, MediaStreamDestination 으로
     이어준 <audio> 엘리먼트가 재생 중이면 오디오 세션이 유지됩니다. */
  function ensureKeepAlive() {
    const eng = ensureAudio();
    if (!eng.streamDest) return;
    if (keepAlive) {
      if (keepAlive.paused) keepAlive.play().catch(() => {});
      return;
    }
    try {
      keepAlive = new Audio();
      keepAlive.srcObject = eng.streamDest.stream;
      keepAlive.volume = 1;
      keepAlive.setAttribute('playsinline', '');
      keepAlive.setAttribute('webkit-playsinline', '');
      keepAlive.autoplay = true;
      keepAlive.setAttribute('aria-hidden', 'true');
      keepAlive.style.display = 'none';
      document.body.appendChild(keepAlive);   // iOS 오디오 세션을 위해 문서에 붙여 둡니다
      keepAlive.addEventListener('playing', () => {
        try { eng.useElement(true); } catch (e) {}   // 엘리먼트가 소리를 내기 시작하면 직접 출력은 겹치지 않게 끕니다
      }, { once: true });
      keepAlive.addEventListener('error', () => {
        try { eng.useElement(false); } catch (e) {}
      });
      keepAlive.play().catch(() => {});
    } catch (e) { keepAlive = null; }
  }

  function renderNext() {
    const cur = yt.queue[yt.qi + 1] || yt.queue[0];
    $('#nextTitle').textContent = cur ? (cur.t || '—') : '—';
  }

  /* 유튜브가 안 되면 유튜브를 완전히 멈추고 내장 사운드만 남깁니다 */
  function fallbackToBuiltin(msg) {
    const sec = plan[activeIndex] || {};
    clearYTTimers();
    startBuiltin(sectionTexture(sec));
    if (msg) toast(msg);
    $('#footStatus').textContent = '내장 사운드 재생 중';
  }

  function nextTrack(auto, opts) {
    if (yt.queue.length === 0) return;
    let guard = 0;
    do {
      yt.qi = (yt.qi + 1) % yt.queue.length;
      guard++;
    } while (yt.queue[yt.qi].failed && guard < yt.queue.length);

    const cur = yt.queue[yt.qi];
    if (!cur || cur.failed) { fallbackToBuiltin(); return; }
    if (state.sourceMode === 'builtin' || !yt.ready) {
      const sec = plan[activeIndex] || {};
      startBuiltin(sectionTexture(sec));
      return;
    }
    ytPlayTrack(cur, opts || (auto ? { crossfade: false } : {}));
    renderNext();
  }
  function prevTrack() {
    if (yt.queue.length === 0) return;
    yt.qi = (yt.qi - 1 + yt.queue.length) % yt.queue.length;
    const cur = yt.queue[yt.qi];
    if (state.sourceMode === 'builtin' || !yt.ready) {
      const sec = plan[activeIndex] || {};
      startBuiltin(sectionTexture(sec));
      return;
    }
    ytPlayTrack(cur, { crossfade: true });
  }

  /* `다른 곡` — 수업 중 지금 구간의 다음 곡으로, 3.5초 페이드로 넘깁니다 */
  function skipTrack() {
    if (mode !== 'class') { toast('수업 중에 곡을 바꿀 수 있어요.'); return; }
    if (bodyscanOn) {
      startBuiltin('bodyscan', { t: '바디스캔 명상', a: '아주 낮은 울림 · 숨결' });
      toast('바디스캔 사운드를 새로 시작합니다.');
      return;
    }
    if (state.sourceMode === 'builtin' || !yt.ready || owner === 'builtin') {
      const sec = plan[activeIndex] || {};
      startBuiltin(sectionTexture(sec));
      toast('새 연주로 바뀝니다.');
      return;
    }
    if (yt.queue.length < 2) {
      const sec = plan[activeIndex] || {};
      startBuiltin(sectionTexture(sec));
      toast('이 구간의 새 연주로 바뀝니다.');
      return;
    }
    nextTrack(false, { crossfade: true });
    const cur = yt.queue[yt.qi];
    if (cur) toast('다음 곡 · ' + (cur.t || ''));
  }

  function playPool(key, opts) {
    yt.currentKey = key;
    const list = key === 'savasana:mix' ? savaMixList() : queuedList(key);
    yt.queue = list;
    yt.qi = 0;
    yt.errors = 0;

    if (yt.queue.length === 0) {
      const sec = plan[activeIndex] || {};
      startBuiltin(sectionTexture(sec));
      return;
    }
    if (state.sourceMode === 'builtin') {
      const sec = plan[activeIndex] || {};
      startBuiltin(sectionTexture(sec));
      renderNext();
      return;
    }
    if (!yt.ready) {
      const sec = plan[activeIndex] || {};
      startBuiltin(sectionTexture(sec));
      ensureYT();
      renderNext();
      return;
    }
    ytPlayTrack(yt.queue[0]);
    renderNext();
  }

  /* 대기 음악 — 고정한 곡(첫 곡)이 있으면 그 순서를 지키고 그 뒤만 섞습니다 */
  function waitList() {
    return queuedList('wait');
  }

  /* 앱을 열어 둔 사이 첫 대기곱의 메타데이터를 미리 불러 둡니다 (재생은 하지 않음).
     '대기 음악'을 눌렀을 때 영상을 새로 불러오는 시간 없이 바로 시작되도록. */
  function warmFirstTrack() {
    if (!yt.player || !yt.ready) return;
    if (owner === 'youtube' || mode !== 'idle' || state.ambientOn) return;
    const t = waitList()[0];
    if (!t || !t.y) return;
    try {
      const vd = yt.player.getVideoData ? (yt.player.getVideoData() || {}) : {};
      if (vd.video_id === t.y) return;
      yt.player.cueVideoById({ videoId: t.y });
    } catch (e) {}
  }

  function playAmbient(resume) {
    state.ambientOn = true;
    $('#ambientBtn').setAttribute('aria-pressed', 'true');
    $('#ambientBtnLabel').textContent = '대기 음악 끄기';
    $('#footStatus').textContent = '대기 음악 재생 중';
    if (state.sourceMode === 'builtin' || !yt.ready) {
      if (owner === 'builtin' && audio && audio.playing && resume) return;
      startBuiltin('waiting', { t: '대기 음악', a: '맑은 하프 아르페지오' });
      ensureYT();
      return;
    }
    const list = waitList();
    if (!list.length) { startBuiltin('waiting'); return; }
    yt.queue = list; yt.qi = 0; yt.currentKey = 'wait';
    ytPlayTrack(list[0]);
    renderNext();
  }

  /* 모든 소리를 부드럽게 줄여 끕니다 (수업 종료 · 대기 음악 끄기) */
  function fadeOutAll(ms) {
    const d = ms || 1800;
    clearYTTimers();
    if (yt.player) {
      ytFadeTo(0, d);
      yt.stopTimer = setTimeout(() => { try { if (yt.player) yt.player.stopVideo(); } catch (e) {} }, d + 200);
    }
    if (audio && audio.playing) audio.stop(d / 1000);
    owner = 'none';
  }

  /* 대기 음악을 갑자기 끊지 않고, 수업 첫 구간이 페이드 인하는 동안 겹치며 줄입니다 */
  function endAmbientSoft() {
    state.ambientOn = false;
    $('#ambientBtn').setAttribute('aria-pressed', 'false');
    $('#ambientBtnLabel').textContent = '대기 음악 켜기';
    clearYTTimers();
    if (yt.player) {
      ytFadeTo(0, FADE);
      yt.stopTimer = setTimeout(() => { try { if (yt.player) yt.player.pauseVideo(); } catch (e) {} }, FADE + 200);
    }
    if (audio && audio.playing) audio.stop(FADE / 1000);
    yt.queue = [];
    owner = 'none';
  }

  function stopAmbient(fadeMs) {
    state.ambientOn = false;
    $('#ambientBtn').setAttribute('aria-pressed', 'false');
    $('#ambientBtnLabel').textContent = '대기 음악 켜기';
    $('#footStatus').textContent = '대기 중';
    fadeOutAll(fadeMs || FADE);
    yt.queue = [];
    $('#nowCard') && $('#nowCard').classList.remove('is-playing');
  }

  /* ── 수업 진행 ──────────────────────────────── */
  function renderIdlePlan() {
    const list = $('#idlePlan');
    const p = buildPlan();
    list.innerHTML = p.map((s, i) =>
      `<li style="animation-delay:${i * 55}ms">
        <span class="p-name">${s.name}<span class="p-sub">${s.desc}</span></span>
        <span class="p-dots"></span>
        <span class="p-time">${s.min}분</span>
      </li>`).join('');
  }

  function updateSourcePill() {
    const builtin = state.sourceMode === 'builtin';
    $('#sourcePill').setAttribute('aria-pressed', String(!builtin));
    $('#sourcePillLabel').textContent = builtin ? '내장 사운드' : '유튜브';
  }

  function renderIdleChoices() {
    $('#idleThemeValue').textContent = FLOW_THEMES[state.theme].name;
    $('#idleLenValue').textContent = (state.savaMin === 5 ? 5 : 10) + '분';
    $('#idleSavaValue').textContent = state.pool === 'random'
      ? '오늘의 랜덤 추천 · 감성곡 + 힐링곡' : SAVA_POOLS[state.pool].name;
    $('#themePillLabel').textContent = FLOW_THEMES[state.theme].short;
    renderSavaLenPickers();
  }

  /* 사바아사나 5분 / 10분 — 설정 시트와 수업 중 패널에서 함께 바뀝니다 */
  function renderSavaLenPickers() {
    const min = state.savaMin === 5 ? 5 : 10;
    $$('#savaLenSetting button, #savaLenPicker button').forEach((b) => {
      b.classList.toggle('is-on', Number(b.dataset.min) === min);
    });
  }

  function setSavaMin(min) {
    min = Number(min) === 5 ? 5 : 10;
    if (state.savaMin === min && mode !== 'class') { renderSavaLenPickers(); return; }
    state.savaMin = min;
    savePrefs();
    plan = buildPlan();
    renderIdlePlan();
    renderIdleChoices();
    renderSegments();
    updateSegments(activeIndex);
    if (mode === 'class') {
      const sec = plan[activeIndex];
      if (sec && sec.id === 'savasana') {
        $('#sectionDesc').textContent = savaDesc();
        $('#savaPanel').hidden = false;
      }
      tick();
    }
    toast('사바아사나 ' + min + '분으로 맞췄습니다.');
  }

  function savaDesc() {
    return state.pool === 'random'
      ? '감성곡 + 가사 없는 힐링곡이 번갈아 흐릅니다'
      : SAVA_POOLS[state.pool].name;
  }

  function renderSegments() {
    const wrap = $('#segments');
    wrap.innerHTML = plan.map((s) => `<i style="flex-grow:${s.min}"></i>`).join('');
    renderJump();
  }

  /* 상단 구간 타임라인 — 60분 수업에서는 여기를 눌러 필요한 구간으로 바로 넘어갑니다 */
  function renderJump() {
    const row = $('#jumpRow');
    if (!row) return;
    row.innerHTML = plan.map((s, i) =>
      `<button type="button" class="jump-chip" data-i="${i}">${s.name}<span>${s.min}</span></button>`
    ).join('');
  }

  function updateSegments(idx) {
    $$('#segments i').forEach((el, i) => {
      el.classList.toggle('done', i < idx);
      el.classList.toggle('active', i === idx);
    });
    $$('#jumpRow .jump-chip').forEach((el, i) => {
      el.classList.toggle('is-on', i === idx);
      el.classList.toggle('is-done', i < idx);
    });
  }

  function enterSection(idx, opts) {
    opts = opts || {};
    if (idx < 0 || idx >= plan.length) return;
    const sec = plan[idx];
    activeIndex = idx;

    $('#sectionEn').textContent = sec.en;
    $('#sectionKo').textContent = sec.name;
    let desc = sec.desc;
    if (sec.id === 'flow') desc = FLOW_THEMES[state.theme].desc;
    if (sec.id === 'savasana') {
      desc = savaDesc();
    }
    $('#sectionDesc').textContent = desc;
    updateSegments(idx);
    $('#savaPanel').hidden = sec.id !== 'savasana';
    if (sec.id === 'savasana') renderSavaChips();
    if (bodyscanOn) setBodyscan(false, { quiet: true, skipResume: true });

    const prev = plan[idx - 1];
    if (state.chime && sec.id === 'savasana' && !opts.noChime) chime();
    if (state.chime && prev && prev.id === 'savasana') chime();

    playSection(idx, opts);
  }

  function playSection(idx, opts) {
    const sec = plan[idx];
    const key = keyForSection(sec, idx);
    playPool(key, opts);
  }

  function chime() {
    const eng = ensureAudio();
    eng.setVolume(state.volume / 100);
    eng.chime(0.9);
  }

  function tick() {
    if (mode !== 'class') return;
    const now = Date.now();
    const idx = currentIndex(now);
    if (idx !== activeIndex) enterSection(idx);

    const b = boundaries();
    const t = elapsedMs(now);
    const left = Math.max(0, planTotalMs() - t);
    const secLeft = Math.max(0, b[activeIndex + 1] - t);

    $('#timeLeft').textContent = mmss(secLeft);
    $('#timeElapsed').textContent = mmss(t);
    $('#timeTotal').textContent = mmss(planTotalMs());
    $('#progressFill').style.width = (t / planTotalMs() * 100).toFixed(2) + '%';
    document.title = mode === 'class'
      ? mmss(secLeft) + ' · ' + plan[activeIndex].name + ' · 소마토센서리 요가'
      : '소마토센서리 요가 · 클래스 음악';

    if (t >= planTotalMs() - 300) endClass();
  }

  function startClass() {
    if (pv.track) stopPreview(false);
    plan = buildPlan();
    yt.errors = 0;
    showScreen('class');
    renderSegments();
    startedAt = Date.now(); pausedTotal = 0; pausedAt = 0;
    activeIndex = -1;
    $('#app').classList.remove('is-paused');
    $('#playBtn').setAttribute('aria-label', '일시정지');
    if (state.ambientOn) endAmbientSoft();   // 대기 음악은 3.5초에 걸쳐 줄어들고 수업 음악이 그 위에서 서서히 올라옵니다
    ensureAudio();
    ensureYT();
    enterSection(0, { noChime: true });
    if (state.chime) setTimeout(() => chime(), 900);
    requestWake();
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 400);
    tick();
    $('#footStatus').textContent = '수업 진행 중';
    savePrefs();
  }

  function endClass() {
    clearInterval(tickTimer);
    if (pv.track) stopPreview(false);
    const total = planTotalMs();
    showScreen('done');
    if (bodyscanOn) setBodyscan(false, { quiet: true, skipResume: true });
    fadeOutAll(1800);
    releaseWake();
    if (state.chime) setTimeout(() => chime(), 300);
    $('#doneStats').innerHTML =
      `<div><b>${Math.round(total / 60000)}분</b><span>수업 시간</span></div>
       <div><b>${plan.length}</b><span>구간</span></div>
       <div><b>${FLOW_THEMES[state.theme].short}</b><span>플로우 테마</span></div>`;
    $('#doneSummary').textContent = Math.round(total / 60000) + '분의 흐름이 마무리되었습니다. 대기 음악으로 이어집니다.';
    $('#footStatus').textContent = '수업 종료';
    document.title = '수업 종료 · 소마토센서리 요가';
    setTimeout(() => {
      if (mode !== 'done') return;
      playAmbient(true);
      $('#ambientBtn').setAttribute('aria-pressed', 'true');
      $('#ambientBtnLabel').textContent = '대기 음악 끄기';
    }, 2600);
  }

  function togglePause() {
    if (mode !== 'class') return;
    const paused = $('#app').classList.contains('is-paused');
    if (!paused) {
      pausedAt = Date.now();
      $('#app').classList.add('is-paused');
      $('#playBtn').setAttribute('aria-label', '재생');
      $('#nowCard').classList.remove('is-playing');
      clearYTTimers();
      if (yt.player) { try { yt.player.pauseVideo(); } catch (e) {} }
      if (audio && audio.playing) audio.stop(0.4);
      releaseWake();
      $('#footStatus').textContent = '일시정지';
    } else {
      if (pausedAt) { pausedTotal += Date.now() - pausedAt; pausedAt = 0; }
      $('#app').classList.remove('is-paused');
      $('#playBtn').setAttribute('aria-label', '일시정지');
      $('#nowCard').classList.add('is-playing');
      if (bodyscanOn) {
        startBuiltin('bodyscan', { t: '바디스캔 명상', a: '아주 낮은 울림 · 숨결' });
      } else if (owner === 'builtin' || state.sourceMode === 'builtin' || !yt.ready) {
        const sec = plan[activeIndex];
        startBuiltin(sectionTexture(sec));
      } else if (yt.player) {
        try { yt.player.playVideo(); } catch (e) {}
      }
      if (keepAlive && keepAlive.paused) keepAlive.play().catch(() => {});
      requestWake();
      $('#footStatus').textContent = '수업 진행 중';
    }
  }

  /* ── Wake Lock ──────────────────────────────── */
  async function requestWake() {
    if (!state.wake || !('wakeLock' in navigator)) return;
    if (wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
      $('#wakePill').setAttribute('aria-pressed', 'true');
    } catch (e) {}
  }
  function releaseWake() {
    if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
  }

  /* ── 사바아사나 패널 ────────────────────────── */
  function renderSavaChips() {
    const wrap = $('#savaChips');
    wrap.innerHTML = Object.keys(SAVA_POOLS).map((k) =>
      `<button type="button" class="sava-chip ${state.pool === k ? 'is-on' : ''}" data-pool="${k}">${SAVA_POOLS[k].short}</button>`
    ).join('');
  }

  /* ── 바디스캔 명상 — 안내하시는 동안 잔잔한 사운드만 ── */
  function setBodyscan(on, opts) {
    opts = opts || {};
    if (bodyscanOn === on && !opts.force) return;
    bodyscanOn = on;
    ['#scanPill', '#bodyscanBtn'].forEach((sel) => {
      const el = $(sel);
      if (el) el.setAttribute('aria-pressed', String(on));
    });
    if (on) {
      startBuiltin('bodyscan', { t: '바디스캔 명상', a: '아주 낮은 울림 · 숨결' });
      $('#footStatus').textContent = '바디스캔 명상 사운드';
      if (!opts.quiet) toast('바디스캔 명상 사운드가 흐릅니다. 끄려면 한 번 더 눌러 주세요.');
    } else {
      if (!opts.skipResume && mode === 'class' && plan[activeIndex]) {
        playSection(activeIndex);
        $('#footStatus').textContent = '수업 진행 중';
      }
    }
  }

  /* ── 시트 ───────────────────────────────────── */
  let openSheetEl = null;
  function openSheet(id) {
    $('#backdrop').hidden = false;
    const el = $('#' + id);
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-open'));
    openSheetEl = el;
  }
  function closeSheet() {
    if (!openSheetEl) return;
    const el = openSheetEl;
    el.classList.remove('is-open');
    openSheetEl = null;
    $('#backdrop').hidden = true;
    setTimeout(() => { el.hidden = true; }, 420);
  }

  function renderThemeSheet() {
    $('#themeList').innerHTML = Object.keys(FLOW_THEMES).map((k) => {
      const t = FLOW_THEMES[k];
      return `<button type="button" class="theme-item ${state.theme === k ? 'is-on' : ''}" data-theme="${k}">
        <span class="theme-mark"></span>
        <span class="theme-text"><strong>${t.name}</strong><span>${t.desc}</span></span>
      </button>`;
    }).join('');
    $$('#savaLenSetting button').forEach((b) => {
      b.classList.toggle('is-on', Number(b.dataset.min) === (state.savaMin === 5 ? 5 : 10));
    });
    $('#poolList').innerHTML = Object.keys(SAVA_POOLS).map((k) => {
      const p = SAVA_POOLS[k];
      return `<button type="button" class="pool-item ${state.pool === k ? 'is-on' : ''}" data-pool="${k}">
        ${p.name}${k === 'random' ? '<small>매일 다른 풀에서</small>' : '<small>' + p.short + '</small>'}
      </button>`;
    }).join('');
  }

  function renderSettings() {
    $('#sourceSelect').value = state.sourceMode;
    $('#chimeSwitch').checked = !!state.chime;
    $('#wakeSwitch').checked = !!state.wake;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function parseYtId(input) {
    const s = String(input || '').trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    const m = s.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/|\/live\/|\/v\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function addCustom(key, url, title) {
    const id = parseYtId(url);
    if (!id) { toast('유튜브 주소를 확인해 주세요.'); return false; }
    if (rawTracks(key).some((t) => t.y === id)) { toast('이미 이 파트에 있는 곡입니다.'); return false; }
    state.custom[key] = state.custom[key] || [];
    state.custom[key].push({ y: id, t: title || '직접 추가한 곡' });
    savePrefs();
    if (mode === 'class' && plan[activeIndex] && keyForSection(plan[activeIndex]) === key) {
      playSection(activeIndex, { crossfade: true });
    }
    return true;
  }

  /* ── 미리듣기 ─────────────────────────────────
     본 재생과 별도의 유튜브 플레이어 한 개만 씁니다. 미리듣기를 시작하면
     수업·대기 음악은 곷바로 멈추고, 정지(또는 한 곡 끝)하면 원래대로 돌아갑니다.
     그래서 미리듣기끼리, 수업 음악과 겹쳐 소리가 나는 일이 없습니다. */
  const pv = {
    player: null, ready: false, track: '', key: '', pending: '', playing: false,
    fade: null, watchdog: null, probe: null, ad: false, ramped: false,
    nudges: 0, live: 0, vol: 0, restore: null, hold: false, startedAt: 0
  };

  /* 미리듣기 플레이어는 앱을 열 때 미리 만들어 두고 첫 대기곡을 cue 해 둡니다.
     ▶ 를 누른 순간에 플레이어를 새로 만드는 지연(iOS에서 1~3초)이 사라집니다. */
  function ensurePreviewYT() {
    if (pv.player || !window.YT || !window.YT.Player) return;
    const host = $('#ytPreviewHost');
    if (!host || host.querySelector('#ytPreviewPlayer')) return;
    const div = document.createElement('div');
    div.id = 'ytPreviewPlayer';
    host.appendChild(div);
    try {
      pv.player = new YT.Player('ytPreviewPlayer', {
        width: 320, height: 180,
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1, fs: 0, rel: 0,
          modestbranding: 1, playsinline: 1, origin: location.origin
        },
        events: {
          onReady: () => {
            pv.ready = true;
            try { pv.player.setVolume(0); pv.player.mute(); } catch (e) {}
            if (pv.pending) {
              const y = pv.pending;
              pv.pending = '';
              if (!pv.track) pv.track = y;
              playPreviewNow(y);
            } else if (!pv.track) {
              const first = firstPreviewId();
              if (first) { try { pv.player.cueVideoById({ videoId: first }); } catch (e) {} }
            }
          },
          onStateChange: (e) => {
            if (e.data === 1) markPreviewPlaying();
            if (e.data === 0) previewEnded();
          },
          onError: () => previewFailed()
        }
      });
    } catch (e) { pv.player = null; }
  }

  function duckForPreview() {
    if (!pv.restore) {
      pv.restore = {
        classMode: mode === 'class' && !!plan[activeIndex],
        ambient: !!state.ambientOn,
        owner: owner
      };
    }
    clearYTTimers();
    if (yt.player) { try { yt.player.pauseVideo(); } catch (e) {} }
    if (audio && audio.playing) audio.stop(0.3);
    owner = 'none';
    yt.volume = 0;
    $('#nowCard').classList.remove('is-playing');
  }

  function resumeAfterPreview() {
    const r = pv.restore;
    pv.restore = null;
    if (!r) return;
    if (r.classMode && mode === 'class' && plan[activeIndex]) {
      /* 같은 곡이 그대로 열려 있으면 그 지점에서 이어지고, 아니면 구간을 다시 시작합니다 */
      let same = false;
      try {
        const vd = yt.player ? (yt.player.getVideoData() || {}) : {};
        same = r.owner === 'youtube' && !!yt.expected && vd.video_id === yt.expected;
      } catch (e) { same = false; }
      if (same) {
        takeYT();
        try { yt.player.playVideo(); } catch (e) {}
        yt.volume = 0;
        setBadge('youtube');
        $('#nowCard').classList.add('is-playing');
        ytFadeTo(outVolume(), 1200);
        watchPlayback();
        armWatchdog(12000);
      } else {
        playSection(activeIndex, { crossfade: true });
        $('#nowCard').classList.add('is-playing');
      }
      $('#footStatus').textContent = '수업 진행 중';
    } else if (r.ambient && state.ambientOn) {
      playAmbient(true);
    }
  }

  function previewTrack(y, key) {
    if (!y) return;
    if (pv.track === y && pv.playing) { stopPreview(true); return; }
    duckForPreview();
    pv.track = y;
    pv.key = key;
    pv.playing = false;
    pv.hold = false;
    hidePvBox();
    ensurePreviewYT();
    syncPreviewUI();
    if (!pv.ready) {
      pv.pending = y;
      if (!window.YT || !window.YT.Player) ensureYT();
      return;
    }
    playPreviewNow(y);
  }

  /* 누른 그 순간(같은 제스처 안)에 loadVideoById + playVideo 를 부르고,
     재생 증거가 잡히는 즉시 '미리듣기'로 넘깁니다. 이미 열려 있는 영상은
     다시 불러오지 않으므로 광고를 새로 요청하지 않고 곧바로 이어집니다. */
  function playPreviewNow(y) {
    if (!pv.player || !pv.ready) { pv.pending = y; return; }
    clearTimeout(pv.watchdog);
    clearInterval(pv.fade);
    clearInterval(pv.probe);
    pv.ad = false;
    pv.ramped = false;
    pv.nudges = 0;
    pv.live = 0;
    pv.hold = false;
    pv.startedAt = Date.now();
    pv.vol = 0;
    let same = false;
    try {
      const vd = pv.player.getVideoData ? (pv.player.getVideoData() || {}) : {};
      same = !!vd.video_id && vd.video_id === y;
    } catch (e) { same = false; }
    try { pv.player.setVolume(0); pv.player.mute(); } catch (e) {}
    try {
      if (same) {
        try { if ((pv.player.getCurrentTime() || 0) > 0.4) pv.player.seekTo(0, true); } catch (e) {}
      } else {
        pv.player.loadVideoById({ videoId: y, startSeconds: 0 });
      }
      pv.player.playVideo();          // 제스처 안에서 바로 — iOS 자동재생 차단 회피
    } catch (e) { previewFailed(); return; }
    startPreviewProbe();
    pv.watchdog = setTimeout(() => {
      if (pv.playing) return;
      let st = -1, ct = 0;
      try { st = pv.player.getPlayerState(); ct = pv.player.getCurrentTime() || 0; } catch (e) { return; }
      if (st === 1 || ct > 0.2) { markPreviewPlaying(); return; }
      previewFailed();
    }, 25000);
  }

  function markPreviewPlaying() {
    if (pv.playing) return;
    pv.playing = true;
    pv.hold = false;
    hidePvBox();
    syncPreviewUI();
  }

  function showPvBox() {
    const h = $('#ytPreviewHost');
    if (h) h.classList.add('is-vis');
  }
  function hidePvBox() {
    const h = $('#ytPreviewHost');
    if (h) h.classList.remove('is-vis');
  }
  function firstPreviewId() {
    const list = waitList();
    return list.length ? (list[0].y || '') : '';
  }

  /* 150ms마다 재생 증거를 확인합니다. 1.2초가 지나도 소리가 시작되지 않으면
     광고이거나 iOS가 자동재생을 막은 경우이므로, 유튜브가 띄운 '건너뛰기'를
     직접 누를 수 있도록 작은 플레이어를 화면에 보여 줍니다. */
  function startPreviewProbe() {
    clearInterval(pv.probe);
    pv.probe = setInterval(() => {
      if (!pv.player || !pv.track) { clearInterval(pv.probe); pv.probe = null; return; }
      let st = -1, ct = 0;
      try {
        st = pv.player.getPlayerState();
        ct = pv.player.getCurrentTime() || 0;
      } catch (e) { return; }
      const waited = Date.now() - pv.startedAt;
      if (st === 1 || ct > 0.2) {
        markPreviewPlaying();
        if (!pv.ramped) { pv.ramped = true; pvFadeTo(state.volume, 400); }
        clearInterval(pv.probe);
        pv.probe = null;
        return;
      }
      if (waited > 1200 && !pv.hold) {
        pv.hold = true;
        showPvBox();
        syncPreviewUI();
      }
      if (waited > 900 && (st === -1 || st === 2 || st === 5) && pv.nudges < 3) {
        pv.nudges++;
        try { pv.player.playVideo(); } catch (e) {}
      }
      if (waited > 25000) { clearInterval(pv.probe); pv.probe = null; previewFailed(); }
    }, 150);
  }

  function pvFadeTo(target, ms) {
    if (!pv.player || !pv.player.setVolume) return;
    try { if (target > 0) pv.player.unMute(); } catch (e) {}
    clearInterval(pv.fade);
    const from = pv.vol || 0;
    const steps = Math.max(1, Math.round((ms || 600) / 50));
    let i = 0;
    pv.fade = setInterval(() => {
      i++;
      const s = i / steps;
      pv.vol = from + (target - from) * (s * s * (3 - 2 * s));
      try { pv.player.setVolume(clamp(pv.vol, 0, 100)); } catch (e) {}
      if (i >= steps) { clearInterval(pv.fade); pv.fade = null; }
    }, 50);
  }

  function stopPreview(restore) {
    clearTimeout(pv.watchdog);
    clearInterval(pv.fade);
    clearInterval(pv.probe);
    pv.probe = null;
    pv.ad = false;
    pv.hold = false;
    pv.playing = false; pv.track = ''; pv.pending = '';
    hidePvBox();
    if (pv.player) {
      /* 정지가 아니라 일시정지 — 같은 곡을 다시 누르면 광고 없이 바로 이어집니다 */
      try { pv.player.setVolume(0); pv.player.mute(); pv.player.pauseVideo(); } catch (e) {}
    }
    pv.vol = 0;
    syncPreviewUI();
    if (restore) resumeAfterPreview();
  }

  function previewEnded() {
    clearTimeout(pv.watchdog);
    clearInterval(pv.fade);
    clearInterval(pv.probe);
    pv.probe = null;
    pv.ad = false;
    pv.hold = false;
    pv.playing = false; pv.track = ''; pv.pending = '';
    hidePvBox();
    syncPreviewUI();
    resumeAfterPreview();
  }

  function previewFailed() {
    clearTimeout(pv.watchdog);
    clearInterval(pv.fade);
    clearInterval(pv.probe);
    pv.probe = null;
    pv.ad = false;
    pv.hold = false;
    pv.playing = false; pv.track = ''; pv.pending = '';
    hidePvBox();
    if (pv.player) { try { pv.player.pauseVideo(); } catch (e) {} }
    syncPreviewUI();
    toast('이 곡은 여기서 미리듣기가 되지 않아요. ✕ 로 빼거나 다른 곡을 들어보세요.');
    resumeAfterPreview();
  }

  /* ── 선곡 관리 한 페이지 ─────────────────────── */
  const LIST_KEYS = function () {
    return ['wait', 'opening', 'breath']
      .concat(Object.keys(FLOW_THEMES).map((k) => 'flow:' + k))
      .concat(['cooldown'])
      .concat(Object.keys(SAVA_POOLS).filter((k) => k !== 'random').map((k) => 'savasana:' + k));
  };

  function subLabel(key) {
    const p = key.split(':');
    if (p[0] === 'flow') {
      const t = FLOW_THEMES[p[1]];
      return t.name + (state.theme === p[1] ? '<em class="pl-cur">지금 테마</em>' : '');
    }
    if (SAVA_POOLS[p[1]]) return SAVA_POOLS[p[1]].name;
    return p[1];
  }

  function rowHtml(key, t, idx, pinN) {
    const first = idx < pinN && idx === 0;
    const pinned = idx < pinN;
    const custom = !!t.custom;
    return `<li class="trk${first ? ' is-first' : ''}${pinned ? ' is-pinned' : ''}${custom ? ' is-custom' : ''}" data-key="${key}" data-y="${t.y}">
      <button class="trk-play" type="button" data-key="${key}" data-y="${t.y}" aria-label="미리듣기" aria-pressed="false">
        <svg class="ico ico-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13L19 12 8 5.5Z"/></svg>
        <svg class="ico ico-stop" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.4"/></svg>
      </button>
      <div class="trk-body">
        <span class="trk-title">${first ? '<em class="trk-first">첫 곡</em>' : ''}${escapeHtml(t.t || '—')}</span>
        <span class="trk-artist">${escapeHtml(t.a || '')}</span>
      </div>
      ${custom ? `<button class="trk-del" type="button" data-key="${key}" data-y="${t.y}">삭제</button>` : ''}
      <button class="trk-pin" type="button" data-key="${key}" data-y="${t.y}" aria-pressed="${first ? 'true' : 'false'}" aria-label="맨 앞으로">↑</button>
      ${custom ? '' : `<button class="trk-x" type="button" data-key="${key}" data-y="${t.y}" aria-label="빼기">✕</button>`}
    </li>`;
  }

  function groupHtml(key, label) {
    const o = orderedTracks(key);
    const ex = excludedOf(key).filter((id) => o.all.some((t) => t.y === id));
    const rows = o.list.map((t, i) => rowHtml(key, t, i, o.pinN)).join('');
    const exRows = ex.map((id) => {
      const t = o.all.filter((x) => x.y === id)[0] || { t: id, a: '' };
      return `<li><span>${escapeHtml(t.t || id)}<em>${escapeHtml(t.a || '')}</em></span>
        <button class="restore" type="button" data-key="${key}" data-y="${id}">되돌리기</button></li>`;
    }).join('');
    return `<div class="pl-group" id="g-${key.replace(/:/g, '-')}">
      <div class="pl-group-head"><span class="pl-group-name">${label || ''}</span>
        <span class="pl-group-count">${o.list.length}곡 재생${ex.length ? ' · ' + ex.length + '곡 뺌' : ''}</span></div>
      <ul class="trk-list">${rows}</ul>
      <button class="add-toggle" type="button" data-key="${key}">＋ 유튜브 링크로 곡 추가</button>
      <div class="add-inline" hidden data-key="${key}">
        <input type="url" class="add-url" placeholder="https://www.youtube.com/watch?v=..." inputmode="url" autocomplete="off">
        <input type="text" class="add-title" placeholder="곡 제목 (선택)" autocomplete="off">
        <button class="add-go" type="button" data-key="${key}">추가</button>
      </div>
      ${ex.length ? `<details class="ex-wrap"><summary>뺀 곡 ${ex.length} · 되돌리기</summary><ul class="ex-list">${exRows}</ul></details>` : ''}
    </div>`;
  }

  function renderPlaylist() {
    const parts = [
      { key: 'wait', title: '대기 음악', note: '수업 전과 수업 후에 흐르는 음악' },
      { key: 'opening', title: '오프닝', note: '15분 · 호흡을 바닥으로 내려놓는 시간' },
      { key: 'breath', title: '호흡', note: '3분 · 호흡을 고요하게 내려놓는 음악' },
      { key: 'flow', title: '메인 플로우', note: '30분 · 고른 테마의 곡이 흐릅니다', subs: Object.keys(FLOW_THEMES) },
      { key: 'cooldown', title: '컴다운', note: '30분 · 심박을 천천히 가라앉히는 시간' },
      { key: 'savasana', title: '사바아사나', note: '5·10분 · 고른 풀의 곡이 흐릅니다. 랜덤 추천은 감성곡·건반·싱잉볼·만트라를 섞습니다', subs: Object.keys(SAVA_POOLS).filter((k) => k !== 'random') }
    ];
    $('#plBody').innerHTML = parts.map((part) => {
      const inner = part.subs
        ? part.subs.map((k) => groupHtml(part.key + ':' + k, subLabel(part.key + ':' + k))).join('')
        : groupHtml(part.key, '');
      return `<section class="pl-part">
        <div class="pl-part-head"><h3>${part.title}</h3><span>${part.note}</span></div>
        ${inner}
      </section>`;
    }).join('');
    updateListCount();
    syncPreviewUI();
  }

  function refreshGroup(key) {
    const el = document.getElementById('g-' + key.replace(/:/g, '-'));
    if (!el) return;
    const label = key.indexOf(':') !== -1 ? subLabel(key) : '';
    const tmp = document.createElement('div');
    tmp.innerHTML = groupHtml(key, label);
    const next = tmp.firstElementChild;
    if (!next) return;
    el.replaceWith(next);
    syncPreviewUI();
    updateListCount();
  }

  function updateListCount() {
    let play = 0, ex = 0;
    LIST_KEYS().forEach((k) => {
      const o = orderedTracks(k);
      play += o.list.length;
      ex += excludedOf(k).filter((id) => o.all.some((t) => t.y === id)).length;
    });
    $('#plCount').textContent = play + '곡 재생' + (ex ? ' · ' + ex + '곡 뺌' : '');
  }

  function syncPreviewUI() {
    const body = $('#plBody');
    if (body) {
      $$('.trk', body).forEach((row) => {
        const on = !!pv.track && row.dataset.y === pv.track && row.dataset.key === pv.key;
        row.classList.toggle('is-preview', on);
        const b = row.querySelector('.trk-play');
        if (b) b.setAttribute('aria-pressed', String(on));
      });
    }
    const now = $('#plNow');
    if (now) {
      now.hidden = !pv.track;
      if (pv.track) {
        const t = rawTracks(pv.key).filter((x) => x.y === pv.track)[0] || {};
        $('#plNowTitle').textContent =
          (pv.hold ? '광고 · 건너뛰기를 눌러 주세요 · '
            : (pv.playing ? '미리듣기 · ' : '여는 중 · ')) + (t.t || '');
      }
    }
  }

  function togglePin(key, y) {
    const pins = pinsOf(key).slice();
    const i = pins.indexOf(y);
    if (i === 0) pins.shift();
    else { if (i > -1) pins.splice(i, 1); pins.unshift(y); }
    if (pins.length) state.pins[key] = pins; else delete state.pins[key];
    savePrefs();
    refreshGroup(key);
    toast(i === 0 ? '첫 곡 지정을 풀었습니다.' : '이 곡을 맨 앞으로 올렸습니다.');
  }

  function excludeTrack(key, y) {
    const o = orderedTracks(key);
    if (o.list.filter((t) => t.y !== y).length === 0) {
      toast('이 파트의 마지막 곡은 뺄 수 없어요. 수업이 비지 않도록 남겨 두었습니다.');
      return;
    }
    const arr = excludedOf(key).slice();
    if (arr.indexOf(y) === -1) arr.push(y);
    state.excluded[key] = arr;
    savePrefs();
    /* 지금 재생 중인 큐에서도 바로 빼기 — 수업 중에 뺴도 그 곡은 다시 나오지 않습니다 */
    const qi = yt.queue ? yt.queue.map((t) => t.y).indexOf(y) : -1;
    const wasPlaying = qi > -1 && qi === yt.qi;
    if (qi > -1) {
      yt.queue.splice(qi, 1);
      if (qi < yt.qi) yt.qi--;
      if (yt.qi >= yt.queue.length) yt.qi = 0;
    }
    if (mode === 'class' && plan[activeIndex] && wasPlaying) {
      if (yt.queue.length) nextTrack(false, { crossfade: true });   // 지금 흐르는 곡을 뺐다면 바로 다음 곡으로
      else playSection(activeIndex, { crossfade: true });
    }
    refreshGroup(key);
    toast('수업에서 뺐습니다. “뺀 곡”에서 되돌릴 수 있어요.');
  }

  function restoreTrack(key, y) {
    state.excluded[key] = excludedOf(key).filter((id) => id !== y);
    if (!state.excluded[key].length) delete state.excluded[key];
    savePrefs();
    refreshGroup(key);
    toast('다시 재생 목록에 넣었습니다.');
  }

  function deleteCustom(key, y) {
    if (!state.custom[key]) return;
    state.custom[key] = state.custom[key].filter((c) => c.y !== y);
    if (!state.custom[key].length) delete state.custom[key];
    state.pins[key] = pinsOf(key).filter((id) => id !== y);
    if (!state.pins[key].length) delete state.pins[key];
    savePrefs();
    refreshGroup(key);
    toast('추가한 곡을 지웠습니다.');
  }

  function openPlaylist() {
    if (openSheetEl) closeSheet();
    renderPlaylist();
    const el = $('#playlistView');
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-open'));
  }

  function closePlaylist() {
    if (pv.track) stopPreview(true);
    const el = $('#playlistView');
    el.classList.remove('is-open');
    setTimeout(() => { el.hidden = true; }, 340);
  }

  /* 구간 타임라인에서 바로 그 구간으로 — 60분 수업에서 건너뛸 때 */
  function jumpTo(idx) {
    if (mode !== 'class') return;
    idx = clamp(idx, 0, plan.length - 1);
    const base = pausedAt || Date.now();
    startedAt = base - boundaries()[idx] - pausedTotal;
    enterSection(idx, { crossfade: true });
    tick();
  }

  /* ── 이벤트 연결 ────────────────────────────── */
  function bind() {
    $('#themeToggle').addEventListener('click', () => {
      state.dark = !state.dark;
      applyTheme(); savePrefs();
    });
    $('#settingsBtn').addEventListener('click', () => { renderSettings(); openSheet('sheetSettings'); });
    $$('.sheet-close').forEach((b) => b.addEventListener('click', closeSheet));
    $('#backdrop').addEventListener('click', closeSheet);

    $('#startBtn').addEventListener('click', startClass);
    $('#ambientBtn').addEventListener('click', () => {
      if (state.ambientOn) stopAmbient(); else playAmbient();
    });
    $('#playBtn').addEventListener('click', togglePause);
    $('#skipBtn').addEventListener('click', skipTrack);
    const jump = (delta) => {
      if (mode !== 'class') return;
      jumpTo(currentIndex(Date.now()) + delta);
    };
    $('#nextBtn').addEventListener('click', () => jump(1));
    $('#prevBtn').addEventListener('click', () => jump(-1));
    $('#jumpRow').addEventListener('click', (e) => {
      const b = e.target.closest('.jump-chip');
      if (b) jumpTo(Number(b.dataset.i));
    });
    $('#savaChips').addEventListener('click', (e) => {
      const b = e.target.closest('.sava-chip');
      if (!b) return;
      state.pool = b.dataset.pool;
      savePrefs();
      renderIdleChoices();
      if (mode === 'class' && plan[activeIndex] && plan[activeIndex].id === 'savasana') enterSection(activeIndex);
      else renderSavaChips();
    });
    $('#endBtn').addEventListener('click', endClass);

    $('#volume').addEventListener('input', (e) => {
      state.volume = Number(e.target.value);
      savePrefs();
      const v = outVolume();
      if (owner === 'youtube' && yt.player) { yt.volume = v; try { yt.player.setVolume(v); } catch (e2) {} }
      if (audio) audio.setVolume(v / 100);
    });

    $('#chimePill').addEventListener('click', () => {
      state.chime = !state.chime; savePrefs();
      $('#chimePill').setAttribute('aria-pressed', String(state.chime));
      $('#chimeSwitch').checked = state.chime;
      if (state.chime) chime();
    });
    $('#wakePill').addEventListener('click', () => {
      state.wake = !state.wake; savePrefs();
      $('#wakePill').setAttribute('aria-pressed', String(state.wake));
      $('#wakeSwitch').checked = state.wake;
      if (state.wake) requestWake(); else releaseWake();
    });
    $('#themePill').addEventListener('click', () => { renderThemeSheet(); openSheet('sheetTheme'); });
    $('#sourcePill').addEventListener('click', () => {
      state.sourceMode = state.sourceMode === 'builtin' ? 'auto' : 'builtin';
      savePrefs();
      updateSourcePill();
      $('#sourceSelect').value = state.sourceMode;
      if (mode === 'class' && !bodyscanOn) playSection(activeIndex);
      if (mode === 'idle' && state.ambientOn) playAmbient();
      toast(state.sourceMode === 'builtin' ? '내장 힐링 사운드로 재생합니다.' : '유튜브 음원으로 재생합니다.');
    });

    $('#idleThemeChip').addEventListener('click', () => { renderThemeSheet(); openSheet('sheetTheme'); });
    $('#idleLenChip').addEventListener('click', () => { renderThemeSheet(); openSheet('sheetTheme'); });
    $('#idleSavaChip').addEventListener('click', () => { renderThemeSheet(); openSheet('sheetTheme'); });

    $('#themeList').addEventListener('click', (e) => {
      const b = e.target.closest('.theme-item');
      if (!b) return;
      state.theme = b.dataset.theme; savePrefs();
      renderThemeSheet(); renderIdleChoices(); renderIdlePlan();
      $('#themePillLabel').textContent = FLOW_THEMES[state.theme].short;
      if (mode === 'class' && plan[activeIndex] && plan[activeIndex].id === 'flow') {
        enterSection(activeIndex);
      }
      toast(FLOW_THEMES[state.theme].name + ' 선택');
    });
    ['#savaLenSetting', '#savaLenPicker'].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-min]');
        if (b) setSavaMin(Number(b.dataset.min));
      });
    });
    $('#poolList').addEventListener('click', (e) => {
      const b = e.target.closest('.pool-item');
      if (!b) return;
      state.pool = b.dataset.pool; savePrefs();
      renderThemeSheet(); renderIdleChoices();
      if (mode === 'class' && plan[activeIndex] && plan[activeIndex].id === 'savasana') enterSection(activeIndex);
    });
    $('#savaRandom').addEventListener('click', () => {
      state.pool = 'random'; savePrefs();
      renderIdleChoices();
      if (mode === 'class') enterSection(activeIndex);
      toast('오늘의 랜덤 추천으로 바꿨습니다.');
    });

    /* 바디스캔 명상 — 사바아사나 패널 버튼과 수업 컨트롤 칩이 함께 켜고 끕니다 */
    const scanToggle = () => {
      if (mode !== 'class') { toast('수업 중 사바아사나 시간에 사용하실 수 있어요.'); return; }
      setBodyscan(!bodyscanOn);
    };
    $('#scanPill').addEventListener('click', scanToggle);
    $('#bodyscanBtn').addEventListener('click', scanToggle);

    $('#sourceSelect').addEventListener('change', (e) => {
      state.sourceMode = e.target.value; savePrefs();
      updateSourcePill();
      if (mode === 'class' && !bodyscanOn) playSection(activeIndex);
      if (mode === 'idle' && state.ambientOn) playAmbient();
    });
    $('#chimeSwitch').addEventListener('change', (e) => {
      state.chime = e.target.checked; savePrefs();
      $('#chimePill').setAttribute('aria-pressed', String(state.chime));
    });
    $('#wakeSwitch').addEventListener('change', (e) => {
      state.wake = e.target.checked; savePrefs();
      $('#wakePill').setAttribute('aria-pressed', String(state.wake));
      if (state.wake) requestWake(); else releaseWake();
    });
    /* ── 선곡 관리 ─────────────────────────────── */
    $('#playlistBtn').addEventListener('click', openPlaylist);
    $('#plClose').addEventListener('click', closePlaylist);
    $('#settingsPlaylistBtn').addEventListener('click', () => {
      closeSheet();
      setTimeout(openPlaylist, 200);
    });
    $('#plNowStop').addEventListener('click', () => stopPreview(true));
    $('#plRestoreAll').addEventListener('click', () => {
      state.excluded = {};
      savePrefs();
      renderPlaylist();
      toast('뺀 곡을 모두 되돌렸습니다.');
    });
    $('#plUnpinAll').addEventListener('click', () => {
      state.pins = {};
      savePrefs();
      renderPlaylist();
      toast('첫 곡 지정을 모두 풀었습니다.');
    });
    $('#plBody').addEventListener('click', (e) => {
      const play = e.target.closest('.trk-play');
      if (play) { previewTrack(play.dataset.y, play.dataset.key); return; }
      const pin = e.target.closest('.trk-pin');
      if (pin) { togglePin(pin.dataset.key, pin.dataset.y); return; }
      const x = e.target.closest('.trk-x');
      if (x) { excludeTrack(x.dataset.key, x.dataset.y); return; }
      const del = e.target.closest('.trk-del');
      if (del) { deleteCustom(del.dataset.key, del.dataset.y); return; }
      const rs = e.target.closest('.restore');
      if (rs) { restoreTrack(rs.dataset.key, rs.dataset.y); return; }
      const tg = e.target.closest('.add-toggle');
      if (tg) {
        const f = tg.parentElement.querySelector('.add-inline');
        if (!f) return;
        f.hidden = !f.hidden;
        if (!f.hidden) f.querySelector('.add-url').focus();
        return;
      }
      const go = e.target.closest('.add-go');
      if (go) {
        const f = go.parentElement;
        const url = f.querySelector('.add-url').value;
        const title = f.querySelector('.add-title').value.trim();
        if (addCustom(go.dataset.key, url, title)) {
          f.hidden = true;
          refreshGroup(go.dataset.key);
          toast('추가했습니다. 이 파트에서 재생됩니다.');
        }
      }
    });

    $('#resetBtn').addEventListener('click', () => {
      state.custom = {};
      state.pins = {};
      state.excluded = {};
      savePrefs();
      if (!$('#playlistView').hidden) renderPlaylist();
      toast('추가한 곡과 선곡 설정을 초기화했습니다.');
    });

    $('#againBtn').addEventListener('click', () => { if (state.ambientOn) stopAmbient(); startClass(); });
    $('#backIdleBtn').addEventListener('click', () => {
      showScreen('idle');
      document.title = '소마토센서리 요가 · 클래스 음악';
      renderIdlePlan(); renderIdleChoices();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      // 화면으로 돌아오면 화면 유지와 오디오를 되찾습니다
      if (state.wake && (mode === 'class' || (mode === 'idle' && state.ambientOn))) requestWake();
      if (audio) audio.resume();
      if (audio && audio.playing && keepAlive && keepAlive.paused) keepAlive.play().catch(() => {});
    });
    // iOS 잠금 상태에서 오디오 세션이 끊기지 않게 재생 엘리먼트를 지켜봅니다
    setInterval(() => {
      if (audio && audio.playing && keepAlive && keepAlive.paused) keepAlive.play().catch(() => {});
    }, 30000);
    window.addEventListener('beforeunload', () => { savePrefs(); });
  }

  /* ── 시작 ───────────────────────────────────── */
  function init() {
    loadPrefs();
    /* 새로 열면 아직 소리는 나지 않습니다 — 대기 음악 버튼도 '켜기' 상태로 시작합니다 */
    state.ambientOn = false;
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('dark') === '1') state.dark = true;
      if (q.get('theme') && FLOW_THEMES[q.get('theme')]) state.theme = q.get('theme');
    } catch (e) {}
    applyTheme();
    plan = buildPlan();
    renderIdlePlan();
    renderIdleChoices();
    renderSettings();
    $('#volume').value = state.volume;
    $('#chimePill').setAttribute('aria-pressed', String(!!state.chime));
    updateSourcePill();
    $('#wakePill').setAttribute('aria-pressed', String(!!state.wake));
    bind();
    setupMediaSession();
    ensureYT();
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
    if (DATA.version) $('#versionLine').textContent = 'somato-music · v' + DATA.version;
  }

  document.addEventListener('DOMContentLoaded', init);
  window.__somato = {
    state, buildPlan, orderedTracks, queuedList, openPlaylist, closePlaylist,
    setSavaMin, jumpTo,
    get pv() { return pv; },
    get previewTrack() { return previewTrack; },
    get stopPreview() { return stopPreview; },
    get plan() { return plan; },
    get yt() { return yt; },
    get audio() { return audio; },
    get owner() { return owner; },
    get mode() { return mode; },
    /* 진단·검증용 — 유튜브 재생 중 내장 사운드 출력이 0인지 실측할 때 씁니다 */
    musicPeak() { return audio ? audio.musicPeak() : 0; },
    musicLevel() { return audio ? audio.musicLevel() : 0; },
    deckGains() { return audio && audio.decks ? audio.decks.map((d) => d.out.gain.value) : []; },
    builtinPlaying() { return !!(audio && audio.playing); },
    debug: {
      watchPlayback, fallbackToBuiltin, startBuiltin, fadeOutAll,
      playSection, playAmbient, stopAmbient, chime
    }
  };
})();
