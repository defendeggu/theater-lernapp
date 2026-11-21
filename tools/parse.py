"""Textbuch-PDF -> data/private/stueck.json.

Aufruf:  python tools/parse.py [input/textbuch.pdf] [data/private/stueck.json]

Der Parser arbeitet in zwei Stufen:
1. extract_lines(): PDF -> Liste von Line-Objekten (Seite, Position, Schrift).
   Nur diese Stufe braucht pdfplumber.
2. parse_lines(): Line-Objekte -> Datenmodell (Figuren, Akte, Szenen, Repliken).
   Diese Stufe ist rein und wird mit erfundenen Beispielzeilen getestet.

Danach wendet apply_korrekturen() die von Hand gepflegte Datei
data/private/korrekturen.json an.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

# ---------------------------------------------------------------------------
# Layout-Konstanten (gemessen am Textbuch, A4 = 595 x 842 pt)
# ---------------------------------------------------------------------------
TEXT_COL_X = 120.0       # ab hier beginnt die Textspalte (Repliken bei x≈127.6)
CONT_X_MAX = 136.0       # Folgezeilen einer Replik beginnen zwischen TEXT_COL_X und hier
PAGE_NUM_Y = 55.0        # Seitenzahl steht oben (top < 55)
PARA_GAP = 22.0          # Zeilenabstand normal 14.5, Leerzeile ≈ 29
AKT_SIZE = 20.0
SZENE_SIZE = 16.0
ENDE_SIZE = 24.0

AKT_FARBEN = {1: "#E8B10E", 2: "#E9731C", 3: "#C62828"}  # gelb, orange, rot

SAMMEL_WOERTER = {"alle", "beide", "kinder", "gruppe", "statisten"}


@dataclass
class Span:
    text: str
    bold: bool = False
    italic: bool = False


@dataclass
class Line:
    page: int
    top: float
    x0: float
    size: float
    spans: list[Span] = field(default_factory=list)
    left: str = ""          # Text in der linken Spalte (x < TEXT_COL_X), nur bei Sprecherzeilen
    left_bold: bool = False
    raw: str = ""           # ganze Zeile, grosse Lücken als "   " (für Tabellen wie die Figurenliste)

    @property
    def text(self) -> str:
        return norm_ws("".join(s.text for s in self.spans))

    @property
    def all_italic(self) -> bool:
        vis = [s for s in self.spans if s.text.strip()]
        return bool(vis) and all(s.italic for s in vis)

    @property
    def any_bold(self) -> bool:
        return any(s.bold for s in self.spans if s.text.strip())


def norm_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def slug(name: str) -> str:
    s = name.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def text_hash(text: str) -> str:
    n = unicodedata.normalize("NFC", text).lower()
    n = re.sub(r"[^\w]+", " ", n).strip()
    return hashlib.sha1(n.encode("utf-8")).hexdigest()[:8]


# ---------------------------------------------------------------------------
# Stufe 1: PDF -> Lines
# ---------------------------------------------------------------------------
def _font_flags(fontname: str) -> tuple[bool, bool]:
    f = fontname.split("+")[-1].lower()
    return ("bold" in f, "italic" in f or "oblique" in f)


def _raw_text(row: list[dict]) -> str:
    out = []
    prev = None
    for c in row:
        if prev is not None:
            gap = c["x0"] - prev
            if gap > 12:
                out.append("   ")
            elif gap > 4 and c["text"] != " ":
                out.append(" ")
        out.append(c["text"])
        prev = c["x1"]
    return "".join(out).strip()


def extract_lines(pdf_path: str | Path) -> list[Line]:
    import pdfplumber  # nur hier nötig

    out: list[Line] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for pno, page in enumerate(pdf.pages, start=1):
            rows: list[list[dict]] = []
            for ch in sorted(page.chars, key=lambda c: (round(c["top"], 1), c["x0"])):
                if rows and abs(rows[-1][0]["top"] - ch["top"]) < 2.5:
                    rows[-1].append(ch)
                else:
                    rows.append([ch])
            for row in rows:
                row.sort(key=lambda c: c["x0"])
                raw = _raw_text(row)
                spans: list[Span] = []
                left_parts: list[str] = []
                left_bold = False
                prev_x1 = None
                has_left = row[0]["x0"] < TEXT_COL_X
                # Sprecherzeile: linke Spalte endet vor TEXT_COL_X mit einer Lücke
                split_left = False
                if has_left:
                    left_chars = [c for c in row if c["x1"] <= TEXT_COL_X + 1]
                    right_chars = [c for c in row if c["x0"] >= TEXT_COL_X]
                    vis_left = [c for c in left_chars if c["text"].strip()]
                    if vis_left and len(left_chars) + len(right_chars) == len(row):
                        bold_left = any(_font_flags(c["fontname"])[0] for c in vis_left)
                        ital_left = any(_font_flags(c["fontname"])[1] for c in vis_left)
                        left_txt = norm_ws("".join(c["text"] for c in left_chars))
                        gap_ok = not right_chars or right_chars[0]["x0"] - max(c["x1"] for c in vis_left) > 8
                        if bold_left and not ital_left and gap_ok and (
                                left_txt.endswith(":") or all(_font_flags(c["fontname"])[0] for c in vis_left)):
                            split_left = True
                            left_parts = [c["text"] for c in left_chars]
                            left_bold = True
                            row = right_chars
                for ch in row:
                    if prev_x1 is not None and ch["x0"] - prev_x1 > 4 and ch["text"] != " ":
                        if spans and not spans[-1].text.endswith(" "):
                            spans[-1].text += " "
                    b, i = _font_flags(ch["fontname"])
                    t = ch["text"]
                    if t == " " and spans:
                        spans[-1].text += " "
                    elif spans and spans[-1].bold == b and spans[-1].italic == i:
                        spans[-1].text += t
                    else:
                        spans.append(Span(t, b, i))
                    prev_x1 = ch["x1"]
                first = (left_chars if split_left else row) or row
                x0 = (first[0]["x0"] if first else 0.0)
                size = max((c["size"] for c in (row or first)), default=0.0)
                ln = Line(page=pno, top=float(first[0]["top"]) if first else 0.0,
                          x0=float(x0), size=round(float(size), 1), spans=spans,
                          left=norm_ws("".join(left_parts)), left_bold=left_bold, raw=raw)
                if split_left and not row:
                    ln.size = round(float(max(c["size"] for c in left_chars)), 1)
                out.append(ln)
    return out


# ---------------------------------------------------------------------------
# Figurenliste
# ---------------------------------------------------------------------------
GRUPPEN_KOEPFE = [
    (re.compile(r"^Dorfbewohn"), "dorf"),
    (re.compile(r"^Die Fahrenden"), "fahrende"),
    (re.compile(r"^Jugendliche\s*/\s*Kinder"), "jugendliche"),
]
NAME = r"(?P<name>[A-ZÄÖÜ][\wäöüÄÖÜ\-]*(?: [A-ZÄÖÜ][\wäöüÄÖÜ\-]*)*)"
FIGUR_RE = re.compile(r"^" + NAME + r"(?: (?P<g>[mw])\.)? \((?P<n>\d+)\)(?: (?P<rest>.*))?$")
STATIST_RE = re.compile(r"^" + NAME + r"(?: (?P<g>[mw])\.)? (?P<rest>Statist\w*)$")
WEIBLICH = re.compile(r"(schwester|wirtin|hebamme|erin\b|tochter|jugendliche\b|frau\b)", re.I)
MAENNLICH = re.compile(r"(schmied|pfarrer|pöstler|besitzer|zimmermann|sohn\b|mann\b)", re.I)


def parse_figuren(lines: list[Line]) -> list[dict]:
    """Liest die Personenliste (Seite mit 'Figuren:').

    Erwartet pro Figur eine Zeile "Name [m.|w.]   (Einsätze)   Beschreibung   [Beziehung]".
    Spalten sind durch grosse Lücken (raw: drei Leerzeichen) getrennt.
    """
    page = next((l.page for l in lines if norm_ws(l.raw or l.text).startswith("Figuren")), None)
    if page is None:
        return []
    gruppe = "erzaehler"
    figuren: list[dict] = []
    for l in (l for l in lines if l.page == page):
        raw = l.raw or l.text
        txt = norm_ws(raw)
        if txt.startswith("Hinweis"):
            break
        for rx, g in GRUPPEN_KOEPFE:
            if rx.search(txt):
                gruppe = g
        m = FIGUR_RE.match(txt)
        if m:
            f = _figur(m.group("name"), m.group("g"), int(m.group("n")), gruppe)
            # Beschreibung = erste Spalte nach "(n)"
            cols = [c.strip() for c in re.split(r"\s{3,}", raw) if c.strip()]
            idx = next((i for i, c in enumerate(cols) if re.search(r"\(\d+\)$", c)), None)
            if idx is not None and idx + 1 < len(cols):
                d = cols[idx + 1]
                f["beschreibung"] = "" if d == f["name"] else d
            figuren.append(f)
            continue
        m = STATIST_RE.match(txt)
        if m:
            f = _figur(m.group("name"), m.group("g"), None, gruppe)
            f["beschreibung"] = m.group("rest")
            figuren.append(f)
    for f in figuren:
        _ableiten(f)
    return figuren


def _figur(name: str, g: str | None, n: int | None, gruppe: str) -> dict:
    kurz = name.split()[0]
    return {
        "id": slug(kurz), "name": name, "kurz": kurz, "geschlecht": g,
        "alter": "jugendlich" if gruppe == "jugendliche" else "erwachsen",
        "beschreibung": "", "gruppe": gruppe, "einsaetze_ca": n,
        "sprechrolle": n is not None, "unsicher": [],
    }


def _ableiten(f: dict) -> None:
    d = f.get("beschreibung", "")
    if re.search(r"\bJugendliche\b", d):
        f["alter"] = "jugendlich"
    if f["geschlecht"] is None:
        if WEIBLICH.search(d):
            f["geschlecht"] = "w"
            f["unsicher"].append("geschlecht aus Beschreibung abgeleitet")
        elif MAENNLICH.search(d):
            f["geschlecht"] = "m"
            f["unsicher"].append("geschlecht aus Beschreibung abgeleitet")
        else:
            f["unsicher"].append("geschlecht unbekannt")


# ---------------------------------------------------------------------------
# Stufe 2: Lines -> Stück
# ---------------------------------------------------------------------------
SPRECHER_RE = re.compile(r"^(?:(?P<nr>\d+)\s+)?(?P<name>[^:]+?)\s*:?$")
PAREN_RE = re.compile(r"\(([^()]*)\)")
STERN_RE = re.compile(r"\*\*\s?(?:\(?HH\)?)?|\*\s?(\d+)")   # Fussnoten ** / **HH und Marken *1, * 2


class Parser:
    def __init__(self, figuren: list[dict]):
        self.figuren = figuren
        self.by_kurz = {}
        for f in figuren:
            self.by_kurz[f["kurz"].lower()] = f["id"]
            self.by_kurz[f["name"].lower()] = f["id"]
        self.akte: list[dict] = []
        self.szene: dict | None = None
        self.replik: dict | None = None
        self.regie_block: dict | None = None
        self.last_line: Line | None = None
        self.header_state = 0  # 0 = kein Kopf, 1 = erwarte Personen, 2 = erwarte Ort
        self.ausserhalb: list[dict] = []

    # --- Hilfen -----------------------------------------------------------
    def _close(self) -> None:
        if self.replik is not None:
            self.szene["_roh"].append(self.replik)
        self.replik = None
        if self.regie_block is not None:
            self.szene["regie"].append(self.regie_block)
        self.regie_block = None

    def _new_szene(self, sid: str, line: Line) -> None:
        self._close()
        akt_nr = int(sid.split(".")[0])
        if not self.akte or self.akte[-1]["nr"] != akt_nr:
            self.akte.append({"nr": akt_nr, "farbe": AKT_FARBEN.get(akt_nr), "szenen": []})
        self.szene = {"id": sid, "akt": akt_nr, "seite": line.page, "ort": "",
                      "personen_text": "", "personen": [], "regie": [], "_roh": [],
                      "unsicher": []}
        self.akte[-1]["szenen"].append(self.szene)
        self.header_state = 1

    def _gap(self, line: Line) -> float:
        if self.last_line is None or self.last_line.page != line.page:
            return 0.0
        return line.top - self.last_line.top

    def _append(self, target: dict, line: Line) -> None:
        gap = self._gap(line)
        paragraph = False
        if target["_spans"]:
            if gap > PARA_GAP:
                paragraph = True
            elif self.last_line and self.last_line.page != line.page:
                prev = "".join(s.text for s in target["_spans"]).rstrip()
                paragraph = bool(re.search(r"[.!?…»)]$", prev))
        if target["_spans"]:
            target["_spans"].append(Span("\n\n" if paragraph else " "))
        target["_spans"].extend(Span(s.text, s.bold, s.italic) for s in line.spans)

    # --- Hauptschleife ----------------------------------------------------
    def feed(self, lines: list[Line]) -> None:
        started = False
        for line in lines:
            txt = line.text
            if not txt and not line.left:
                continue
            if line.top < PAGE_NUM_Y and re.fullmatch(r"\d+", txt):
                continue  # Seitenzahl
            if line.size >= ENDE_SIZE - 0.5 and txt == "Ende":
                self._close()
                return
            if line.size >= AKT_SIZE - 0.5 and re.fullmatch(r"Akt \d+", txt):
                started = True
                self.last_line = line
                continue
            if not started:
                continue
            m = re.fullmatch(r"Szene (\d+\.\d+)", txt)
            if line.size >= SZENE_SIZE - 0.5 and m:
                self._new_szene(m.group(1), line)
                self.last_line = line
                continue
            if self.szene is None:
                continue
            self._line(line)
            self.last_line = line

    def _line(self, line: Line) -> None:
        txt = line.text
        sz = self.szene
        # Szenenkopf: Personen, dann Ort (zentriert, nicht kursiv)
        if self.header_state and not line.left and not line.all_italic and line.x0 > CONT_X_MAX:
            if self.header_state == 1:
                sz["personen_text"] = txt
                self.header_state = 2
            else:
                sz["ort"] = txt
                self.header_state = 0
            return
        self.header_state = 0

        if line.left:
            label = line.left
            if label.lower().startswith("regieanweisung"):
                self._close()
                self.regie_block = {"nach": self._last_id(), "text": "", "_spans": []}
                if txt:
                    self._append(self.regie_block, line)
                return
            m = SPRECHER_RE.match(label)
            self._close()
            self.replik = {"seite": line.page, "seite_nr": int(m.group("nr")) if m.group("nr") else None,
                           "label": m.group("name").strip(), "_spans": []}
            if line.spans:
                self.replik["_spans"].extend(Span(s.text, s.bold, s.italic) for s in line.spans)
            return

        if txt.strip("-") == "" and "-" in txt:
            # Trenner "-----": beendet Regie-Block bzw. Erzähler-Text
            self._close()
            return

        is_cont = TEXT_COL_X <= line.x0 <= CONT_X_MAX
        vis = [s for s in line.spans if s.text.strip()]
        if is_cont and vis and all(s.bold for s in vis):
            is_cont = False  # ganz fette Zeile (z.B. "BLACK") = Regie, nicht Sprechtext
        if is_cont and self.replik is not None:
            self._append(self.replik, line)
            return
        if is_cont and self.regie_block is not None:
            self._append(self.regie_block, line)
            return
        if line.all_italic or line.any_bold or line.x0 > CONT_X_MAX or line.x0 < TEXT_COL_X:
            # Szenen-Regie (zentriert, kursiv, Pausen, Zwischentitel)
            if self.replik is not None:
                self._close()
            if self.regie_block is not None and self._gap(line) < PARA_GAP and self._gap(line) > 0:
                self._append(self.regie_block, line)
                return
            self._close()
            self.regie_block = {"nach": self._last_id(), "text": "", "_spans": []}
            self._append(self.regie_block, line)
            return
        self.ausserhalb.append({"szene": sz["id"], "seite": line.page, "text": txt})

    def _last_id(self) -> int:
        return len(self.szene["_roh"]) + (1 if self.replik else 0)

    # --- Nachbearbeitung --------------------------------------------------
    def finish(self) -> dict:
        self._close()
        for akt in self.akte:
            for sz in akt["szenen"]:
                self._finish_szene(sz)
        return {"akte": self.akte, "ausserhalb": self.ausserhalb}

    def _finish_szene(self, sz: dict) -> None:
        sz["personen"], gruppen, unbekannt = self.resolve_personen(sz["personen_text"])
        sz["personen_gruppen"] = gruppen
        if unbekannt:
            sz["unsicher"].append("Personen unbekannt: " + ", ".join(unbekannt))
        repliken = []
        for i, r in enumerate(sz.pop("_roh"), start=1):
            text, regie = split_regie(r["_spans"])
            kursiv_text = False
            if not text:
                # Ganze Replik kursiv gesetzt: kursiver Text ausserhalb von Klammern ist Sprechtext
                text2, regie2 = split_regie(r["_spans"], kursiv_ist_regie=False)
                if text2:
                    text, regie, kursiv_text = text2, regie2, True
            rep = {"id": f"{sz['id']}-{i:03d}", "seite": r["seite"], "seite_nr": r["seite_nr"],
                   "sprecher": [], "sammel": None, "text": text, "regie": regie,
                   "hash": text_hash(text), "unsicher": []}
            if kursiv_text:
                rep["unsicher"].append("Text im Textbuch kursiv – als Sprechtext übernommen")
            self.resolve_sprecher(rep, r["label"], sz, repliken)
            words = len(text.split())
            if not text:
                rep["unsicher"].append("nur Regie, kein Text")
            elif words > 120:
                rep["unsicher"].append(f"sehr lang ({words} Wörter)")
            if text.rstrip().endswith(","):
                rep["unsicher"].append("endet mit Komma – Text abgeschnitten?")
            repliken.append(rep)
        sz["repliken"] = repliken
        # Personen der Szene um alle tatsächlichen Sprecher ergänzen
        for rep in repliken:
            if rep["sammel"]:
                continue
            for s in rep["sprecher"]:
                if s not in sz["personen"]:
                    sz["personen"].append(s)
                    sz["unsicher"].append(f"{s} spricht, steht aber nicht im Szenenkopf")
        for rb in sz["regie"]:
            text = norm_par("".join(s.text for s in rb.pop("_spans")))
            rb["text"] = text
            n = rb["nach"]
            rb["nach"] = repliken[n - 1]["id"] if 0 < n <= len(repliken) else None

    def _fig(self, name: str) -> str | None:
        return self.by_kurz.get(name.strip().lower())

    def resolve_personen(self, text: str) -> tuple[list[str], list[str], list[str]]:
        ids: list[str] = []
        gruppen: list[str] = []
        unbekannt: list[str] = []
        t = text.strip()
        m = re.match(r"^Alle,?\s+ausser\s+(.*)$", t, re.I)
        if m:
            namen = [x.strip() for x in re.split(r",\s*|\s+und\s+", m.group(1)) if x.strip()]
            aus = {self._fig(x) for x in namen}
            ids = [f["id"] for f in self.figuren
                   if f["sprechrolle"] and f["id"] not in aus and f["gruppe"] != "erzaehler"]
            gruppen.append("alle")
            return ids, gruppen, [x for x in namen if self._fig(x) is None]
        for part in re.split(r",\s*", t):
            p = part.strip()
            if not p:
                continue
            fid = self._fig(p)
            if fid:
                ids.append(fid)
            elif re.search(r"kinder|statist", p, re.I):
                gruppen.append(p)
            else:
                unbekannt.append(p)
        return ids, gruppen, unbekannt

    def resolve_sprecher(self, rep: dict, label: str, sz: dict, bisher: list[dict]) -> None:
        if "/" in label:
            names = [x.strip() for x in label.split("/")]
            ids = [self._fig(n) for n in names]
            rep["sammel"] = label
            rep["sprecher"] = [i for i in ids if i]
            if None in ids:
                rep["unsicher"].append(f"unbekannter Name in '{label}'")
            return
        fid = self._fig(label)
        if fid:
            rep["sprecher"] = [fid]
            return
        low = label.lower()
        rep["sammel"] = label
        if low == "beide":
            letzte: list[str] = []
            for r in reversed(bisher):
                for s in r["sprecher"]:
                    if s not in letzte and not r["sammel"]:
                        letzte.append(s)
                if len(letzte) >= 2:
                    break
            rep["sprecher"] = letzte[:2]
            rep["unsicher"].append("'Beide' aus den letzten zwei Sprechern abgeleitet")
        elif low == "alle":
            anwesend = list(dict.fromkeys(sz["personen"] + [s for r in bisher for s in r["sprecher"]]))
            rep["sprecher"] = [s for s in anwesend if s != "erzaehler"]
            rep["unsicher"].append("'Alle' aus Szenenkopf und bisherigen Sprechern abgeleitet")
        elif low in ("kinder", "gruppe"):
            jung = {f["id"] for f in self.figuren if f["alter"] in ("jugendlich", "kind")}
            anwesend = list(dict.fromkeys(sz["personen"] + [s for r in bisher for s in r["sprecher"]]))
            rep["sprecher"] = [s for s in anwesend if s in jung]
            rep["unsicher"].append(f"'{label}' als Jugendliche/Kinder der Szene abgeleitet")
        elif low == "statisten":
            rep["sprecher"] = []
            rep["unsicher"].append("Statisten – keine Sprechrolle")
        else:
            rep["sprecher"] = []
            rep["unsicher"].append(f"unbekannter Sprecher '{label}'")


def norm_par(s: str) -> str:
    paras = [norm_ws(p) for p in s.split("\n\n")]
    return "\n\n".join(p for p in paras if p)


def split_regie(spans: list[Span], kursiv_ist_regie: bool = True) -> tuple[str, list[dict]]:
    """Trennt Regie (kursiv, in Klammern, *N-Marken) vom Sprechtext.

    Gibt den Sprechtext (Absätze mit \\n\\n) und eine Liste
    [{"pos": Zeichenposition im Text, "text": "..."}] zurück.
    Mit kursiv_ist_regie=False zählen nur Klammern und *N-Marken als Regie
    (für Repliken, deren gesprochener Text im Textbuch kursiv gesetzt ist).
    """
    # 1. Rohtext mit Markierung kursiver Zeichen
    chars: list[tuple[str, bool]] = []
    for s in spans:
        chars.extend((c, s.italic and kursiv_ist_regie) for c in s.text)
    raw = "".join(c for c, _ in chars)
    regie_mask = [it for _, it in chars]
    # Einzelne kursive Buchstaben, die an einem normalen Wort kleben ("J" + "etzt"),
    # sind ein Satzfehler im Textbuch, keine Regie.
    for j in range(1, len(raw)):
        if regie_mask[j - 1] and not regie_mask[j] and raw[j].isalpha():
            k = j
            while k > 0 and regie_mask[k - 1] and raw[k - 1].isalpha():
                k -= 1
            if 1 <= j - k <= 2 and (k == 0 or not raw[k - 1].isalpha()):
                for x in range(k, j):
                    regie_mask[x] = False
    # 2. Klammern und *N als Regie markieren
    depth = 0
    for i, c in enumerate(raw):
        if c == "(":
            depth += 1
        if depth > 0:
            regie_mask[i] = True
        if c == ")" and depth > 0:
            depth -= 1
    for m in STERN_RE.finditer(raw):
        for i in range(m.start(), m.end()):
            regie_mask[i] = True
    # 3. Zusammensetzen
    text_out: list[str] = []
    regie: list[dict] = []
    cur: list[str] = []

    def flush_regie():
        if cur:
            t = norm_ws("".join(cur)).strip()
            t = t[1:-1].strip() if t.startswith("(") and t.endswith(")") else t
            t = re.sub(r"^\*\s?(\d+)", r"*\1", t)
            if t:
                regie.append({"pos": len(norm_par("".join(text_out))), "text": t})
            cur.clear()

    # Jede Klammer und jede *N-Marke beginnt einen eigenen Regie-Eintrag
    starts = {m.start() for m in STERN_RE.finditer(raw)}
    starts |= {i for i, c in enumerate(raw) if c == "("}
    for i, c in enumerate(raw):
        if i in starts and cur:
            flush_regie()
        if regie_mask[i] and not (c.isspace() and not cur):
            if c == "\n":
                continue
            cur.append(c)
        else:
            if cur and c.isspace():
                text_out.append(c)
                continue
            flush_regie()
            text_out.append(c)
    flush_regie()
    text = norm_par("".join(text_out))
    # Leerzeichen vor Satzzeichen, das durch entfernte Regie/Fussnoten entsteht
    text = re.sub(r"(?<=\S) +([.,!?;:])(?=\s|$)", r"\1", text)
    # Regie-Positionen nach Normalisierung begrenzen
    for r in regie:
        r["pos"] = min(r["pos"], len(text))
    return text, regie


# ---------------------------------------------------------------------------
# Korrekturen
# ---------------------------------------------------------------------------
def apply_korrekturen(stueck: dict, korr: dict) -> list[str]:
    """Wendet korrekturen.json an. Gibt Warnungen zurück (Korrekturen ins Leere)."""
    warn: list[str] = []
    figs = {f["id"]: f for f in stueck["figuren"]}
    for fid, change in (korr.get("figuren") or {}).items():
        if fid not in figs:
            warn.append(f"Figur '{fid}' gibt es nicht")
            continue
        figs[fid].update(change)
        figs[fid]["unsicher"] = []
    reps = {r["id"]: r for a in stueck["akte"] for s in a["szenen"] for r in s["repliken"]}
    for rid, change in (korr.get("repliken") or {}).items():
        if rid not in reps:
            warn.append(f"Replik '{rid}' gibt es nicht")
            continue
        r = reps[rid]
        if "erwartet" in change and change["erwartet"] not in r["text"]:
            warn.append(f"Replik '{rid}': Text passt nicht mehr zur Korrektur")
            continue
        for k, v in change.items():
            if k == "erwartet":
                continue
            r[k] = v
        if "text" in change:
            r["hash"] = text_hash(r["text"])
        r["unsicher"] = []
        r["korrigiert"] = True
    szenen = {s["id"]: s for a in stueck["akte"] for s in a["szenen"]}
    for sid, change in (korr.get("szenen") or {}).items():
        if sid not in szenen:
            warn.append(f"Szene '{sid}' gibt es nicht")
            continue
        szenen[sid].update(change)
        szenen[sid]["unsicher"] = []
    return warn


# ---------------------------------------------------------------------------
def parse_lines(lines: list[Line]) -> dict:
    figuren = parse_figuren(lines)
    p = Parser(figuren)
    p.feed(lines)
    res = p.finish()
    return {"titel": "S'Füür vom Schmied", "figuren": figuren, "akte": res["akte"],
            "ausserhalb": res["ausserhalb"]}


def main(argv: list[str]) -> int:
    pdf = Path(argv[1] if len(argv) > 1 else "input/textbuch.pdf")
    out = Path(argv[2] if len(argv) > 2 else "data/private/stueck.json")
    korr_path = out.parent / "korrekturen.json"
    stueck = parse_lines(extract_lines(pdf))
    warn = []
    if korr_path.exists():
        warn = apply_korrekturen(stueck, json.loads(korr_path.read_text(encoding="utf-8")))
    stueck["warnungen"] = warn
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(stueck, ensure_ascii=False, indent=1), encoding="utf-8")
    n = sum(len(s["repliken"]) for a in stueck["akte"] for s in a["szenen"])
    print(f"{len(stueck['figuren'])} Figuren, {sum(len(a['szenen']) for a in stueck['akte'])} Szenen, "
          f"{n} Repliken -> {out}")
    for w in warn:
        print("WARNUNG:", w)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
