#!/usr/bin/env python3
"""실패·대체 후보만 다시 검사하는 verify6.html 을 만듭니다."""
import json

items = json.load(open('tools/retry_ids.json'))
tpl = open('tools/verify5.html').read()
import re
tpl = re.sub(r"const ITEMS = \[.*?\];", lambda m: "const ITEMS = " + json.dumps(items, ensure_ascii=False) + ";", tpl, count=1, flags=re.S)
tpl = tpl.replace("YouTube 임베드 검증 v5", "YouTube 임베드 검증 v6")
open('tools/verify6.html', 'w').write(tpl)
print('tools/verify6.html', len(items), 'items')
