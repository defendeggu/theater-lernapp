"""Erzeugt die App-Icons (Amboss mit Funken in den Aktfarben) nach public/icons/.

Aufruf:  python tools/make_icons.py

Eigenes Motiv – kein Bild aus dem Textbuch (Rechte, Personen). Braucht Pillow
(kommt mit pdfplumber mit). Die erzeugten PNGs werden committet.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

AKT = [(232, 177, 14), (233, 115, 28), (198, 40, 40)]   # gelb, orange, rot
HELL = (255, 220, 120)
OUT = Path(__file__).resolve().parents[1] / "public" / "icons"


def motiv(n: int = 2048, motiv_skala: float = 1.0) -> Image.Image:
    """Quadratisches Icon in Grösse n. motiv_skala < 1 verkleinert Amboss+Funken (maskable)."""
    k = n / 512
    img = Image.new("RGB", (n, n))
    d = ImageDraw.Draw(img)
    for y in range(n):  # dunkler, warmer Verlauf
        t = y / n
        d.line([(0, y), (n, y)], fill=(int(28 + 62 * t * t), int(20 + 12 * t * t), int(16 + 2 * t)))
    glut = Image.new("RGB", (n, n), (0, 0, 0))
    ImageDraw.Draw(glut).ellipse([n * 0.18, n * 0.42, n * 0.82, n * 0.95], fill=(200, 70, 20))
    glut = glut.filter(ImageFilter.GaussianBlur(n * 0.09))
    img = Image.blend(img, Image.composite(glut, img, glut.convert("L")), 0.55)

    ebene = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(ebene)

    def P(pts):
        return [(x * k, y * k) for x, y in pts]

    amboss = [(96, 250), (330, 250), (410, 262), (440, 282), (330, 292), (318, 300), (290, 312), (270, 345),
              (270, 372), (316, 372), (336, 404), (176, 404), (196, 372), (242, 372), (242, 345), (222, 312),
              (150, 298), (110, 280)]
    d.polygon(P(amboss), fill=(34, 27, 22, 255))
    d.line(P(amboss + [amboss[0]]), fill=(120, 70, 40, 255), width=int(3 * k))
    d.polygon(P([(96, 250), (330, 250), (410, 262), (440, 282), (410, 270), (330, 262), (110, 262)]),
              fill=(160, 95, 55, 255))
    rnd = random.Random(7)
    farben = AKT + [HELL]
    cx, cy = 262 * k, 236 * k
    for _ in range(46):
        a = math.radians(rnd.uniform(200, 340))
        lang, start = rnd.uniform(40, 190) * k, rnd.uniform(6, 28) * k
        d.line([(cx + math.cos(a) * start, cy + math.sin(a) * start), (cx + math.cos(a) * lang, cy + math.sin(a) * lang)],
               fill=rnd.choice(farben), width=int(rnd.uniform(2, 5) * k))
    for _ in range(30):
        a = math.radians(rnd.uniform(195, 345))
        lang, r = rnd.uniform(90, 230) * k, rnd.uniform(2, 5) * k
        x, y = cx + math.cos(a) * lang, cy + math.sin(a) * lang
        d.ellipse([x - r, y - r, x + r, y + r], fill=rnd.choice(farben))
    d.ellipse([cx - 16 * k, cy - 16 * k, cx + 16 * k, cy + 16 * k], fill=(255, 236, 170, 255))

    if motiv_skala != 1.0:
        m = int(n * motiv_skala)
        klein = ebene.resize((m, m), Image.LANCZOS)
        ebene = Image.new("RGBA", (n, n), (0, 0, 0, 0))
        ebene.paste(klein, ((n - m) // 2, (n - m) // 2 + int(n * 0.02)), klein)
    img.paste(ebene, (0, 0), ebene)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    gross = motiv()
    maskable = motiv(motiv_skala=0.78)   # Android schneidet Kreis/Squircle aus: Motiv in der sicheren Zone
    ziele = {
        "apple-touch-icon.png": (gross, 180),
        "icon-192.png": (gross, 192),
        "icon-512.png": (gross, 512),
        "icon-maskable-192.png": (maskable, 192),
        "icon-maskable-512.png": (maskable, 512),
        "favicon-32.png": (gross, 32),
    }
    for name, (bild, s) in ziele.items():
        bild.resize((s, s), Image.LANCZOS).save(OUT / name, optimize=True)
        print(f"{OUT / name}  {s}x{s}")


if __name__ == "__main__":
    main()
