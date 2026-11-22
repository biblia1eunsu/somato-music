#!/usr/bin/env python3
"""Builds a self-contained YouTube IFrame embed verification page (verify3.html).
   광고(ad)로 인한 일시적 타임아웃을 구분하고, 실패 항목은 한 번 더 재시도합니다."""
import json, sys

src = sys.argv[1]
out_path = sys.argv[2] if len(sys.argv) > 2 else 'verify3.html'
items = []
for cat, rows in json.load(open(src)).items():
    for r in rows:
        items.append({"id": r["id"], "label": r.get("label", ""), "cat": cat})

html = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>YouTube 임베드 검증 v3</title>
<style>
body{font:13px/1.5 -apple-system,system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:14px}
h1{font-size:15px;font-weight:600;margin:0 0 6px}
p{color:#9b9b9b;margin:0 0 12px}
table{border-collapse:collapse;width:100%;font-size:12px}
td,th{border-bottom:1px solid #262626;padding:4px 6px;text-align:left;vertical-align:top}
.ok{color:#6ee7a0}.bad{color:#ff7a7a}.wait{color:#c9c9c9}.ad{color:#e8c777}
#player{position:fixed;right:6px;bottom:6px;width:180px;height:101px;opacity:.2;pointer-events:none}
#sum{margin:8px 0;color:#ccc;font-weight:600}
</style></head><body>
<h1>YouTube 임베드 재생 검증 v3</h1>
<p>실제 IFrame 플레이어로 음소거 재생해 Error 101/150/2/5 여부를 확인합니다. 광고가 나오면 기다립니다.</p>
<div id="sum">대기 중…</div>
<table><thead><tr><th>#</th><th>구간</th><th>ID</th><th>제목</th><th>결과</th><th>초</th></tr></thead><tbody id="tb"></tbody></table>
<div id="player"></div>
<script>
const ITEMS = __ITEMS__;
const TIMEOUT = 24000;
window.__results = [];
window.__done = false;
let player = null, idx = 0, timer = null, startAt = 0, retryQueue = [], retriesLeft = [];

function rowFor(i, it){
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${i+1}</td><td>${it.cat}</td><td>${it.id}</td><td>${(it.label||'').slice(0,46)}</td><td class="wait">·</td><td>0</td>`;
  document.getElementById('tb').appendChild(tr);
  return tr;
}
const rows = ITEMS.map((it,i)=>rowFor(i,it));

window.onYouTubeIframeAPIReady = function(){
  player = new YT.Player('player', {
    height:'101', width:'180', videoId: ITEMS[0].id,
    playerVars:{autoplay:0, controls:0, disablekb:1, modestbranding:1, playsinline:1, origin:location.origin},
    events:{
      onReady: ()=>{ try{player.mute();}catch(e){}; next(0); },
      onError: (e)=>{ finish(false, 'error '+e.data, false); },
      onStateChange: ()=>{}
    }
  });
};
function loadApi(){
  const s=document.createElement('script'); s.src='https://www.youtube.com/iframe_api';
  s.onerror = ()=>{ document.getElementById('sum').textContent = 'IFrame API 로드 실패'; };
  document.head.appendChild(s);
}
function show(sumId, i, txt, cls){
  const el = (sumId != null && sumId >= 0) ? rows[sumId] : null;
  if (el) { el.cells[4].textContent = txt; el.cells[4].className = cls; }
}
function next(i){
  if(i >= ITEMS.length){ done(); return; }
  idx = i;
  startAt = Date.now();
  show(i, i, '재생 중…', 'wait');
  try { player.loadVideoById({videoId: ITEMS[i].id, startSeconds: 0}); } catch(e){ finish(false,'load '+e); return; }
  clearInterval(timer);
  timer = setInterval(()=>{
    const ms = Date.now() - startAt;
    rows[i].cells[5].textContent = (ms/1000).toFixed(1);
    let st = -1, t = 0, dur = 0, data = null;
    try { st = player.getPlayerState(); t = player.getCurrentTime(); dur = player.getDuration(); data = player.getVideoData && player.getVideoData(); } catch(e){}
    const isAd = dur > 0 && dur < 100;
    if (isAd) show(i, i, '광고 대기…', 'ad');
    if(st === 1 && t > 0.5 && !isAd) finish(true, 'playing '+t.toFixed(1)+'s');
    else if(ms > TIMEOUT) finish(false, 'timeout state='+st+' dur='+Math.round(dur), isAd);
  }, 250);
}
function finish(ok, note, wasAd){
  if (rows[idx].cells[4].textContent.startsWith('OK') || rows[idx].cells[4].textContent.startsWith('FAIL')) return;
  clearInterval(timer);
  const secs = (Date.now() - startAt)/1000;
  const it = ITEMS[idx];
  let vtitle = '';
  try { vtitle = (player.getVideoData()||{}).title || ''; } catch(e){}
  rows[idx].cells[4].textContent = (ok?'OK':'FAIL')+' · '+note;
  rows[idx].cells[4].className = ok ? 'ok' : 'bad';
  rows[idx].cells[5].textContent = secs.toFixed(1);
  window.__results.push({id: it.id, cat: it.cat, label: it.label, ok, note, secs:+secs.toFixed(1), ad: !!wasAd, vtitle});
  if (!ok) retriesLeft.push({item: it, row: idx});
  const okc = window.__results.filter(r=>r.ok).length;
  const fails = window.__results.filter(r=>!r.ok).length;
  document.getElementById('sum').textContent = `${window.__results.length}/${ITEMS.length} · OK ${okc} · FAIL ${fails}`;
  setTimeout(()=>next(idx+1), 150);
}
function done(){
  if (retriesLeft.length && !window.__retried){
    window.__retried = true;
    document.getElementById('sum').textContent += ' · 실패 항목 재시도 중…';
    const q = retriesLeft.slice(); retriesLeft = [];
    window.__retryQ = q;
    retryNext(0);
    return;
  }
  window.__done = true;
  const okc = window.__results.filter(r=>r.ok).length;
  document.getElementById('sum').textContent = `완료 — ${ITEMS.length}개 중 OK ${okc} · FAIL ${ITEMS.length-okc}`;
}
function retryNext(k){
  const q = window.__retryQ || [];
  if (k >= q.length){ window.__done = true;
    const okc = window.__results.filter(r=>r.ok).length;
    document.getElementById('sum').textContent = `완료 — ${ITEMS.length}개 중 OK ${okc} · FAIL ${ITEMS.length-okc}`;
    return; }
  const entry = q[k];
  idx = entry.row;
  rows[idx].cells[4].textContent = '재시도…'; rows[idx].cells[4].className='wait';
  startAt = Date.now();
  try { player.loadVideoById({videoId: ITEMS[idx].id, startSeconds: 0}); } catch(e){}
  clearInterval(timer);
  timer = setInterval(()=>{
    const ms = Date.now() - startAt;
    let st=-1,t=0,dur=0;
    try { st=player.getPlayerState(); t=player.getCurrentTime(); dur=player.getDuration(); } catch(e){}
    const isAd = dur>0 && dur<100;
    if(isAd){ rows[idx].cells[4].textContent='광고 대기…'; rows[idx].cells[4].className='ad'; }
    if(st===1 && t>0.5 && !isAd){
      clearInterval(timer);
      const rec = window.__results.find(r=>r.id===ITEMS[idx].id);
      if (rec){ rec.ok=true; rec.note='retry playing '+t.toFixed(1)+'s'; }
      rows[idx].cells[4].textContent='OK · retry'; rows[idx].cells[4].className='ok';
      const okc = window.__results.filter(r=>r.ok).length;
      document.getElementById('sum').textContent = `재시도 중 · OK ${okc}/${ITEMS.length}`;
      setTimeout(()=>retryNext(k+1), 250);
    } else if (ms > TIMEOUT){
      clearInterval(timer);
      rows[idx].cells[4].textContent='FAIL · retry timeout'; rows[idx].cells[4].className='bad';
      setTimeout(()=>retryNext(k+1), 250);
    }
  }, 250);
}
loadApi();
</script>
</body></html>
"""

html = html.replace("__ITEMS__", json.dumps(items, ensure_ascii=False))
open(out_path, "w").write(html)
print(out_path, len(items), "items")
