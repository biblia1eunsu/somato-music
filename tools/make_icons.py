#!/usr/bin/env python3
"""Warm-neutral editorial icons for the somato-music PWA."""
from PIL import Image, ImageDraw
import os

BG = (243, 239, 231)
INK = (43, 38, 33)
ACC = (140, 122, 99)
OUT = "icons"
os.makedirs(OUT, exist_ok=True)


def icon(size, bleed=1.0, bg=BG, fg=INK, accent=ACC, ring=None):
    s = size * 4
    img = Image.new("RGB", (s, s), bg)
    d = ImageDraw.Draw(img)
    cx = cy = s / 2
    r = s * 0.255 * bleed
    w = max(2, int(s * 0.0175))
    # 엔소 — 위쪽에 작은 틈
    d.arc([cx - r, cy - r, cx + r, cy + r], start=298, end=272, fill=fg, width=w)
    # 안쪽 점
    ir = s * 0.028
    d.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=accent)
    # 작은 호
    r2 = s * 0.145
    w2 = max(1, int(s * 0.009))
    d.arc([cx - r2, cy - r2 * 1.02, cx + r2, cy + r2 * 1.02], start=200, end=340, fill=fg, width=w2)
    if ring:
        rr = s * 0.5 - s * 0.06
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=ring, width=max(2, int(s * 0.004)))
    return img.resize((size, size), Image.LANCZOS)


icon(512).save(f"{OUT}/icon-512.png")
icon(192).save(f"{OUT}/icon-192.png")
icon(180).save(f"{OUT}/icon-180.png")
icon(32).save(f"{OUT}/favicon-32.png")
# maskable: 안전 영역을 위해 여백 확보
mask = Image.new("RGB", (512, 512), BG)
inner = icon(340)
mask.paste(inner, ((512 - 340) // 2, (512 - 340) // 2))
mask.save(f"{OUT}/icon-maskable-512.png")
# 다크 모드용 (앱 내 사용)
icon(512, bg=(18, 17, 16), fg=(233, 226, 214), accent=(198, 171, 136)).save(f"{OUT}/icon-dark-512.png")
print("icons done", os.listdir(OUT))
