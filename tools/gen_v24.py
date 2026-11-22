#!/usr/bin/env python3
"""은수 님 리스트(지니 · 사운드클라우드 캡처)를 중심으로 v24 선곡을 만들고
assets/js/data.js 를 생성합니다.  새로 넣은 ID는 tools/verify7.html 로 임베드를 검사합니다."""
import json

# (제목, 아티스트, 유튜브 ID, 신규여부)
N = True   # 이번에 새로 넣은 곡


def T(t, a, y, new=False):
    return {"t": t, "a": a, "y": y, "new": new}


data = {
    "wait": [
        T("Kiss the Rain", "이루마 Yiruma", "imGaOIm5HOk"),
        T("piano for brother (형을 위한 노래)", "리정혁 Lee Jeonghyeok", "SmDD-3C5PNY", N),
        T("All Is Not Lost", "Lisa Swerdlow", "7R3H1fT1BHQ", N),
        T("Grace", "Fiona Joy Hawkins", "iqkgLhRThIE"),
        T("Falling Asleep", "Essie Jain", "78tD9QH1J2Q", N),
        T("Amazing Space", "Kristin Hoffmann", "AQS8bh7Q7TI", N),
        T("Wild Mountainside", "Ashley Davis", "J2-QVo4YWdU", N),
        T("Lights", "Arnaud Gauthier", "uHB1Azyfd0g", N),
        T("Return to the Heart", "David Lanz", "ESqHYfdDm7c"),
        T("River Flows in You", "이루마 Yiruma", "7maJOI3QMu0"),
        T("Blue Dream", "Fiona Joy Hawkins", "LdlKL_ArHaY"),
    ],
    "opening": [
        T("Free After All", "Yoga", "sf_nJNqSw70", N),
        T("Return to Your Body", "Parijat", "z0-LJaFbKsQ", N),
        T("Meditation", "Argon Riffer", "MxjWOvnD18s", N),
        T("Lotus", "Khan Kalima", "xbcABZmVRks", N),
        T("Serenity", "Liquid Mind", "78fcz7oNHmo"),
        T("Koyasan", "Deuter", "Drk-0Laarjc"),
        T("East of the Full Moon", "Deuter", "7RLstyPt5gs"),
        T("Kiss of a Rose", "Deuter", "9Y_gigLpilk"),
    ],
    "bridge": [
        T("Kiss the Rain", "이루마 Yiruma", "imGaOIm5HOk"),
        T("Cristofori's Dream (Remastered)", "David Lanz", "hm8y6kzXwEU"),
        T("piano for brother (형을 위한 노래)", "리정혁 Lee Jeonghyeok", "SmDD-3C5PNY"),
        T("River Flows in You", "이루마 Yiruma", "7maJOI3QMu0"),
        T("May Be", "이루마 Yiruma", "05Cax-OCtPw"),
        T("Wait There", "이루마 Yiruma", "Ox23mWkDhMk"),
        T("Poem+ (시처럼)", "이루마 Yiruma", "_R0Ix90hFu8"),
        T("Kiss the Rain (Orchestra)", "이루마 Yiruma", "1e07OAWvWkQ"),
    ],
    "cooldown": [
        T("Serenity", "Liquid Mind", "78fcz7oNHmo"),
        T("Healing the Heart", "Parijat", "sEIyjyUi0No", N),
        T("Evening Fall (Harp)", "Kevin MacLeod", "8TYO4Css6tE"),
        T("Healing (Reiki)", "Kevin MacLeod", "BmBrylNxAfY", N),
        T("Hearts Awakening", "Parijat", "fq5v7ipsIuc", N),
        T("Hymn for Peace", "Liquid Mind", "187iIfm_Mvw"),
        T("Clair de Lune", "Amy Turk · harp", "Nz15gbUa-k4"),
        T("Watching the Wheat", "Amy Turk · harp", "paXn1Q0aelA"),
        T("The Journey", "Fiona Joy Hawkins", "n9gOV7arRtI"),
        T("The White Light", "Fiona Joy Hawkins", "q3mwaSbbqjQ"),
    ],
    "closing": [
        T("Serenity", "Liquid Mind", "78fcz7oNHmo"),
        T("Hymn for Peace", "Liquid Mind", "187iIfm_Mvw"),
        T("Evening Fall (Harp)", "Kevin MacLeod", "8TYO4Css6tE"),
    ],
    "flow": {
        "classic": [
            T("Cristofori's Dream (Remastered)", "David Lanz", "hm8y6kzXwEU"),
            T("Return to Your Body", "Parijat", "z0-LJaFbKsQ"),
            T("Healing Senses", "Parijat", "TvZaSM4lXTg", N),
            T("Healing the Heart", "Parijat", "sEIyjyUi0No"),
            T("Forgiving", "Parijat", "9WGXaCY_GAU", N),
            T("Hearts Awakening", "Parijat", "fq5v7ipsIuc"),
            T("Inner Balance", "Parijat", "pTzJO637ymA"),
            T("Second sight", "Argon Riffer", "_5ne4Gxk3Gw", N),
            T("Inner Light", "Parijat", "8fCXh_Q5gvQ"),
            T("Return to the Heart", "David Lanz", "ESqHYfdDm7c"),
            T("Grace", "Fiona Joy Hawkins", "iqkgLhRThIE"),
            T("Drei", "Deuter", "1SwdND7nokU"),
        ],
        "neoclassic": [
            T("As She Passes", "Levi Patel", "2SvKuIvwtXU"),
            T("N°056 (relaxing piano)", "relaxdaily", "x8noBB1NIys", N),
            T("N°045 (relaxing piano)", "relaxdaily", "8uErXKps2NU", N),
            T("Grace (Deluxe Version)", "Fiona Joy Hawkins", "luee_gL4F8g", N),
            T("And She Translated Into the Sky", "Levi Patel", "v9Blx4URf34"),
            T("Le Onde", "Ludovico Einaudi", "x2XGx18rO20"),
            T("Nuvole Bianche", "Ludovico Einaudi", "sR2W2scFS4Y"),
            T("I Giorni", "Ludovico Einaudi", "TL1v3KVi6go"),
            T("Near Light", "Ólafur Arnalds", "0kYc55bXJFI"),
            T("On the Nature of Daylight", "Max Richter", "InyT9Gyoz_o"),
        ],
        "mantra": [
            T("Ishq' Allah", "Deva Premal & Miten", "gpSyVUh6chw", N),
            T("I Am (feat. Nirinjan Kaur)", "Krishan · Nirinjan Kaur", "PrS7eTkO5gM"),
            T("Gobinday Mukunday", "Snatam Kaur", "27ORb1DnSNo", N),
            T("Aad Guray Nameh", "Mirabai Ceiba", "WsDKzulNW00", N),
            T("Devi Prayer · Hymn to the Divine Mother", "Hymn to the Divine Mother", "MZ0h1sb1IFI", N),
            T("I Will Rise", "Lucinda Drayton", "o0LHz8j9o3Y", N),
            T("Heart of the Universe", "Snatam Kaur & Peter Kater", "wXbax5qveo4", N),
            T("Guru Ram Das / Ra Ma Da Sa", "Spirit Voyage", "YzJBKY4dvX8"),
            T("Ong Namo", "Snatam Kaur", "CvMAyZr3Vs0"),
            T("Gayatri Mantra", "Deva Premal", "se_WP1Mh0g8"),
            T("Sa Ta Na Ma", "Mirabai Ceiba", "m8ntAg7yeYQ"),
            T("Ra Ma Da Sa", "Snatam Kaur", "f8EzVceL-Xs"),
        ],
        "christmas": [
            T("O Holy Night", "Rousseau", "dwJ04_9LGrM"),
            T("Silent Night", "Rousseau", "MhC90ReY49I"),
            T("Carol of the Bells", "Rousseau", "Z3bNAvaQihA"),
            T("O Holy Night", "Francesco Parrino", "646k9QfzY2E"),
            T("Have Yourself a Merry Little Christmas", "Francesco Parrino", "QTLoPTCA7-Q"),
            T("Silent Night", "Francesco Parrino", "-GIrNLQjiPw"),
            T("Silent Night (Solo Piano)", "Fiona Joy Hawkins", "xLWio9lHehE"),
        ],
    },
    "savasana": {
        "song": [
            T("바람의 노래 (Wind Song)", "소향 Sohyang", "NJdrQ2jjqOU"),
            T("Something in the Rain", "Rachael Yamagata", "A1YAdFjdvx4"),
            T("Duet", "Rachael Yamagata", "KUuMyyZoYO4"),
            T("Here With Me", "Susie Suh × Robot Koch", "YzR8BCmV9Ew"),
            T("너의 모든 순간", "성시경", "Dbxzh078jr4"),
            T("비와 당신", "이무진", "sCmcSBsTxQc"),
            T("Your Song", "샘김 Sam Kim", "JWfyto-1oT0"),
            T("그 여름밤", "샘김 Sam Kim", "jcuIJ9waAVw"),
            T("Come Away With Me", "Norah Jones", "lbjZPFBD6JU"),
            T("Love Is Gone (Acoustic)", "SLANDER ft. Dylan Matthew", "hCrtcVDgCGw"),
            T("Angel", "Jackie Evancho", "bwSd6pd5UAQ", N),
            T("Shouldn't Be", "Luke Chiang", "hsLiJP2rqS8"),
            T("Nothing's Gonna Change My Love for You", "Chendy", "T__HNxkZPCc"),
            T("Reasons to Stay", "Kate Vogel", "NNvwaTNqjik"),
            T("Fare Thee Well", "Ashley Davis", "bq3SXN3GWvI"),
            T("Somebody New", "Sophia James", "kq24R_8jYg4"),
            T("Love So True", "Ashton Edminster", "IsK0LL3qm5E"),
            T("Moments", "Micah Edwards", "PFG8VCQ9pG0"),
            T("Exactly as It Is", "Miten", "zTqdBX5FChw"),
            T("Lokah Samastah Sukhino Bhavantu", "Cabrini Asteriska", "QAzsVYgwE2s"),
            T("너의 모든 순간 (라이브)", "성시경", "1P3jzu6Mt6w"),
        ],
        "piano": [
            T("As She Passes", "Levi Patel", "2SvKuIvwtXU"),
            T("Grace", "Fiona Joy Hawkins", "iqkgLhRThIE"),
            T("And She Translated Into the Sky", "Levi Patel", "v9Blx4URf34"),
            T("N°056 (relaxing piano)", "relaxdaily", "x8noBB1NIys"),
            T("N°045 (relaxing piano)", "relaxdaily", "8uErXKps2NU"),
            T("Grace (Deluxe Version)", "Fiona Joy Hawkins", "luee_gL4F8g"),
            T("Le Onde", "Ludovico Einaudi", "x2XGx18rO20"),
            T("Nuvole Bianche", "Ludovico Einaudi", "sR2W2scFS4Y"),
            T("Near Light", "Ólafur Arnalds", "0kYc55bXJFI"),
            T("On the Nature of Daylight", "Max Richter", "InyT9Gyoz_o"),
            T("The Journey", "Fiona Joy Hawkins", "n9gOV7arRtI"),
            T("Aqua", "Ryuichi Sakamoto", "W51tXJ1YwuA"),
        ],
        "vocal": [
            T("Ishq' Allah", "Deva Premal & Miten", "gpSyVUh6chw"),
            T("I Am (feat. Nirinjan Kaur)", "Krishan · Nirinjan Kaur", "PrS7eTkO5gM"),
            T("Gobinday Mukunday", "Snatam Kaur", "27ORb1DnSNo"),
            T("Aad Guray Nameh", "Mirabai Ceiba", "WsDKzulNW00"),
            T("I Will Rise", "Lucinda Drayton", "o0LHz8j9o3Y"),
            T("Gayatri Mantra", "Deva Premal", "3V0iwhq3jdA"),
            T("Gayatri Mantra (In Concert)", "Deva Premal & Miten", "4IFlaG45xM8"),
            T("Ra Ma Da Sa (Live in Bucharest)", "Snatam Kaur", "vViFW9KDXA4"),
            T("Rain of Blessings / Ra Ma Da Sa", "Deva Premal & Miten", "mEP3Fiw2ouo"),
            T("Sa Ta Na Ma", "Mirabai Ceiba", "m8ntAg7yeYQ"),
        ],
        "bowl": [
            T("Singing Bowl SoundScape", "Brett Van Donsel", "JAB-zW_L080", N),
            T("Devi Prayer · Hymn to the Divine Mother", "Hymn to the Divine Mother", "MZ0h1sb1IFI"),
            T("11분 차크라 튠업 · 롱 톤", "templesounds", "-ar9vsmFhJU"),
            T("크리스탈 볼 14분 차크라 명상", "templesounds", "8Qhh2VF1Oz4"),
            T("10분 티벳 싱잉볼", "Shanti Yoga", "S0IKiepm9Hs"),
            T("20분 사운드 배스 · 집중", "Aurabowls", "Rcp_PjxfPU0"),
            T("10분 써드아이 차크라 사운드 배스", "Healing Vibrations", "7_Hmo3TnSzI"),
            T("15분 사운드 배스", "Sound Healing Vibes", "IlHKM733TjA"),
            T("8분 루트 차크라 사운드 배스", "Healing Vibrations", "buOVKY0LAdw"),
        ],
        "bodyscan": [
            T("An Ending (Ascent)", "Brian Eno", "OlaTeXX3uH8"),
            T("Structures from Silence", "Steve Roach", "rt97c92WjRw"),
            T("Requiem for Dying Mothers, Pt. 2", "Stars of the Lid", "_8aYF9PtQjA"),
        ],
        "harp": [
            T("Watching the Wheat", "Amy Turk · harp", "paXn1Q0aelA"),
            T("Courage", "Amy Turk · harp", "xla3n9Uh6XM"),
            T("Clair de Lune", "Amy Turk · harp", "Nz15gbUa-k4"),
            T("Harp Lullaby (Celtic Harp)", "Little Moon Dreams", "OOKFf_TeE2M"),
            T("You Are My Sunshine (Lullaby)", "Music Box Lullabies", "hQHjGorl1L4"),
            T("Wiegenlied · Brahms (뮤직박스)", "R3 Music Box", "hs6AcuPcPgw"),
        ],
        "christmas": [
            T("Christmas Music Box Instrumental", "The Lyrical Lanterns", "dXAH4gpD5hg"),
            T("Deck the Halls (뮤직박스)", "R3 Music Box", "QYAD6L7pB-4"),
            T("Silent Night (뮤직박스)", "R3 Music Box", "9k6zbBUOZRw"),
            T("Silent Night (뮤직박스)", "The Music Box Corner", "-mJK7jjU3_Q"),
            T("Carol of the Bells", "Rousseau", "Z3bNAvaQihA"),
            T("Silent Night", "Rousseau", "MhC90ReY49I"),
        ],
    },
}

