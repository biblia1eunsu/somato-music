#!/usr/bin/env python3
"""구간별 후보곡 검색 — 결과를 tools/cand_v4.json 에 모읍니다."""
import json, sys, time
sys.path.insert(0, 'tools')
import yt

QUERIES = {
    "wait": [
        "Yiruma Kiss the Rain official", "Yiruma River Flows in You official",
        "Fiona Joy Hawkins Grace piano", "David Lanz Cristofori's Dream",
        "Deuter Drei", "Kevin MacLeod tranquil meditation piano",
        "relaxdaily piano short", "Liquid Mind Serenity",
    ],
    "opening": [
        "Deuter Koyasan reiki sound healing single track",
        "Deuter meditation single track", "Liquid Mind meditation single",
        "Shambhala spa meditation music", "Deuter East of the Full Moon",
        "Deuter Garden of the Gods",
    ],
    "bridge": [
        "Yiruma Kiss the Rain official", "Yiruma River Flows in You official",
        "Yiruma May Be official", "Yiruma Love Hurts official", "Yiruma Wait There",
        "이정혁 형을 위한 노래 piano", "Yiruma Poem official",
    ],
    "flow:classic": [
        "David Lanz Cristofori's Dream", "David Lanz Return to the Heart",
        "Parijat Inner Balance", "Parijat Path of Silence", "Parijat Reiki Healing Waves",
        "Fiona Joy Hawkins Grace", "Fiona Joy Hawkins Blue Dream",
        "Deuter Drei", "Liquid Mind Serenity",
    ],
    "flow:neoclassic": [
        "Ludovico Einaudi Le Onde", "Ludovico Einaudi I Giorni", "Ludovico Einaudi Due Tramonti",
        "Ludovico Einaudi Nuvole Bianche", "Ludovico Einaudi Una Mattina",
        "Olafur Arnalds Near Light", "Olafur Arnalds Ljosið",
        "Ryuichi Sakamoto Merry Christmas Mr Lawrence", "Ryuichi Sakamoto Aqua",
        "Max Richter On the Nature of Daylight", "Max Richter Vladimir's Blues",
        "Levi Patel As She Passes",
    ],
    "flow:mantra": [
        "Deva Premal Gayatri Mantra", "Deva Premal Moola Mantra",
        "Snatam Kaur Ong Namo", "Snatam Kaur Ra Ma Da Sa",
        "Mirabai Ceiba Sa Ta Na Ma", "Nirinjan Kaur I Am",
        "Deva Premal Om Mani Padme Hum",
    ],
    "flow:christmas": [
        "Rousseau O Holy Night piano", "Rousseau Silent Night piano",
        "Christmas piano instrumental single track", "Francesco Parrino Christmas piano",
    ],
    "cooldown": [
        "harp relaxing music single track", "Amy Turk harp",
        "David Lanz piano calm", "Fiona Joy Hawkins piano calm",
        "Kevin MacLeod harp", "relaxdaily piano calm",
    ],
    "savasana:song": [
        "소향 Wind Song 바람의 노래 official", "성시경 너의 모든 순간 official",
        "이무진 비와 당신 official", "샘김 그 여름밤 official", "샘김 Your Song official",
        "Rachael Yamagata Duet official", "Susie Suh Here With Me official",
        "Norah Jones Come Away With Me official",
    ],
    "savasana:piano": [
        "Levi Patel As She Passes", "Fiona Joy Hawkins Grace", "Olafur Arnalds Near Light",
        "Goldmund Threnody", "Nils Frahm Over There It's Raining", "Hammock I Can Almost See You",
        "Ryuichi Sakamoto Aqua", "Max Richter Vladimir's Blues", "Ludovico Einaudi Nuvole Bianche",
        "Eluvium Indoor Swimming at the Space Station",
    ],
    "savasana:bowl": [
        "singing bowl meditation 10 minutes", "Tibetan singing bowls single track",
        "crystal singing bowl meditation short", "singing bowl sound bath 15 minutes",
    ],
    "savasana:vocal": [
        "Deva Premal Gayatri Mantra", "Snatam Kaur Ong Namo", "Mirabai Ceiba Sa Ta Na Ma",
        "Nirinjan Kaur I Am",
    ],
    "savasana:nature": [
        "rain sounds 10 minutes", "forest sounds birds single track", "ocean waves 10 minutes",
        "Dan Gibson nature music",
    ],
    "savasana:harp": [
        "harp lullaby single track", "music box lullaby short", "Amy Turk harp",
    ],
    "savasana:christmas": [
        "christmas music box carols single track", "Silent Night music box",
        "christmas piano carol single",
    ],
    "closing": [
        "Liquid Mind Serenity", "Kevin MacLeod tranquil", "Deuter Drei",
    ],
}

out = {}
for sec, qs in QUERIES.items():
    out[sec] = {}
    for q in qs:
        try:
            out[sec][q] = yt.search(q, 10)
        except Exception as e:
            out[sec][q] = [{"error": str(e)}]
    print(sec, len(out[sec]), flush=True)
    json.dump(out, open('tools/cand_v4.json', 'w'), ensure_ascii=False, indent=1)
print("saved")
