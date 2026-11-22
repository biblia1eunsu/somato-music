/* 소마토센서리 요가 클래스 플레이어 — 오프라인 앱 셸
   버전을 올릴 때 아래 CACHE 이름과 index.html 의 ?v= 값을 함께 바꿉니다. */
const VERSION = 'v28';
const REV = 'a';                       // 같은 버전 안에서 파일을 고쳤을 때 캐시를 새로 받습니다
const CACHE = 'somato-music-' + VERSION + REV;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css?v=' + VERSION.replace('v', '') + REV,
  './assets/js/data.js?v=' + VERSION.replace('v', '') + REV,
  './assets/js/audio-engine.js?v=' + VERSION.replace('v', '') + REV,
  './assets/js/app.js?v=' + VERSION.replace('v', '') + REV,
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

const BASE = new URL('./', self.location.href).pathname;

function isShell(url) {
  const p = url.pathname;
  if (p === BASE || p === BASE + 'index.html') return true;
  return p.startsWith(BASE + 'assets/') || p.startsWith(BASE + 'icons/') || p === BASE + 'manifest.json';
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('somato-music-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // 유튜브 등 외부 요청은 그대로 통과
  if (!isShell(url)) return;                        // 앱 셸 외 경로는 브라우저에 맡깁니다

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
