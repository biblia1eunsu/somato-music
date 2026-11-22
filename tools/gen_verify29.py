#!/usr/bin/env python3
"""v29 검증 하네스 생성 — data.js 의 '상위 3~5곡'을 실제 IFrame 플레이어로 열어
   제목·길이·임베드 가능 여부를 확인합니다. (tools/verify29.html)"""
import json, re, subprocess, sys

src = open('assets/js/data.js', encoding='utf-8').read()

# data.js 를 그대로 읽어 파트별 목록으로 만듭니다 (window.SOMATO_DATA 를 흉내)
js = src + "\nconsole.log(JSON.stringify(window.SOMATO_DATA));"
try:
    out = subprocess.run(['node', '-e', js], capture_output=True, text=True)
except FileNotFoundError:
    out = None

# node 가 없으면 정규식으로 파트를 따라갑니다
sections = {}
order = []
cur = None
for line in src.splitlines():
    m = re.match(r"\s{4}([A-Za-z_]+):\s*([\[{])", line)
    if m:
        cur = m.group(1)
        if m.group(2) == '[':
            sections.setdefault(cur, [])
            if cur not in order: order.append(cur)
        continue
    m2 = re.match(r"\s{6}([A-Za-z_]+):\s*\[", line)
    if m2:
        cur_flow = None
        cur = m2.group(1)
        sections.setdefault(cur, [])
        if cur not in order: order.append(cur)
    for mm in re.finditer(r"\{\s*t:\s*(['\"])(.*?)\1,\s*a:\s*(['\"])(.*?)\3,\s*y:\s*(['\"])([\w-]{11})\5\s*\}", line):
        if cur:
            sections[cur].append({'t': mm.group(2), 'a': mm.group(4), 'y': mm.group(6)})

PICK = {
    'wait': 5, 'opening': 3, 'breath': 3,
    'soma': 3, 'mantra': 3, 'pop': 3, 'christmas': 3,
    'cooldown': 5,
    'song': 3, 'piano': 3, 'bowl': 3, 'vocal': 3, 'harp': 3,
}

items = []
for part, n in PICK.items():
    lst = sections.get(part, [])
    for i, t in enumerate(lst[:n]):
        items.append({'part': part, 'rank': i + 1, 't': t['t'], 'a': t['a'], 'id': t['y']})

# 중복 ID 는 한 번만 (같은 곡이 여러 파트에 있을 때)
seen = set(); uniq = []
for it in items:
    if it['id'] in seen: continue
    seen.add(it['id']); uniq.append(it)

tpl = open('tools/verify28.html', encoding='utf-8').read()
tpl = tpl.replace('ITEMS = [{"id": "M2SbH6tFLOs"', 'ITEMS = ' + json.dumps(uniq, ensure_ascii=False) + '; const _X = [{"id": "M2SbH6tFLOs"')
tpl = tpl.replace('YouTube 임베드 보충 검증 v28', 'YouTube 임베드·길이 재검증 v29')
tpl = tpl.replace('<title>YouTube 임베드 검증 v28</title>', '<title>YouTube 임베드·길이 재검증 v29</title>')
tpl = tpl.replace('const WORKERS = 5, LIMIT = 12000, LABEL = "v27";', 'const WORKERS = 6, LIMIT = 15000, LABEL = "v29";')
open('tools/verify29.html', 'w', encoding='utf-8').write(tpl)
print('items', len(uniq), '-> tools/verify29.html')
for it in uniq[:6]: print(' ', it['part'], it['rank'], it['t'])
