#!/usr/bin/env python3
"""현재 수록곡의 실제 메타데이터(채널·길이·임베드 가능 여부·음질)를 모읍니다."""
import json, os, re, sys, time
import yt_dlp

src = open('assets/js/data.js').read()
rows = re.findall(r"\{\s*t:\s*(['\"])(.*?)\1,\s*a:\s*(['\"])(.*?)\3,\s*y:\s*(['\"])([\w-]{11})\5\s*\}", src, re.S)
items = [{"t": t, "a": a, "y": y} for t, a, y in [(m[1], m[3], m[5]) for m in rows]]
ids = []
for it in items:
    if it['y'] not in [i['y'] for i in ids]:
        ids.append({"t": it['t'], "a": it['a'], "y": it['y']})

out_path = 'tools/audit_current.json'
cache = json.load(open(out_path)) if os.path.exists(out_path) else {}

opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True, "socket_timeout": 15}

t0 = time.time()
for it in ids:
    vid = it['y']
    if vid in cache and cache[vid].get('duration'):
        continue
    if time.time() - t0 > 250:
        break
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            d = ydl.extract_info("https://www.youtube.com/watch?v=" + vid, download=False)
        fmts = d.get("formats") or []
        abrs = [f.get("abr") for f in fmts if f.get("abr")]
        cache[vid] = {
            "id": vid, "title": d.get("title"), "channel": d.get("channel") or d.get("uploader"),
            "duration": d.get("duration"), "playable_in_embed": d.get("playable_in_embed"),
            "max_abr": max(abrs) if abrs else None,
            "artist": d.get("artist"), "track": d.get("track"),
            "channel_is_verified": d.get("channel_is_verified"),
            "view_count": d.get("view_count"),
        }
    except Exception as e:
        cache[vid] = {"id": vid, "error": str(e)[:160]}
    json.dump(cache, open(out_path, "w"), ensure_ascii=False, indent=1)
    m = cache[vid]
    print(vid, it['a'][:20], '|', (m.get('title') or m.get('error') or '')[:55], '|',
          m.get('duration'), '|', (m.get('channel') or '')[:28], '|', m.get('playable_in_embed'), '|', m.get('max_abr'), flush=True)
print('done', len(cache), 'of', len(ids))
