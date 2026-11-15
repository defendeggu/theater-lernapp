"""Prüft, dass kein Klartext aus dem Stück in Dateien steht, die committet werden.

Aufruf:  python tools/check_klartext.py [data/private/stueck.json]

Sucht in allen Dateien, die git verfolgen würde (getrackt + neu, ohne
gitignored), nach Folgen von 5 Wörtern aus irgendeiner Replik. Exit-Code 1
bei Treffern. Vor jedem Commit laufen lassen.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

N = 5  # Länge der Wortfolge


def words(t: str) -> list[str]:
    return re.findall(r"\w+", t.lower())


def ngrams(ws: list[str], n: int = N) -> set[tuple[str, ...]]:
    return {tuple(ws[i:i + n]) for i in range(len(ws) - n + 1)}


def main(argv: list[str]) -> int:
    stueck_p = Path(argv[1] if len(argv) > 1 else "data/private/stueck.json")
    if not stueck_p.exists():
        print(f"{stueck_p} fehlt – Prüfung nicht möglich.")
        return 2
    st = json.loads(stueck_p.read_text(encoding="utf-8"))
    grams: set = set()
    for a in st["akte"]:
        for s in a["szenen"]:
            for r in s["repliken"]:
                grams |= ngrams(words(r["text"]))
            for rb in s["regie"]:
                grams |= ngrams(words(rb["text"]))
    files = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"],
                           capture_output=True, text=True, check=True).stdout.split("\n")
    bad = 0
    for f in filter(None, files):
        p = Path(f)
        if not p.is_file() or p.suffix in {".enc", ".png", ".ico", ".pdf"}:
            if p.suffix == ".pdf":
                print(f"PDF im Repo: {f}")
                bad += 1
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        hits = ngrams(words(text)) & grams
        if hits:
            bad += 1
            print(f"{f}: {len(hits)} Treffer, z.B. «{' '.join(sorted(hits)[0])}»")
    if bad:
        print(f"\n{bad} Datei(en) mit möglichem Stücktext. NICHT committen.")
        return 1
    print(f"OK – {len([f for f in files if f])} Dateien geprüft, kein Stücktext gefunden.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
