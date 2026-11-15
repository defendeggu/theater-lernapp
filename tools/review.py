"""Erzeugt data/private/review.html zum Kontrollieren von stueck.json.

Aufruf:  python tools/review.py [data/private/stueck.json] [data/private/ablauf.json]

Die Datei enthält Klartext aus dem Stück und liegt deshalb in data/private/
(gitignored). Sie wird lokal im Browser geöffnet.
"""
from __future__ import annotations

import html
import json
import sys
from collections import Counter
from pathlib import Path

KURZ_BUCHSTABEN = 4  # Repliken mit weniger Buchstaben werden als "sehr kurz" markiert


def sehr_kurz(r: dict) -> bool:
    return bool(r["text"]) and not r["sammel"] and sum(ch.isalpha() for ch in r["text"]) < KURZ_BUCHSTABEN


def zaehlung(stueck: dict, mit_sammel: bool = True) -> Counter:
    c: Counter = Counter()
    for a in stueck["akte"]:
        for s in a["szenen"]:
            for r in s["repliken"]:
                if not r["text"] or (r["sammel"] and not mit_sammel):
                    continue
                for sp in r["sprecher"]:
                    c[sp] += 1
    return c


def auffaelligkeiten(stueck: dict) -> list[dict]:
    """Alle markierten Stellen als flache Liste (für Bericht und Konsole)."""
    out = []
    for f in stueck["figuren"]:
        for u in f.get("unsicher", []):
            out.append({"wo": f"Figur {f['id']}", "was": u})
    c = zaehlung(stueck)
    for f in stueck["figuren"]:
        if f.get("sprechrolle") and f.get("einsaetze_ca"):
            diff = abs(c[f["id"]] - f["einsaetze_ca"]) / f["einsaetze_ca"]
            if diff > 0.10:
                out.append({"wo": f"Figur {f['id']}",
                            "was": f"{c[f['id']]} Repliken gezählt, Textbuch sagt ca. {f['einsaetze_ca']}"})
    for a in stueck["akte"]:
        for s in a["szenen"]:
            for u in s.get("unsicher", []):
                out.append({"wo": f"Szene {s['id']}", "was": u})
            for r in s["repliken"]:
                for u in r.get("unsicher", []):
                    out.append({"wo": r["id"], "was": u})
                if sehr_kurz(r):
                    out.append({"wo": r["id"], "was": "sehr kurz"})
    for x in stueck.get("ausserhalb", []):
        out.append({"wo": f"Szene {x['szene']} S.{x['seite']}", "was": "Text ausserhalb einer Replik: " + x["text"][:60]})
    for w in stueck.get("warnungen", []):
        out.append({"wo": "korrekturen.json", "was": w})
    return out


def e(s) -> str:
    return html.escape(str(s if s is not None else ""))


def render_text(r: dict) -> str:
    """Text mit Regie an der richtigen Stelle (grau)."""
    t = r["text"]
    parts = []
    last = 0
    for rg in sorted(r["regie"], key=lambda x: x["pos"]):
        parts.append(e(t[last:rg["pos"]]))
        parts.append(f'<span class="regie">({e(rg["text"])})</span> ')
        last = rg["pos"]
    parts.append(e(t[last:]))
    return "".join(parts).replace("\n\n", "<br><br>")


