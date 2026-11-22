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
    random: { name: '오늘의 랜덤 추천', short: '랜덤', texture: 'sava-bowl' },
    bowl: { name: '싱잉볼 · 명상', short: '싱잉볼', texture: 'sava-bowl' },
    vocal: { name: '보컬 힐링', short: '보컬', texture: 'sava-vocal' },
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
    if (sec.id === 'savasana') return 'savasana:' + (state.pool === 'random' ? todayPool() : state.pool);
    return sec.id;
  }
  function todayPool() {
    const pools = ['bowl', 'vocal', 'nature', 'harp', 'christmas'];
    const d = new Date();
    const seed = d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
    return pools[seed % pools.length];
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
            if (e.data === 0) nextTrack();
          },
          onError: (e) => {
            const code = e.data;
            if (code === 2 || code === 5 || code === 100 || code === 101 || code === 150) {
              yt.errors++;
              const cur = yt.queue[yt.qi];
              if (cur) cur.failed = true;
              if (yt.errors >= 2) fallbackToBuiltin('유튜브 재생이 제한되어 내장 사운드로 이어갑니다.');
              else nextTrack(true);
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
    const steps = Math.max(1, Math.round(ms / 60));
    let i = 0;
    yt.fadeTimer = setInterval(() => {
      i++;
      const v = from + (target - from) * (i / steps);
      yt.volume = v;
      try { yt.player.setVolume(clamp(v, 0, 100)); } catch (e) {}
      if (i >= steps) clearInterval(yt.fadeTimer);
    }, 60);
  }

  function clearWatchdog() { clearTimeout(yt.watchdog); yt.watchdog = null; }

  function ytPlayTrack(track) {
    if (!track || !track.y || !yt.player || !yt.ready) return false;
    yt.playingBuiltin = false;
    stopBuiltin();
    ytFadeTo(0, 900);
    clearWatchdog();
    yt.watchdog = setTimeout(() => {
      try {
        const st = yt.player.getPlayerState();
        if (st !== 1 && st !== 3) { yt.errors++; nextTrack(true); }
      } catch (e) {}
    }, 11000);
    try {
      yt.player.loadVideoById({ videoId: track.y, startSeconds: 0 });
      setTimeout(() => {
        try { yt.player.setVolume(0); yt.player.playVideo(); } catch (e) {}
        ytFadeTo(state.volume, 1500);
      }, 380);
    } catch (e) { return false; }
    renderNow(track);
    $('#sourceBadge').textContent = 'YouTube';
    $('#sourceBadge').classList.remove('is-builtin');
    $('#nowCard').classList.add('is-playing');
    return true;
  }

  function startBuiltin(texture, label) {
    const eng = ensureAudio();
    yt.playingBuiltin = true;
    if (yt.player) ytFadeTo(0, 700);
    eng.start(texture, { firstBowl: false });
    $('#sourceBadge').textContent = '내장 사운드';
    $('#sourceBadge').classList.add('is-builtin');
    $('#nowCard').classList.add('is-playing');
    renderBuiltin(label || builtinLabel(texture));
  }
  function stopBuiltin() {
    if (audio && audio.playing) audio.stop(1.2);
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
  }

  function renderNow(track) {
    if (!track) return;
    $('#nowTitle').textContent = track.t || '—';
    $('#nowArtist').textContent = track.a || '—';
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
    startBuiltin(sec.texture || 'waiting');
    if (msg) toast(msg);
    $('#footStatus').textContent = '내장 사운드 재생 중';
  }

  function nextTrack(auto) {
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
      startBuiltin(sec.texture || 'waiting');
      return;
    }
    ytPlayTrack(cur);
    renderNext();
  }
  function prevTrack() {
    if (yt.queue.length === 0) return;
    yt.qi = (yt.qi - 1 + yt.queue.length) % yt.queue.length;
    const cur = yt.queue[yt.qi];
    if (state.sourceMode === 'builtin' || !yt.ready) {
      const sec = plan[activeIndex] || {};
      startBuiltin(sec.texture || 'waiting');
      return;
    }
    ytPlayTrack(cur);
  }

  function playPool(key, opts) {
    yt.currentKey = key;
    yt.queue = shuffle(tracksFor(key));
    yt.qi = 0;
    yt.errors = 0;

    if (yt.queue.length === 0) {
      const sec = plan[activeIndex] || {};
      startBuiltin((sec && sec.texture) || 'waiting');
      return;
    }
    if (state.sourceMode === 'builtin') {
      const sec = plan[activeIndex] || {};
      startBuiltin(sec.texture || 'waiting');
      renderNext();
      return;
    }
    if (!yt.ready) {
      const sec = plan[activeIndex] || {};
      startBuiltin(sec.texture || 'waiting');
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
  function stopAmbient() {
    state.ambientOn = false;
    $('#ambientBtn').setAttribute('aria-pressed', 'false');
    $('#ambientBtnLabel').textContent = '대기 음악 켜기';
    $('#footStatus').textContent = '대기 중';
    if (yt.player) ytFadeTo(0, 700);
    setTimeout(() => { try { if (yt.player) yt.player.stopVideo(); } catch (e) {} }, 800);
    stopBuiltin();
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

  function renderIdleChoices() {
    $('#idleThemeValue').textContent = FLOW_THEMES[state.theme].name;
    $('#idleSavaValue').textContent = state.pool === 'random'
      ? '오늘의 랜덤 추천' : SAVA_POOLS[state.pool].name;
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
    if (idx < 0 || idx >= plan.length) return;
    const sec = plan[idx];
    activeIndex = idx;

    $('#sectionEn').textContent = sec.en;
    $('#sectionKo').textContent = sec.name;
    let desc = sec.desc;
    if (sec.id === 'flow') desc = FLOW_THEMES[state.theme].desc;
    if (sec.id === 'savasana') {
      desc = (state.pool === 'random' ? '오늘의 랜덤 추천 · ' : '') +
        SAVA_POOLS[state.pool === 'random' ? todayPool() : state.pool].name;
    }
    $('#sectionDesc').textContent = desc;
    updateSegments(idx);
    $('#savaPanel').hidden = sec.id !== 'savasana';
    if (sec.id === 'savasana') renderSavaChips();

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
    if (state.ambientOn) stopAmbient();
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
      if (yt.playingBuiltin || state.sourceMode === 'builtin' || !yt.ready) {
        const sec = plan[activeIndex];
        startBuiltin(sec.texture);
      } else if (yt.player) {
        try { yt.player.playVideo(); } catch (e) {}
      }
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
      ['cooldown', '컴다운'], ['savasana:bowl', '사바아사나 · 싱잉볼'],
      ['savasana:vocal', '사바아사나 · 보컬'], ['savasana:nature', '사바아사나 · 자연음'],
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

    $('#idleThemeChip').addEventListener('click', () => { renderThemeSheet(); openSheet('sheetTheme'); });
    $('#idleSavaChip').addEventListener('click', () => { renderThemeSheet(); openSheet('sheetTheme'); });

    $('#themeList').addEventListener('click', (e) => {
      const b = e.target.closest('.theme-item');
      if (!b) return;
      state.theme = b.dataset.theme; savePrefs();
      renderThemeSheet(); renderIdleChoices();
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

    $('#sourceSelect').addEventListener('change', (e) => {
      state.sourceMode = e.target.value; savePrefs();
      if (mode === 'class') playSection(activeIndex);
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
      if (document.visibilityState === 'visible' && mode === 'class' && state.wake) requestWake();
    });
    window.addEventListener('beforeunload', () => { savePrefs(); });
  }

  /* ── 시작 ───────────────────────────────────── */
  function init() {
    loadPrefs();
    applyTheme();
    plan = buildPlan();
    renderIdlePlan();
    renderIdleChoices();
    renderSettings();
    $('#volume').value = state.volume;
    $('#chimePill').setAttribute('aria-pressed', String(!!state.chime));
    $('#wakePill').setAttribute('aria-pressed', String(!!state.wake));
    bind();
    ensureYT();
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
    if (DATA.version) $('#versionLine').textContent = 'somato-music · v' + DATA.version;
  }

  document.addEventListener('DOMContentLoaded', init);
  window.__somato = { state, buildPlan, get plan() { return plan; } };
})();