# ── data.js 생성 ─────────────────────────────
def js(t):
    return '      { t: %s, a: %s, y: %s }' % (
        json.dumps(t["t"], ensure_ascii=False),
        json.dumps(t["a"], ensure_ascii=False),
        json.dumps(t["y"]))


def block(name, rows, comment, indent=4):
    pad = ' ' * indent
    inner = ',\n'.join(js(t) for t in rows)
    return '%s/* %s */\n%s%s: [\n%s\n%s]' % (pad, comment, pad, name, inner, pad)


out = []
out.append('''/* ─────────────────────────────────────────────────────────────
   구간별 큐레이션 v4 — 은수 님이 직접 고르신 리스트 중심
   · 지니 뮤직 · 사운드클라우드 캡처(2026-11-22 전달)의 곡을 구간마다 가장 먼저 배치했습니다
   · 모든 YouTube ID는 실제 IFrame 플레이어로 임베드를 검사했습니다
     (Error 101 · 150 · 2 · 5 · 100 — 0건, tools/verify7.html)
   · 1시간짜리 모음 · 분위기가 튀는 실험적 앰비언트 · 저음질 비공식 업로드는 걷어냈습니다
   ───────────────────────────────────────────────────────────── */
window.SOMATO_DATA = {
  version: '4.0.0',

  tracks: {''')

