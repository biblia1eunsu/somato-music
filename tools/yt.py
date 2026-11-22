#!/usr/bin/env python3
"""YouTube 검색·메타·임베드 사전 점검 (curl 기반, 쿠키 불필요)."""
import json, re, subprocess, urllib.parse

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")


def curl(url, timeout=25):
    cmd = ["curl", "-sL", "--max-time", str(timeout), "-H", f"User-Agent: {UA}",
           "-H", "Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8", "-H", "Cookie: SOCS=CAI", url]
    r = subprocess.run(cmd, capture_output=True)
    return r.stdout.decode("utf-8", "ignore")


def initial_data(html):
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    if not m:
        m = re.search(r'window\["ytInitialData"\] = (\{.*?\});', html, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception:
        return None


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


def search(q, limit=10):
    html = curl("https://www.youtube.com/results?search_query=" + urllib.parse.quote(q))
    data = initial_data(html)
    if not data:
        return []
    vids = []
    walk(data, "videoRenderer", vids)
    out = []
    for v in vids:
        vid = v.get("videoId")
        if not vid:
            continue
        out.append({
            "id": vid,
            "title": txt(v.get("title", {})),
            "channel": txt(v.get("ownerText", {})) or txt(v.get("longBylineText", {})),
            "length": txt(v.get("lengthText", {})),
        })
        if len(out) >= limit:
            break
    return out


def meta(vid):
    """watch 페이지에서 제목·채널·길이·음질 단서를 뽑습니다."""
    html = curl("https://www.youtube.com/watch?v=" + vid)
    out = {"id": vid}
    m = re.search(r'"lengthSeconds":"(\d+)"', html)
    if m:
        out["duration"] = int(m.group(1))
    m = re.search(r'"title":"((?:[^"\\]|\\.)*)"', html)
    if m:
        out["title"] = m.group(1).encode().decode("unicode_escape", "ignore")
    m = re.search(r'"author":"((?:[^"\\]|\\.)*)"', html)
    if m:
        out["channel"] = m.group(1).encode().decode("unicode_escape", "ignore")
    m = re.search(r'"isVerified":(true|false)', html)
    if m:
        out["verified"] = m.group(1) == "true"
    m = re.search(r'"viewCount":"(\d+)"', html)
    if m:
        out["views"] = int(m.group(1))
    out["playable_in_embed"] = '"playableInEmbed":true' in html
    return out


def embed_ok(vid):
    html = curl(f"https://www.youtube.com/embed/{vid}")
    return '"playableInEmbed":true' in html and '"status":"OK"' in html


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
    import sys
    for q in sys.argv[1:]:
        print("##", q)
        for r in search(q, 8):
            print(f'  {r["id"]}  {r["length"]:>7}  {r["channel"][:34]:<34} {r["title"][:70]}')
