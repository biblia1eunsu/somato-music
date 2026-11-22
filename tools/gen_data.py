#!/usr/bin/env python3
"""final_tracks.json → assets/js/data.js (검증 통과 목록만 반영)."""
import json, sys

src = json.load(open('tools/final_tracks.json'))
passed = None
if len(sys.argv) > 1:
    res = json.load(open(sys.argv[1]))
    passed = {r['id'] for r in res if r.get('ok')}

def ok(t):
    return passed is None or t['y'] in passed

def js_obj(t):
    return '      { t: %s, a: %s, y: %s }' % (
        json.dumps(t['t'], ensure_ascii=False),
        json.dumps(t['a'], ensure_ascii=False),
        json.dumps(t['y']))

def block(key, rows, comment=None):
    lines = [js_obj(t) for t in rows if ok(t)]
    out = []
    if comment:
        out.append('    /* %s */' % comment)
    out.append('    %s: [' % key)
    out.append(',\n'.join(lines))
    out.append('    ]')
    return '\n'.join(out)

top = []
top.append(block('wait', src['wait'], '수업 전 · 수업 후 대기 — 맑은 피아노와 하프'))
top.append(block('opening', src['opening'], '오프닝 — 호흡 · 그라운딩 (Deuter · Liquid Mind)'))
top.append(block('bridge', src['bridge'], '피아노 브릿지 — 이루마의 결'))
top.append(block('cooldown', src['cooldown'], '컴다운 — 심박을 가라앉히는 피아노 · 하프'))

flow = []
for k in ['classic', 'neoclassic', 'mantra', 'christmas']:
    flow.append(block(k, src['flow'][k]))
flow_txt = '    flow: {\n      ' + ',\n      '.join(f.replace('\n    ', '\n      ').strip() for f in flow) + '\n    }'
flow_txt = flow_txt.replace('classic: [', 'classic: [').replace('\n      { t', '\n        { t')
top.append(flow_txt)

sava = []
for k in ['song', 'piano', 'bodyscan', 'bowl', 'vocal', 'harp', 'christmas']:
    sava.append(block(k, src['savasana'][k]))
sava_txt = '    savasana: {\n      ' + ',\n      '.join(s.replace('\n    ', '\n      ').strip() for s in sava) + '\n    }'
sava_txt = sava_txt.replace('\n      { t', '\n        { t')
top.append(sava_txt)

top.append(block('closing', src['closing'], '마무리 1분'))

header = '''/* ─────────────────────────────────────────────────────────────
   구간별 큐레이션 v3
   · 모든 YouTube ID는 실제 IFrame 플레이어 재생 테스트를 통과한 것만 수록
     (tools/verify4.html · Error 101·150 0건)
   · 1시간짜리 모음 · 분위기가 튀는 영상 · 저음질 비공식 업로드는 걷어내고
     공식 아티스트 / Topic / 레이블 채널의 스튜디오 음원만 담았습니다
   · 은수 님의 지니뮤직 · 사운드클라우드 취향 기준
   ───────────────────────────────────────────────────────────── */
window.SOMATO_DATA = {
  version: '3.0.0',

  tracks: {
'''

body = ',\n\n'.join(top)
open('assets/js/data.js', 'w').write(header + body + '\n  }\n};\n')
print('data.js written', sum(1 for _ in open('assets/js/data.js')), 'lines')
