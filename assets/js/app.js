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
  const DEFAULT_PREFS = {
    theme: 'classic', bridge: 4, pool: 'random', volume: 62,
    sourceMode: 'auto', chime: true, wake: true, dark: false, custom: {}
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
    classic: { name: '클래식 소마토 플로우', short: '클래식', texture: 'flow-classic',
      desc: '뉴에이지 · 레이키 · 스파' },
    neoclassic: { name: '네오클래식 피아노 플로우', short: '네오클래식', texture: 'flow-neo',
      desc: '피아노 · 현대 클래식' },
    mantra: { name: '만트라 · 보컬 힐링 플로우', short: '만트라', texture: 'flow-mantra',
      desc: '만트라 · 키르탄 · 보컬' },
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
    nature: { name: '자연의 밤 · 빗소리', short: '자연음', texture: 'sava-nature-rain' },
    harp: { name: '하프 · 오르골', short: '하프', texture: 'sava-harp' },
    christmas: { name: '크리스마스 잔잔한 캐롤', short: '캐롤', texture: 'sava-xmas' }
  };

  function buildPlan() {
    const b = state.bridge || 4;
    const flow = 30 - (b - 4);
    return [
      { id: 'opening', name: '오프닝', en: 'OPENING', min: 10,
        desc: '호흡을 바닥으로 내려놓는 시간', texture: 'opening' },
      { id: 'bridge', name: '피아노 브릿지', en: 'PIANO BRIDGE', min: b,
        desc: '이루마의 결로 잠깐 쉬어가는 피아노', texture: 'bridge' },
      { id: 'flow', name: '메인 플로우', en: 'MAIN FLOW', min: flow,
        desc: FLOW_THEMES[state.theme].desc, texture: FLOW_THEMES[state.theme].texture },
      { id: 'cooldown', name: '컴다운', en: 'COOLDOWN', min: 10,
        desc: '심박을 천천히 가라앉히는 시간', texture: 'cooldown' },
      { id: 'savasana', name: '사바아사나', en: 'SAVASANA', min: 5,
        desc: '몸이 스스로 회복하는 시간', texture: 'sava-bowl' },
      { id: 'closing', name: '마무리', en: 'CLOSING', min: 1,
        desc: '조용히 호흡을 되찾고 일어나는 시간', texture: 'closing' }
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
  function tracksFor(key) {
    return customTracks(key).concat(baseTracks(key));
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
    const song = tracksFor('savasana:song');   // 첫 곡은 큐레이션 순서(소향 Wind Song)를 지킵니다
    const calm = shuffle(tracksFor('savasana:piano')
      .concat(tracksFor('savasana:bowl'), tracksFor('savasana:vocal')));
    const rest = shuffle(song.slice(1));
    const out = [song[0]];
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
  const yt = {
    apiReady: false, player: null, ready: false, loading: false,
    queue: [], qi: 0, errors: 0, playingBuiltin: false, currentKey: '',
    volume: 62, fadeTimer: null, watchdog: null, started: false
  };

  function ensureAudio() {
    if (!audio) audio = new window.SomatoAudio.Engine();
    audio.init();
    audio.resume();
    audio.setVolume(state.volume / 100);
    return audio;
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
            yt.player.setVolume(0);
            if (mode === 'class' && yt.playingBuiltin && state.sourceMode !== 'builtin') {
              playSection(activeIndex, { soft: true });
            } else if (mode === 'idle' && yt.playingBuiltin && state.ambientOn) {
              playAmbient(true);
            }
          },
          onStateChange: (e) => {
            if (e.data === 1) { yt.errors = 0; clearWatchdog(); }
            if (e.data === 0) nextTrack(true, { crossfade: false });
          },
          onError: (e) => {
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

  function ytFadeTo(target, ms) {
    if (!yt.player || !yt.player.setVolume) return;
    clearInterval(yt.fadeTimer);
    const from = yt.volume;
    const steps = Math.max(1, Math.round((ms || FADE) / 60));
    let i = 0;
    // S-커브: 처음과 끝을 부드럽게
    yt.fadeTimer = setInterval(() => {
      i++;
      const s = i / steps;
      const e = s * s * (3 - 2 * s);
      const v = from + (target - from) * e;
      yt.volume = v;
      try { yt.player.setVolume(clamp(v, 0, 100)); } catch (e) {}
      if (i >= steps) clearInterval(yt.fadeTimer);
    }, 60);
  }

  function clearWatchdog() { clearTimeout(yt.watchdog); yt.watchdog = null; }

  /* 광고가 나오면 음소거한 채 내장 사운드로 메우고, 본 영상이 시작되면 다시 음악으로.
     유튜브 IFrame API는 광고 여부를 직접 알려주지 않아, 로드 직후의 재생 길이로 판별합니다.
     (광고는 60초 이하, 수록곡은 모두 3분 이상) */
  function startAdBed() {
    const sec = plan[activeIndex] || {};
    const eng = ensureAudio();
    yt.playingBuiltin = true;
    eng.start(sectionTexture(sec), {});
    $('#sourceBadge').textContent = '광고 · 내장 사운드';
    $('#sourceBadge').classList.add('is-builtin');
  }
  function stopAdBed() {
    if (audio && audio.playing) audio.stop(1.4);
    yt.playingBuiltin = false;
    yt.adBuiltin = false;
    $('#sourceBadge').textContent = 'YouTube';
    $('#sourceBadge').classList.remove('is-builtin');
  }

  function watchAd() {
    clearInterval(yt.adTimer);
    yt.adBuiltin = false;
    let waited = 0;
    yt.adTimer = setInterval(() => {
      waited += 500;
      let dur = 0, st = -1;
      try {
        dur = yt.player.getDuration();
        st = yt.player.getPlayerState();
      } catch (e) {}
      const isAd = dur > 0 && dur < 100;

      if (isAd) {
        try { yt.player.setVolume(0); } catch (e) {}
        if (!yt.adBuiltin) { yt.adBuiltin = true; startAdBed(); }
      } else if (dur >= 100) {
        // 본 영상 구간 — 실제로 재생이 시작됐을 때만 내장 사운드를 물립니다
        if (st === 1 || st === 3 || st === 2) {
          if (st === 2 || st === -1) { try { yt.player.playVideo(); } catch (e) {} }
          if (st === 1 || st === 3) {
            if (yt.adBuiltin) stopAdBed();
            ytFadeTo(state.volume, 1600);
            clearInterval(yt.adTimer);
          }
        }
        // 광고가 끈 뒤 본 영상이 20초 넘게 시작하지 않으면 내장 사운드로 이 구간을 계속합니다
        if (waited > 20000 && yt.adTimer) {
          clearInterval(yt.adTimer);
          yt.adBuiltin = false;
          yt.playingBuiltin = true;
          $('#sourceBadge').textContent = '내장 사운드';
          $('#sourceBadge').classList.add('is-builtin');
          try { yt.player.pauseVideo(); } catch (e) {}
        }
      }
      if (waited > 95000 && yt.adTimer) {
        if (yt.adBuiltin) stopAdBed();
        ytFadeTo(state.volume, 1500);
        clearInterval(yt.adTimer);
      }
    }, 500);
  }

  function ytPlayTrack(track, opts) {
    opts = opts || {};
    if (!track || !track.y || !yt.player || !yt.ready) return false;
    yt.expected = track.y;
    renderNow(track);
    $('#sourceBadge').textContent = 'YouTube';
    $('#sourceBadge').classList.remove('is-builtin');
    $('#nowCard').classList.add('is-playing');

    /* 전환 중이던 예약이 있으면 덮어쓰지 않도록 정리 */
    clearTimeout(yt.transitionTimer);

    const doLoad = () => {
      yt.playingBuiltin = false;
      yt.adBuiltin = false;
      stopBuiltin(FADE / 1000);   // 내장 사운드가 나고 있었다면 3.5초에 걸쳐 겹치며 사라집니다
      clearWatchdog();
      const armWatchdog = (ms) => {
        yt.watchdog = setTimeout(() => {
          try {
            const ct = yt.player.getCurrentTime();
            const st = yt.player.getPlayerState();
            if (ct > 0.5 || st === 3 || st === 1) return;   // 재생·버퍼링 중이면 기다립니다
            if (!yt.stallRetried) {
              // 시작하지 않고 서 있으면 한 번 다시 재생을 시도합니다
              yt.stallRetried = true;
              try { yt.player.playVideo(); } catch (e) {}
              armWatchdog(8000);
              return;
            }
            // 그래도 시작하지 않으면 — 끊김 없이 내장 사운드로 이어갑니다
            fallbackToBuiltin('유튜브 재생이 지연되어 내장 사운드로 이어갑니다.');
          } catch (e) {}
        }, ms || 20000);
      };
      armWatchdog();
      try {
        yt.player.loadVideoById({ videoId: track.y, startSeconds: 0 });
        setTimeout(() => {
          try { yt.player.setVolume(0); yt.volume = 0; yt.player.playVideo(); } catch (e) {}
        }, 380);
      } catch (e) { return; }
      watchAd();
      ytFadeTo(state.volume, opts.crossfade === false ? 900 : FADE);
    };

    /* 지금 소리가 나고 있으면 먼저 3.5초에 걸쳐 줄인 뒤 새 곡이 0에서 3.5초 동안 올라옵니다 */
    if (opts.crossfade !== false && ytAudible()) {
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
    return !yt.playingBuiltin && !yt.adBuiltin && yt.volume > 2 && !!yt.player;
  }

  function startBuiltin(texture, label, fadeMs) {
    const eng = ensureAudio();
    ensureKeepAlive();
    yt.playingBuiltin = true;
    if (yt.player && ytAudible()) {
      ytFadeTo(0, fadeMs || FADE);
      setTimeout(() => { try { yt.player.pauseVideo(); } catch (e) {} }, (fadeMs || FADE) + 250);
    } else if (yt.player) {
      ytFadeTo(0, 500);
      setTimeout(() => { try { yt.player.pauseVideo(); } catch (e) {} }, 700);
    }
    eng.start(texture, { firstBowl: false, fadeMs: fadeMs || FADE });
    $('#sourceBadge').textContent = texture === 'bodyscan' ? '내장 사운드 · 바디스캔' : '내장 사운드';
    $('#sourceBadge').classList.add('is-builtin');
    $('#nowCard').classList.add('is-playing');
    renderBuiltin(label || builtinLabel(texture));
  }
  function stopBuiltin(sec) {
    if (audio && audio.playing) audio.stop(sec == null ? 1.2 : sec);
    yt.playingBuiltin = false;
  }
  function builtinLabel(texture) {
    const map = {
      waiting: ['대기 음악', '웜 앰비언트 패드'],
      opening: ['그라운딩 패드', '낮은 호흡 · 스파 톤'],
      bridge: ['펠트 피아노', '느린 아르페지오'],
      'flow-classic': ['뉴에이지 피아노', '레이키 · 스파 결'],
      'flow-neo': ['네오클래식 피아노', '맑은 하프 결'],
      'flow-mantra': ['보컬 힐링 패드', '낮은 아- 톤 · 만트라 결'],
      'flow-xmas': ['오르골 캐럴', '잔잔한 연말 결'],
      cooldown: ['이완 하프', '느린 아르페지오'],
      closing: ['마무리 패드', '아주 낮은 호흡'],
      bodyscan: ['바디스캔 명상', '가사 없는 낮은 드론 · 숨결'],
      'sava-song': ['감성 사바아사나 패드', '잔잔한 결의 내장 사운드'],
      'sava-piano': ['사바아사나 피아노', '느리고 낮은 건반'],
      'sava-bowl': ['싱잉볼 사운드스케이프', '주기적인 타종'],
      'sava-vocal': ['보컬 힐링 패드', '아- 코러스'],
      'sava-nature-rain': ['빗소리 · 낮은 패드', '창밖의 비'],
      'sava-nature-night': ['자연의 밤', '풀벌레 · 바람'],
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

  function fallbackToBuiltin(msg) {
    if (state.sourceMode === 'builtin') return;
    yt.errors = 0;
    clearWatchdog();
    const sec = plan[activeIndex] || {};
    // 광고 사이의 내장 사운드가 이미 나고 있으면 그 결을 그대로 이어갑니다 (무음 구간 없이)
    if (!(audio && audio.playing && yt.playingBuiltin)) startBuiltin(sectionTexture(sec));
    else { yt.adBuiltin = false; $('#sourceBadge').textContent = '내장 사운드'; }
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
    ytPlayTrack(cur);
  }

  function playPool(key, opts) {
    yt.currentKey = key;
    const list = key === 'savasana:mix' ? savaMixList() : tracksFor(key);
    // 첫 곡은 큐레이션 순서를 지키고, 그 뒤만 섞습니다.
    yt.queue = list.length ? [list[0]].concat(shuffle(list.slice(1))) : [];
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

  function playAmbient(resume) {
    state.ambientOn = true;
    $('#ambientBtn').setAttribute('aria-pressed', 'true');
    $('#ambientBtnLabel').textContent = '대기 음악 끄기';
    $('#footStatus').textContent = '대기 음악 재생 중';
    if (state.sourceMode === 'builtin' || !yt.ready) {
      if (audio && audio.playing && resume) return;
      startBuiltin('waiting', { t: '대기 음악', a: '웜 앰비언트 패드' });
      ensureYT();
      return;
    }
    const list = shuffle(tracksFor('wait'));
    if (!list.length) { startBuiltin('waiting'); return; }
    yt.queue = list; yt.qi = 0; yt.currentKey = 'wait';
    ytPlayTrack(list[0]);
    renderNext();
  }
  /* 대기 음악을 갑자기 끊지 않고, 수업 첫 구간이 페이드 인하는 동안 겹치며 줄입니다 */
  function endAmbientSoft() {
    state.ambientOn = false;
    $('#ambientBtn').setAttribute('aria-pressed', 'false');
    $('#ambientBtnLabel').textContent = '대기 음악 켜기';
    if (yt.player && ytAudible()) {
      ytFadeTo(0, FADE);
      setTimeout(() => { try { yt.player.stopVideo(); } catch (e) {} }, FADE + 250);
    } else if (yt.player) {
      setTimeout(() => { try { yt.player.stopVideo(); } catch (e) {} }, 300);
    }
    if (audio && audio.playing) audio.stop(FADE / 1000);
    yt.queue = [];
  }

  function stopAmbient(fadeMs) {
    state.ambientOn = false;
    $('#ambientBtn').setAttribute('aria-pressed', 'false');
    $('#ambientBtnLabel').textContent = '대기 음악 켜기';
    $('#footStatus').textContent = '대기 중';
    if (yt.player && ytAudible()) {
      ytFadeTo(0, fadeMs || FADE);
      setTimeout(() => { try { if (yt.player) yt.player.stopVideo(); } catch (e) {} }, (fadeMs || FADE) + 250);
    } else if (yt.player) {
      setTimeout(() => { try { if (yt.player) yt.player.stopVideo(); } catch (e) {} }, 300);
    }
    stopBuiltin(fadeMs ? fadeMs / 1000 : undefined);
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
    $('#idleSavaValue').textContent = state.pool === 'random'
      ? '오늘의 랜덤 추천 · 감성곡 + 힐링곡' : SAVA_POOLS[state.pool].name;
    $('#themePillLabel').textContent = FLOW_THEMES[state.theme].short;
  }

  function renderSegments() {
    const wrap = $('#segments');
    wrap.innerHTML = plan.map((s) => `<i style="flex-grow:${s.min}"></i>`).join('');
  }

  function updateSegments(idx) {
    $$('#segments i').forEach((el, i) => {
      el.classList.toggle('done', i < idx);
      el.classList.toggle('active', i === idx);
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
      desc = state.pool === 'random'
        ? '감성곡 + 가사 없는 힐링곡이 번갈아 흐릅니다'
        : SAVA_POOLS[state.pool].name;
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
    const total = planTotalMs();
    showScreen('done');
    if (bodyscanOn) setBodyscan(false, { quiet: true, skipResume: true });
    if (yt.player) ytFadeTo(0, 1800);
    setTimeout(() => { try { if (yt.player) yt.player.stopVideo(); } catch (e) {} }, 1900);
    stopBuiltin();
    releaseWake();
    if (state.chime) setTimeout(() => chime(), 300);
    $('#doneStats').innerHTML =
      `<div><b>${Math.round(total / 60000)}분</b><span>수업 시간</span></div>
       <div><b>${plan.length}</b><span>구간</span></div>
       <div><b>${FLOW_THEMES[state.theme].short}</b><span>플로우 테마</span></div>`;
    $('#doneSummary').textContent = '60분의 흐름이 마무리되었습니다. 대기 음악으로 이어집니다.';
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
        startBuiltin('bodyscan', { t: '바디스캔 명상', a: '가사 없는 낮은 드론 · 숨결' });
      } else if (yt.playingBuiltin || state.sourceMode === 'builtin' || !yt.ready) {
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
      startBuiltin('bodyscan', { t: '바디스캔 명상', a: '가사 없는 낮은 드론 · 숨결' });
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
    $$('#bridgePicker button').forEach((b) => {
      b.classList.toggle('is-on', Number(b.dataset.min) === state.bridge);
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
    const slots = [
      ['opening', '오프닝'], ['bridge', '피아노 브릿지'],
      ['flow:classic', '플로우 · 클래식'], ['flow:neoclassic', '플로우 · 네오클래식'],
      ['flow:mantra', '플로우 · 만트라'], ['flow:christmas', '플로우 · 캐럴'],
      ['cooldown', '컴다운'], ['savasana:song', '사바아사나 · 감성곡'],
      ['savasana:piano', '사바아사나 · 건반'], ['savasana:bowl', '사바아사나 · 싱잉볼'],
      ['savasana:vocal', '사바아사나 · 만트라'], ['savasana:bodyscan', '사바아사나 · 바디스캔'],
      ['savasana:nature', '사바아사나 · 자연음'],
      ['savasana:harp', '사바아사나 · 하프'], ['savasana:christmas', '사바아사나 · 캐럴'],
      ['closing', '마무리'], ['wait', '대기 음악']
    ];
    $('#addSlot').innerHTML = slots.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
    renderCustomList();
  }

  function renderCustomList() {
    const wrap = $('#customList');
    const keys = Object.keys(state.custom || {}).filter((k) => (state.custom[k] || []).length);
    if (!keys.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = keys.map((k) =>
      state.custom[k].map((c, i) =>
        `<div class="custom-row"><span>${escapeHtml(c.t || c.y)} · ${k}</span>
         <button type="button" data-key="${k}" data-i="${i}">삭제</button></div>`
      ).join('')
    ).join('');
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

  function addCustomTrack() {
    const id = parseYtId($('#addUrl').value);
    const slot = $('#addSlot').value;
    const title = $('#addTitle').value.trim();
    if (!id) { toast('유튜브 주소를 확인해 주세요.'); return; }
    state.custom[slot] = state.custom[slot] || [];
    if (state.custom[slot].some((c) => c.y === id)) { toast('이미 추가된 곡입니다.'); return; }
    state.custom[slot].push({ y: id, t: title || '직접 추가한 곡' });
    savePrefs();
    renderCustomList();
    $('#addUrl').value = ''; $('#addTitle').value = '';
    toast('추가했습니다. 해당 구간에서 재생됩니다.');
    if (mode === 'class' && plan[activeIndex] && keyForSection(plan[activeIndex]) === slot) {
      playSection(activeIndex);
    }
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
    const jump = (delta) => {
      if (mode !== 'class') return;
      const idx = clamp(currentIndex(Date.now()) + delta, 0, plan.length - 1);
      const base = pausedAt || Date.now();
      startedAt = base - boundaries()[idx] - pausedTotal;
      enterSection(idx);
      tick();
    };
    $('#nextBtn').addEventListener('click', () => jump(1));
    $('#prevBtn').addEventListener('click', () => jump(-1));
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
      if (yt.player) yt.player.setVolume(state.volume);
      if (audio) audio.setVolume(state.volume / 100);
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
    $('#bridgePicker').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.bridge = Number(b.dataset.min); savePrefs();
      renderThemeSheet(); renderIdlePlan();
      if (mode === 'class') toast('브릿지 길이는 다음 수업부터 적용됩니다.');
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
    $('#addBtn').addEventListener('click', addCustomTrack);
    $('#customList').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-key]');
      if (!b) return;
      const k = b.dataset.key, i = Number(b.dataset.i);
      state.custom[k].splice(i, 1);
      if (!state.custom[k].length) delete state.custom[k];
      savePrefs(); renderCustomList();
      toast('삭제했습니다.');
    });
    $('#resetBtn').addEventListener('click', () => {
      state.custom = {}; savePrefs(); renderCustomList(); toast('저장된 곡을 초기화했습니다.');
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
    state, buildPlan,
    get plan() { return plan; },
    get yt() { return yt; },
    get audio() { return audio; }
  };
})();