def build_html(stueck: dict, ablauf: dict | None) -> str:
    figs = {f["id"]: f for f in stueck["figuren"]}
    c = zaehlung(stueck)
    c_eigen = zaehlung(stueck, mit_sammel=False)
    kurz = {s["id"]: s for s in (ablauf or {}).get("szenen", [])}
    auff = auffaelligkeiten(stueck)

    rows = []
    for f in stueck["figuren"]:
        n = c[f["id"]]
        soll = f.get("einsaetze_ca")
        warn = soll and abs(n - soll) / soll > 0.10
        unsicher = "; ".join(f.get("unsicher", []))
        rows.append(
            f'<tr class="{"warn" if warn or unsicher else ""}"><td>{e(f["id"])}</td><td>{e(f["name"])}</td>'
            f'<td>{e(f["gruppe"])}</td><td>{e(f["geschlecht"] or "?")}</td><td>{e(f["alter"])}</td>'
            f'<td>{"ja" if f["sprechrolle"] else "nein"}</td><td class="num">{n}</td><td class="num">{c_eigen[f["id"]]}</td>'
            f'<td class="num">{e(soll)}</td><td>{e(f["beschreibung"])}</td><td>{e(unsicher)}</td></tr>')

    options = "".join(f'<option value="{e(f["id"])}">{e(f["name"])}</option>'
                      for f in stueck["figuren"] if f["sprechrolle"])

    szenen_html = []
    for a in stueck["akte"]:
        szenen_html.append(f'<h2 class="akt" style="border-color:{e(a["farbe"])}">Akt {a["nr"]}</h2>')
        for s in a["szenen"]:
            k = kurz.get(s["id"], {})
            personen = ", ".join(figs[p]["kurz"] if p in figs else p for p in s["personen"])
            su = "".join(f'<li>{e(u)}</li>' for u in s.get("unsicher", []))
            szenen_html.append(
                f'<section class="szene" id="s{e(s["id"])}"><h3>Szene {e(s["id"])} – {e(s["ort"])}'
                f' <small>(S. {e(s["seite"])})</small></h3>'
                f'<p class="kopf">Szenenkopf: {e(s["personen_text"])}<br>Personen aufgelöst: {e(personen)}'
                f'{"<br>Gruppen: " + e(", ".join(s["personen_gruppen"])) if s.get("personen_gruppen") else ""}</p>'
                f'{"<ul class=warnliste>" + su + "</ul>" if su else ""}'
                f'<p class="kurz"><b>Kurzfassung:</b> {e(k.get("kurzfassung", "– fehlt –"))}</p>')
            regie_nach: dict = {}
            for rb in s["regie"]:
                regie_nach.setdefault(rb["nach"], []).append(rb["text"])
            for t in regie_nach.get(None, []):
                szenen_html.append(f'<div class="block regie">{e(t)}</div>')
            for r in s["repliken"]:
                sp = ", ".join(figs[x]["kurz"] if x in figs else x for x in r["sprecher"]) or "—"
                label = f'{e(r["sammel"])} → {e(sp)}' if r["sammel"] else e(sp)
                unsicher = r.get("unsicher", [])
                if sehr_kurz(r):
                    unsicher = unsicher + ["sehr kurz"]
                cls = "rep warn" if unsicher else "rep"
                data = " ".join(r["sprecher"])
                szenen_html.append(
                    f'<div class="{cls}" data-sprecher="{e(data)}"><span class="id">{e(r["id"])}'
                    f' <small>S.{e(r["seite"])}/{e(r["seite_nr"])}</small></span>'
                    f'<span class="sp">{label}</span><span class="tx">{render_text(r) or "<i>(nur Regie)</i>"}'
                    f'{"<br><small class=hinweis>⚠ " + e("; ".join(unsicher)) + "</small>" if unsicher else ""}'
                    f'</span></div>')
                for t in regie_nach.get(r["id"], []):
                    szenen_html.append(f'<div class="block regie">{e(t)}</div>')
            szenen_html.append("</section>")

    auff_html = "".join(f'<li><a href="#" data-goto="{e(x["wo"])}">{e(x["wo"])}</a>: {e(x["was"])}</li>' for x in auff)
    n_rep = sum(len(s["repliken"]) for a in stueck["akte"] for s in a["szenen"])

    return f"""<!doctype html>
<html lang="de-CH"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Review – {e(stueck["titel"])}</title>
<style>
:root {{ --warn:#fff3b0; --regie:#777; --hl:#e3f0ff; }}
body {{ font: 15px/1.45 system-ui, sans-serif; margin: 0 auto; max-width: 1100px; padding: 16px; color:#222; background:#fff; }}
h1 {{ margin-top:0 }}
table {{ border-collapse: collapse; width:100%; font-size:13px }}
td, th {{ border:1px solid #ddd; padding:4px 6px; text-align:left; vertical-align:top }}
td.num {{ text-align:right }}
tr.warn td, .rep.warn {{ background: var(--warn) }}
.akt {{ border-left: 10px solid; padding-left: 8px; margin-top: 40px }}
.szene {{ margin: 24px 0; }}
.kopf {{ color:#555; font-size:13px }}
.kurz {{ background:#f4f4f4; padding:8px; border-radius:6px }}
.rep {{ display:grid; grid-template-columns: 110px 160px 1fr; gap:8px; padding:4px; border-bottom:1px solid #eee }}
.rep .id {{ font-family: ui-monospace, monospace; font-size:12px; color:#666 }}
.rep .sp {{ font-weight:600 }}
.regie {{ color: var(--regie); font-style: italic }}
.block {{ margin: 4px 0 4px 280px; font-size:13px }}
.hinweis {{ color:#8a5a00 }}
.rep.hl {{ background: var(--hl); outline: 2px solid #5b9bd5 }}
.rep.dim {{ opacity:.45 }}
.bar {{ position: sticky; top:0; background:#fff; padding:8px 0; border-bottom:1px solid #ddd; z-index:2 }}
@media (max-width: 700px) {{ .rep {{ grid-template-columns: 1fr }} .block {{ margin-left: 0 }} }}
</style></head><body>
<h1>Review: {e(stueck["titel"])}</h1>
<p>{len(stueck["figuren"])} Figuren · {sum(len(a["szenen"]) for a in stueck["akte"])} Szenen · {n_rep} Repliken ·
{len(auff)} Auffälligkeiten. <b>Diese Datei enthält den Stücktext – nicht weitergeben, nicht committen.</b></p>
<div class="bar">Rolle hervorheben:
<select id="rolle"><option value="">– alle –</option>{options}</select>
<label><input type="checkbox" id="nur"> nur diese Rolle</label>
<span id="anzahl"></span></div>
<h2>Figuren</h2>
<p>Gelb = Abweichung &gt; 10 % zwischen gezählten Repliken und «Einsätze ca.» oder unsichere Angabe.
Sammelrepliken zählen für jede beteiligte Figur; Repliken ohne Text zählen nicht.</p>
<table><tr><th>ID</th><th>Name</th><th>Gruppe</th><th>Geschl.</th><th>Alter</th><th>Sprechrolle</th>
<th>gezählt</th><th>ohne Sammel</th><th>Textbuch</th><th>Beschreibung</th><th>unsicher</th></tr>{"".join(rows)}</table>
<h2>Auffälligkeiten ({len(auff)})</h2><ul>{auff_html}</ul>
<h2>Stück</h2>
{"".join(szenen_html)}
<script>
const sel = document.getElementById('rolle'), nur = document.getElementById('nur'), anz = document.getElementById('anzahl');
function upd() {{
  const r = sel.value; let n = 0;
  document.querySelectorAll('.rep').forEach(el => {{
    const hit = r && el.dataset.sprecher.split(' ').includes(r);
    if (hit) n++;
    el.classList.toggle('hl', !!hit);
    el.classList.toggle('dim', !!(r && nur.checked && !hit));
  }});
  anz.textContent = r ? ' ' + n + ' Repliken' : '';
}}
sel.onchange = upd; nur.onchange = upd;
document.querySelectorAll('[data-goto]').forEach(a => a.onclick = ev => {{
  ev.preventDefault();
  const w = a.dataset.goto;
  const t = [...document.querySelectorAll('.rep .id')].find(x => x.textContent.startsWith(w))
        || document.getElementById('s' + w.replace('Szene ', ''));
  if (t) t.scrollIntoView({{behavior:'smooth', block:'center'}});
}});
</script>
</body></html>"""


def main(argv: list[str]) -> int:
    stueck_p = Path(argv[1] if len(argv) > 1 else "data/private/stueck.json")
    ablauf_p = Path(argv[2] if len(argv) > 2 else "data/private/ablauf.json")
    stueck = json.loads(stueck_p.read_text(encoding="utf-8"))
    ablauf = json.loads(ablauf_p.read_text(encoding="utf-8")) if ablauf_p.exists() else None
    out = stueck_p.parent / "review.html"
    out.write_text(build_html(stueck, ablauf), encoding="utf-8")
    auff = auffaelligkeiten(stueck)
    print(f"{out} geschrieben, {len(auff)} Auffälligkeiten")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
