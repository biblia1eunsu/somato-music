#!/usr/bin/env python3
"""YouTube 검색 + 임베드 가능성 사전 점검 (사바아사나 보강용)."""
import re, json, sys, urllib.parse, subprocess, time

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")


def curl(url, timeout=25):
    cmd = ["curl", "-sL", "--max-time", str(timeout), "-H", f"User-Agent: {UA}",
           "-H", "Accept-Language: en-US,en;q=0.9", "-H", "Cookie: SOCS=CAI", url]
    r = subprocess.run(cmd, capture_output=True)
    return r.stdout.decode("utf-8", "ignore")


def initial_data(html):
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    if not m:
        return None
    return json.loads(m.group(1))


def walk(o, key, out):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == key and isinstance(v, dict):
                out.append(v)
            else:
                walk(v, key, out)
    elif isinstance(o, list):
        for v in o:
            walk(v, key, out)


def txt(o):
    if not isinstance(o, dict):
        return ""
    if "simpleText" in o:
        return o["simpleText"]
    if "runs" in o:
        return "".join(r.get("text", "") for r in o["runs"])
    return ""


def search(q, limit=8):
    html = curl("https://www.youtube.com/results?search_query=" + urllib.parse.quote(q))
    data = initial_data(html)
    if not data:
        return []
    vids = []
    walk(data, "videoRenderer", vids)
    out = []
    for v in vids:
        vid = v.get("videoId")
        title = txt(v.get("title", {}))
        chan = txt(v.get("ownerText", {})) or txt(v.get("longBylineText", {}))
        length = txt(v.get("lengthText", {}))
        if not vid:
            continue
        out.append({"id": vid, "title": title, "channel": chan, "length": length})
        if len(out) >= limit:
            break
    return out


def embed_check(vid):
    html = curl(f"https://www.youtube.com/embed/{vid}")
    playable = '"playableInEmbed":true' in html
    ok = '"status":"OK"' in html
    reasons = re.findall(r'"reason":\{"simpleText":"(.*?)"', html)
    return {"ok": ok, "playable": playable, "reason": reasons[:1]}


def dur_sec(s):
    try:
        parts = [int(p) for p in s.split(":")]
    except Exception:
        return 0
    t = 0
    for p in parts:
        t = t * 60 + p
    return t


if __name__ == "__main__":
    queries = json.load(open(sys.argv[1]))
    out = {}
    for key, qs in queries.items():
        rows = []
        seen = set()
        for q in ([qs] if isinstance(qs, str) else qs):
            for r in search(q, 6):
                if r["id"] in seen:
                    continue
                seen.add(r["id"])
                rows.append(r)
            time.sleep(0.4)
        # 임베드 사전 점검
        kept = []
        for r in rows:
            if dur_sec(r["length"]) < 90:      # 1분 미만 쇼츠·티저 제외
                continue
            c = embed_check(r["id"])
            r.update(c)
            kept.append(r)
            if len(kept) >= 5:
                break
            time.sleep(0.3)
        out[key] = kept
        print(f'{key}: {len(kept)} / ' + ", ".join(
            f'{r["id"]}{"✓" if r["playable"] and r["ok"] else "✗"}' for r in kept), flush=True)
    json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
