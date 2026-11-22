#!/usr/bin/env python3
"""은수 님이 보내주신 리스트(지니·사운드클라우드 캡처)의 곡을 유튜브에서 찾고
임베드 가능성을 미리 점검합니다.  사용: python3 q_user.py <start> <end>"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ytsearch2 import search, embed_check, dur_sec

QUERIES = [
    ("free_after_all", "Free After All yoga"),
    ("meditation_riffer", "Meditation Argon Riffer"),
    ("lotus_kalima", "Lotus Khan Kalima"),
    ("return_to_body", "Parijat Return To Your Body"),
    ("healing_senses", "Parijat Healing Senses"),
    ("healing_heart", "Parijat Healing The Heart"),
    ("relaxation_yoga", "Relaxation relaxing nature sounds yoga"),
    ("falling_asleep", "Falling Asleep Essie Jain"),
    ("shinbi", "신비의 숲 별하나"),
    ("forgiving_parijat", "Parijat Forgiving"),
    ("hearts_awakening", "Parijat Hearts Awakening"),
    ("lights_gauthier", "Lights Arnaud Gauthier"),
    ("second_sight", "Argon Riffer Second Sight"),
    ("angel_evancho", "Angel Jackie Evancho"),
    ("ishq_allah", "Ishq Allah Deva Premal Miten"),
    ("snatam_peter", "Snatam Kaur Peter Kater"),
    ("guru_ram_das_ohm", "Guru Ram Das Guru Guru Wahe Guru soundofOHM"),
    ("reiki_zen_macleod", "Reiki Zen Meditation Music Kevin MacLeod"),
    ("shambala_spa", "Shambala Spa healing"),
    ("anshul_johri", "Anshul Johri 15 mins meditation music"),
    ("amazing_space", "Amazing Space Kristin Hoffmann"),
    ("singing_bowl_sc", "Singing Bowl SoundScape Brett Van Donsel"),
    ("hearts_of_space", "Hearts Of Space Saleh Essam Saleh"),
    ("wild_mountain", "Wild Mountainside Ashley Davis"),
    ("divine_mother", "Hymn To The Divine Mother Iris Faba"),
    ("piano_for_brother", "piano for brother 리정혁"),
    ("i_will_rise", "Lucinda Drayton I Will Rise"),
    ("all_is_not_lost", "All Is Not Lost Lisa Swerdlow"),
    ("gobinday", "Gobinday Mukunday Snatam Kaur"),
    ("aad_guray", "Aad Guray Nameh Mirabai Ceiba"),
    ("relaxdaily_056", "relaxdaily No.056 relaxing music"),
    ("relaxdaily_045", "relaxdaily No.045 relaxing piano music"),
    ("you_wont_let_me", "you won't let me justcallmekaka"),
    ("grace_deluxe", "Grace Signature Deluxe Fiona Joy Hawkins"),
]

start, end = int(sys.argv[1]), int(sys.argv[2])
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "user_cands.json")
out = json.load(open(out_path)) if os.path.exists(out_path) else {}

t0 = time.time()
for key, q in QUERIES[start:end]:
    if time.time() - t0 > 235:
        print("time budget reached; rerun from", QUERIES.index((key, q)), flush=True)
        break
    rows, seen = [], set()
    for r in search(q, 6):
        if r["id"] in seen or dur_sec(r["length"]) < 90:
            continue
        seen.add(r["id"])
        rows.append(r)
        if len(rows) >= 4:
            break
    for r in rows:
        c = embed_check(r["id"])
        r.update(c)
    out[key] = rows
    print(key, "->", ", ".join(
        f'{r["id"]}{"O" if r["playable"] and r["ok"] else "X"}{r["length"]} {r["title"][:34]} | {r["channel"][:20]}'
        for r in rows), flush=True)
    json.dump(out, open(out_path, "w"), ensure_ascii=False, indent=1)
print("done")
