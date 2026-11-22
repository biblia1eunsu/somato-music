#!/usr/bin/env python3
"""Builds tools/verify4.html — 최종 선곡안 전체를 실제 IFrame 플레이어로 재생 검사합니다."""
import json, sys

src = json.load(open('tools/final_tracks.json'))
items = []


def walk(o, path):
    for k, v in o.items():
        if isinstance(v, list):
            for t in v:
                items.append({"id": t["y"], "label": t["t"] + " · " + t["a"], "cat": path + k})
        else:
            walk(v, path + k + "/")


walk(src, "")
seen = set()
uniq = []
for it in items:
    if it["id"] in seen:
        continue
    seen.add(it["id"])
    uniq.append(it)
items = uniq

tpl = open('tools/verify3.html').read()
const = "const ITEMS = " + json.dumps(items, ensure_ascii=False) + ";"
import re
tpl = re.sub(r"const ITEMS = \[.*?\];", lambda m: const, tpl, count=1, flags=re.S)
tpl = tpl.replace("YouTube 임베드 재생 검증 v3", "YouTube 임베드 재생 검증 v4")
open('tools/verify4.html', 'w').write(tpl)
print('tools/verify4.html', len(items), 'items')
