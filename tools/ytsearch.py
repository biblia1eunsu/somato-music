#!/usr/bin/env python3
"""Search YouTube (parses ytInitialData) and check embeddability of candidates."""
import re, json, sys, urllib.parse, subprocess

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

def curl(url, timeout=25):
    cmd = ["curl", "-sL", "--max-time", str(timeout), "-H", f"User-Agent: {UA}",
           "-H", "Accept-Language: en-US,en;q=0.9", "-H", "Cookie: SOCS=CAI",
           url]
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
    if not isinstance(o, dict): return ""
    if "simpleText" in o: return o["simpleText"]
    if "runs" in o: return "".join(r.get("text", "") for r in o["runs"])
    return ""

def search(q, limit=8):
    html = curl("https://www.youtube.com/results?search_query=" + urllib.parse.quote(q))
    data = initial_data(html)
    if not data:
        print("NO DATA", q, len(html), flush=True)
        return []
    vids = []
    walk(data, "videoRenderer", vids)
    out = []
    for v in vids:
        vid = v.get("videoId")
        title = txt(v.get("title", {}))
        chan = txt(v.get("ownerText", {})) or txt(v.get("longBylineText", {}))
        length = txt(v.get("lengthText", {}))
        if not vid: continue
        out.append({"id": vid, "title": title, "channel": chan, "length": length,
                    "url": f"https://www.youtube.com/watch?v={vid}"})
        if len(out) >= limit: break
    return out

def check(vid):
    html = curl(f"https://www.youtube.com/embed/{vid}")
    ok = '"status":"OK"' in html
    embed = '"playableInEmbed":true' in html
    reasons = re.findall(r'"reason":\{"simpleText":"(.*?)"', html)
    return {"id": vid, "ok": ok, "embed": embed, "reasons": reasons[:1], "len": len(html)}

if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "search":
        qs = json.load(open(sys.argv[2]))
        results = {}
        for cat, queries in qs.items():
            ql = [queries] if isinstance(queries, str) else queries
            rows = []
            seen = set()
            for q in ql:
                for r in search(q, 6):
                    if r["id"] in seen: continue
                    seen.add(r["id"]); rows.append(r)
                print(f"{cat} / {q}: {len(rows)}", flush=True)
            results[cat] = rows
        json.dump(results, open(sys.argv[3], "w"), ensure_ascii=False, indent=1)
    elif mode == "check":
        ids = json.load(open(sys.argv[2]))
        res = {}
        for cat, vids in ids.items():
            res[cat] = []
            for v in vids:
                c = check(v["id"])
                c["title"] = v.get("title", "")
                res[cat].append(c)
                print(cat, c["id"], "OK" if c["ok"] else "FAIL", "EMBED" if c["embed"] else "NOEMBED", c["reasons"], flush=True)
        json.dump(res, open(sys.argv[3], "w"), ensure_ascii=False, indent=1)
