#!/usr/bin/env python3
"""Builds the embed-verification harness with an inline candidate list."""
import json, sys

ids = json.load(open(sys.argv[1]))  # {cat: [{id,title}]}
items = []
for cat, rows in ids.items():
    for r in rows:
        items.append({"id": r["id"], "label": r.get("title", ""), "cat": cat})

html = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>YouTube 임베드 검증</title>
<style>
body{font:13px/1.5 -apple-system,system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:18px}
h1{font-size:16px;font-weight:600;margin:0 0 6px}
p{color:#8b8b8b;margin:0 0 14px}
#wrap{max-width:900px}
table{border-collapse:collapse;width:100%;font-size:12px}
td,th{border-bottom:1px solid #262626;padding:5px 6px;text-align:left;vertical-align:top}
.ok{color:#6ee7a0}.bad{color:#ff7a7a}.wait{color:#c9c9c9}
#player{position:fixed;right:8px;bottom:8px;width:200px;height:113px;opacity:.25;pointer-events:none}
#sum{margin:10px 0;color:#bbb}
</style></head><body>
<div id="wrap">
<h1>YouTube 임베드 재생 검증</h1>
<p>실제 IFrame 플레이어로 음소거 재생하여 Error 101/150/2/5 여부를 확인합니다. 순차 진행.</p>
<div id="sum">대기 중…</div>
<table><thead><tr><th>#</th><th>구간</th><th>Video ID</th><th>제목</th><th>결과</th><th>초</th></tr></thead><tbody id="tb"></tbody></table>
</div>
<div id="player"></div>
<textarea id="out" style="width:100%;height:80px;margin-top:12px;background:#1b1b1b;color:#ddd;border:1px solid #333"></textarea>
<script>
const ITEMS = __ITEMS__;
window.__results = [];
let player = null, idx = 0, timer = null, startAt = 0, currentId = null;

function rowFor(i, it){
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${i+1}</td><td>${it.cat}</td><td>${it.id}</td><td>${(it.label||'').slice(0,58)}</td><td class="wait">·</td><td>0</td>`;
  document.getElementById('tb').appendChild(tr);
  return tr;
}
const rows = ITEMS.map((it,i)=>rowFor(i,it));

function loadApi(){
  const s=document.createElement('script'); s.src='https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
  window.onYouTubeIframeAPIReady = boot;
}
function boot(){
  player = new YT.Player('player', {
    height:'113', width:'200', videoId: ITEMS[0].id,
    playerVars:{autoplay:0, controls:0, disablekb:1, modestbranding:1, playsinline:1, origin:location.origin},
    events:{
      onReady: ()=>{ player.mute(); next(0); },
      onError: (e)=>{ finish(false, 'error '+e.data); },
      onStateChange: (e)=>{
        if(e.data === 1){ /* playing */ }
        if(e.data === 0){ /* ended */ }
      }
    }
  });
}
function next(i){
  if(i >= ITEMS.length){ done(); return; }
  idx = i; currentId = ITEMS[i].id;
  startAt = Date.now();
  rows[i].cells[4].textContent = '재생 중…'; rows[i].cells[4].className = 'wait';
  window.__current = currentId;
  player.loadVideoById({videoId: currentId, startSeconds: 0});
  clearInterval(timer);
  timer = setInterval(()=>{
    const ms = Date.now() - startAt;
    rows[i].cells[5].textContent = (ms/1000).toFixed(1);
    let st = -1, t = 0;
    try { st = player.getPlayerState(); t = player.getCurrentTime(); } catch(e){}
    if(st === 1 && t > 0.4) finish(true, 'playing '+t.toFixed(1)+'s');
    else if(ms > 9000) finish(false, 'timeout state='+st);
  }, 250);
}
function finish(ok, note){
  clearInterval(timer);
  const secs = (Date.now() - startAt)/1000;
  const it = ITEMS[idx];
  rows[idx].cells[4].textContent = (ok?'OK':'FAIL')+' · '+note;
  rows[idx].cells[4].className = ok ? 'ok' : 'bad';
  rows[idx].cells[5].textContent = secs.toFixed(1);
  window.__results.push({id: it.id, cat: it.cat, title: it.label, ok, note, secs:+secs.toFixed(1)});
  const okc = window.__results.filter(r=>r.ok).length;
  document.getElementById('sum').textContent = `${window.__results.length}/${ITEMS.length} 검사 · OK ${okc} · FAIL ${window.__results.length-okc}`;
  document.getElementById('out').value = JSON.stringify(window.__results);
  setTimeout(()=>{ try{ player.stopVideo(); }catch(e){} next(idx+1); }, 350);
}
function done(){
  document.getElementById('sum').textContent += ' — 완료';
  window.__done = true;
  document.title = 'DONE';
}
loadApi();
</script></body></html>
"""
html = html.replace("__ITEMS__", json.dumps(items, ensure_ascii=False))
open(sys.argv[2], "w").write(html)
print("wrote", sys.argv[2], len(items), "items")
