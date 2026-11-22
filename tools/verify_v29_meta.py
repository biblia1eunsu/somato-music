#!/usr/bin/env python3
"""v29 음원 재검증 — data.js 의 모든 곡을 YouTube oEmbed(공개 엔드포인트)로 확인합니다.
   영상이 없거나(404) 임베드가 막힌 곡은 error 로 남습니다. 길이는 브라우저 검증(tools/verify_v29_player.html)에서 잽니다."""
import json, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

SRC = 'assets/js/data.js'
OUT = 'tools/v29_meta.json'

src = open(SRC, encoding='utf-8').read()
rows = re.findall(r"\{\s*t:\s*(['\"])(.*?)\1,\s*a:\s*(['\"])(.*?)\3,\s*y:\s*(['\"])([\w-]{11})\5\s*\}", src, re.S)

# 파트(path)까지 같이 기록합니다
sections = []           # (path, title, artist, yt)
stack = []
cur_key = ''
path = []
for line in src.splitlines():
    m = re.match(r"\s*([A-Za-z_]+):\s*[\[{]", line)
    if m:
        key = m.group(1)
        if key in ('t', 'a', 'y', 'version', 'tracks'):
            pass
        else:
            cur_key = key
    m2 = re.match(r"\s*([A-Za-z_]+):\s*\[", line)
    if m2 and m2.group(1) not in ('t', 'a', 'y'):
        cur_key = m2.group(1)
    for mm in re.finditer(r"\{\s*t:\s*(['\"])(.*?)\1,\s*a:\s*(['\"])(.*?)\3,\s*y:\s*(['\"])([\w-]{11})\5\s*\}", line):
        sections.append((cur_key, mm.group(2), mm.group(4), mm.group(6)))

uniq = []
seen = set()
for sec, t, a, y in sections:
    if y in seen:
        continue
    seen.add(y)
    uniq.append({'sec': sec, 't': t, 'a': a, 'y': y})
print('tracks', len(sections), 'unique', len(uniq))

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'


def check(it):
    vid = it['y']
    url = 'https://www.youtube.com/oembed?url=' + urllib.parse.quote(
        'https://www.youtube.com/watch?v=' + vid, safe='') + '&format=json'
    out = dict(it)
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                d = json.load(r)
            out['yt_title'] = d.get('title')
            out['yt_author'] = d.get('author_name')
            out['ok'] = True
            return out
        except Exception as e:
            out['error'] = str(e)[:160]
            time.sleep(1.2 * (attempt + 1))
    out['ok'] = False
    return out


t0 = time.time()
with ThreadPoolExecutor(max_workers=8) as ex:
    res = list(ex.map(check, uniq))
print('elapsed', round(time.time() - t0, 1), 's')
json.dump(res, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = [r for r in res if not r.get('ok')]
print('ok', len(res) - len(bad), 'fail', len(bad))
for b in bad:
    print('FAIL', b['y'], b['t'], '|', b.get('error'))
