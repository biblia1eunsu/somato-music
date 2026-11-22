#!/usr/bin/env python3
"""yt-dlp로 후보 영상 메타데이터(채널·길이·임베드 가능 여부·음질)를 모읍니다."""
import json, sys, time
import yt_dlp

opts = {"quiet": True, "no_warnings": True, "skip_download": True,
        "extract_flat": False, "noplaylist": True, "socket_timeout": 15}

def info(vid):
    with yt_dlp.YoutubeDL(opts) as ydl:
        try:
            d = ydl.extract_info("https://www.youtube.com/watch?v=" + vid, download=False)
        except Exception as e:
            return {"id": vid, "error": str(e)[:120]}
    fmts = d.get("formats") or []
    abrs = [f.get("abr") for f in fmts if f.get("abr")]
    return {
        "id": vid,
        "title": d.get("title"),
        "channel": d.get("channel") or d.get("uploader"),
        "channel_id": d.get("channel_id"),
        "duration": d.get("duration"),
        "playable_in_embed": d.get("playable_in_embed"),
        "max_abr": max(abrs) if abrs else None,
        "artist": d.get("artist"),
        "track": d.get("track"),
        "channel_is_verified": d.get("channel_is_verified"),
    }

if __name__ == "__main__":
    cand = json.load(open(sys.argv[1]))
    out = {}
    for key, rows in cand.items():
        out[key] = []
        for r in rows:
            m = info(r["id"])
            m["search_title"] = r.get("title")
            out[key].append(m)
            print(key, m.get("id"), m.get("playable_in_embed"), m.get("duration"),
                  (m.get("channel") or "")[:28], "|", (m.get("title") or m.get("error") or "")[:60], flush=True)
            time.sleep(0.15)
    json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
