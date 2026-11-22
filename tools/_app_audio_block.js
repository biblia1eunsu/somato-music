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
      waited += 500;
      let dur = 0, st = -1, vid = '';
      try {
        dur = yt.player.getDuration() || 0;
        st = yt.player.getPlayerState();
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
      if (dur >= 100 && (st === 1 || st === 3)) {
        /* 본 영상이 실제로 흐르기 시작한 순간에만 소리를 냅니다 */
        setBadge('youtube');
        try { yt.player.unMute(); } catch (e) {}
        ytFadeTo(outVolume(), 1600);
        clearInterval(yt.adTimer); yt.adTimer = null;
        clearTimeout(yt.watchdog); yt.watchdog = null;
      } else if (waited > 120000) {
        /* 2분이 지나도 길이를 알려주지 않는 경우 — 더 기다리면 무음이 길어집니다 */
        setBadge('youtube');
        try { yt.player.unMute(); } catch (e) {}
        ytFadeTo(outVolume(), 1200);
        clearInterval(yt.adTimer); yt.adTimer = null;
      }
    }, 500);
  }

  /* 재생이 실제로 시작되지 않았을 때만 다시 시도하고, 두 번째에도 안 되면
     유튜브를 완전히 멈춘 뒤 내장 사운드로 넘어갑니다. */
  function armWatchdog(ms) {
    clearTimeout(yt.watchdog);
    yt.watchdog = setTimeout(() => {
      yt.watchdog = null;
      if (owner !== 'youtube' || !yt.player) return;
      let st = -1;
      try { st = yt.player.getPlayerState(); } catch (e) { return; }
      if (st === 1 || st === 3) return;         // 재생·버퍼링 중이면 기다립니다 (광고 포함)
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
    renderNow(track);
    setBadge('youtube');
    $('#nowCard').classList.add('is-playing');

    const doLoad = () => {
      if (owner !== 'youtube' || !yt.player) return;
      try { yt.player.mute(); yt.player.setVolume(0); } catch (e) {}
      yt.volume = 0;
      try {
        yt.player.loadVideoById({ videoId: track.y, startSeconds: 0 });
      } catch (e) {
        fallbackToBuiltin('유튜브를 불러오지 못해 내장 사운드로 이어갑니다.');
        return;
      }
      yt.playTimer = setTimeout(() => { try { yt.player.playVideo(); } catch (e) {} }, 380);
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

  /* 대기 음악 첫 곡은 늘 같습니다 (맑은 피아노 한 곡으로 시작) — 그 뒤만 섞습니다 */
  function waitList() {
    const base = tracksFor('wait');
    if (!base.length) return [];
    return [base[0]].concat(shuffle(base.slice(1)));
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
