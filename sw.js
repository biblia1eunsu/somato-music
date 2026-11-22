/* 소마토센서리 요가 클래스 플레이어 — 앱 셸 서비스워커 (v29)

   v29의 약속 하나: 홈 화면 아이콘으로 열어도 **언제나 서버의 최신 파일**을 씁니다.
   · 설치할 때(install) 앱 셸 파일을 새로 받아 캐시에 넣습니다.
   · 모든 앱 파일(index.html · app.js · data.js · style.css)은 Network-First —
     먼저 서버에서 받아 오고, 인터넷이 없거나 4초 안에 응답이 없을 때만 캐시를 씁니다.
     (v28까지는 캐시를 먼저 보는 Cache-First 라서 예전 data.js 가 계속 남았습니다)
   · 새 워커가 설치되면 곧바로 활성화(skipWaiting)하고 화면에 알립니다. 앱은 그때
     한 번 새로고침해서 v29 화면으로 바꿉니다.
   버전을 올릴 때는 아래 VERSION 과 index.html 의 ?v= 값을 함께 바꿉니다. */
const VERSION = 'v29';
const REV = 'b';                     // 같은 버전 안에서 파일을 고쳤을 때 캐시를 새로 받습니다
const CACHE = 'somato-music-' + VERSION + REV;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/js/data.js',
  './assets/js/audio-engine.js',
  './assets/js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

const BASE = new URL('./', self.location.href).pathname;
const NET_TIMEOUT = 4000;            // 서버 응답이 이보다 늦으면 캐시로 넘어갑니다

function isShell(url) {
  const p = url.pathname;
  if (p === BASE || p === BASE + 'index.html') return true;
  return p.startsWith(BASE + 'assets/') || p.startsWith(BASE + 'icons/') || p === BASE + 'manifest.json';
}

/* ?v=29 같은 검색어가 붙어도 같은 파일로 봅니다 — 캐시가 버전마다 겹치지 않게 */
function cacheKey(req) {
  const url = new URL(req.url);
  return url.origin + url.pathname;
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* 한 파일이 404 라도 설치 자체가 실패하지 않게 합니다.
       (예전에는 addAll 이 하나만 실패해도 새 워커가 설치되지 않아 옛 캐시가 계속 살아 있었습니다) */
    await Promise.all(ASSETS.map((u) =>
      cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('somato-music-') && k !== CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
    const list = await self.clients.matchAll({ type: 'window' });
    list.forEach((c) => { try { c.postMessage({ type: 'somato-activated', version: VERSION }); } catch (err) {} });
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // 유튜브 등 외부 요청은 그대로 통과
  if (!isShell(url)) return;                       // 앱 셸 외 경로는 브라우저에 맡깁니다
  e.respondWith(networkFirst(req));
});

/* Network-First — 서버 파일을 먼저 받고, 실패·지연일 때만 캐시 */
async function networkFirst(req) {
  const key = cacheKey(req);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT);
  try {
    const res = await fetch(req, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(key, copy)).catch(() => {});
    }
    return res;
  } catch (err) {
    clearTimeout(timer);
    const hit = await caches.match(key) || await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const idx = await caches.match(BASE + 'index.html') || await caches.match('./index.html');
      if (idx) return idx;
    }
    return new Response('오프라인 상태입니다. 인터넷이 연결되면 새로고침해 주세요.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