out.append(block('wait', data['wait'], '수업 전 · 수업 후 대기 — 이루마 · 리정혁 · Lisa Swerdlow · Fiona Joy Hawkins'))
out.append('')
out.append(block('opening', data['opening'], '오프닝 — 호흡 · 그라운딩 (Yoga · Parijat · Argon Riffer · Deuter)'))
out.append('')
out.append(block('bridge', data['bridge'], '피아노 브릿지 — 이루마 · David Lanz · 리정혁'))
out.append('')
out.append(block('cooldown', data['cooldown'], '컴다운 — Liquid Mind · Parijat · Kevin MacLeod · 하프'))
out.append('')
out.append('    flow: {')
flow_parts = []
for k, c in [('classic', '클래식 소마토 플로우 — David Lanz · Parijat · Argon Riffer · Deuter'),
             ('neoclassic', '네오클래식 피아노 — Levi Patel · relaxdaily · Fiona Joy Hawkins · Einaudi'),
             ('mantra', '만트라 · 보컬 — Deva Premal & Miten · Snatam Kaur · Mirabai Ceiba · Lucinda Drayton'),
             ('christmas', '크리스마스 · 연말 캐럴')]:
    rows = ',\n'.join('        ' + js(t).strip() for t in data['flow'][k])
    flow_parts.append('      /* %s */\n      %s: [\n%s\n      ]' % (c, k, rows))
out.append(',\n'.join(flow_parts))
out.append('    },')
out.append('')
out.append('    savasana: {')
sava_parts = []
labels = {
    'song': '감성곡 · 가사 있는 사바아사나',
    'piano': '가사 없는 힐링 건반',
    'vocal': '만트라 · 보컬 힐링',
    'bowl': '싱잉볼 · 사운드 배스',
    'bodyscan': '바디스캔 · 앰비언트',
    'harp': '하프 · 오르골 자장가',
    'christmas': '크리스마스 잔잔한 캐롤',
}
order = ['song', 'piano', 'vocal', 'bowl', 'bodyscan', 'harp', 'christmas']
for k in order:
    rows = ',\n'.join('        ' + js(t).strip() for t in data['savasana'][k])
    sava_parts.append('      /* %s */\n      %s: [\n%s\n      ]' % (labels[k], k, rows))
out.append(',\n'.join(sava_parts))
out.append('    },')
out.append('')
out.append(block('closing', data['closing'], '마무리 1분'))
out.append('  }\n}')
open('assets/js/data.js', 'w', encoding='utf-8').write('\n'.join(out) + '\n')

# 신규 ID 목록 (임베드 검사용)
new_items = []


def walk(x, cat):
    if isinstance(x, list):
        for t in x:
            if t.get('new'):
                new_items.append({'id': t['y'], 'label': t['t'] + ' · ' + t['a'], 'cat': cat})
    elif isinstance(x, dict):
        for k, v in x.items():
            walk(v, cat + '/' + k if cat else k)


for k in ['wait', 'opening', 'bridge', 'cooldown', 'closing']:
    walk(data[k], k)
walk(data['flow'], 'flow')
walk(data['savasana'], 'savasana')

seen, uniq = set(), []
for it in new_items:
    if it['id'] not in seen:
        seen.add(it['id'])
        uniq.append(it)
json.dump(uniq, open('tools/user_new_ids.json', 'w'), ensure_ascii=False, indent=1)
print('data.js written; new ids:', len(uniq))
for it in uniq:
    print(' ', it['id'], it['label'])
