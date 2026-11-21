"""Tests für tools/parse.py mit erfundenen Beispielseiten.

Alle Figuren und Texte hier sind frei erfunden (nicht aus dem Textbuch).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

import parse  # noqa: E402
from parse import Line, Span  # noqa: E402


# --- Hilfen zum Bauen erfundener Seiten ------------------------------------
class Seite:
    def __init__(self, nr: int):
        self.nr = nr
        self.y = 73.0
        self.lines: list[Line] = [Line(nr, 37.7, 295.6, 11.0, [Span(str(nr))], raw=str(nr))]

    def _add(self, line: Line, gap: float):
        line.top = self.y
        self.y += gap
        self.lines.append(line)

    def titel(self, text: str, size: float, gap: float = 34):
        self._add(Line(self.nr, 0, 270.0, size, [Span(text)], raw=text), gap)
        return self

    def zentriert(self, text: str, bold=False, italic=False, gap: float = 22.5):
        self._add(Line(self.nr, 0, 250.0, 11.0, [Span(text, bold, italic)], raw=text), gap)
        return self

    def replik(self, nr: int, name: str, *spans, gap: float = 32.5):
        sp = [s if isinstance(s, Span) else Span(s) for s in spans]
        self._add(Line(self.nr, 0, 47.4, 11.0, sp, left=f"{nr} {name} :", left_bold=True,
                       raw=f"{nr} {name} :   " + "".join(s.text for s in sp)), gap)
        return self

    def folge(self, *spans, gap: float = 14.5):
        sp = [s if isinstance(s, Span) else Span(s) for s in spans]
        self._add(Line(self.nr, 0, 127.6, 11.0, sp, raw="".join(s.text for s in sp)), gap)
        return self

    def regie_zentriert(self, text: str, gap: float = 29):
        return self.zentriert(text, italic=True, gap=gap)


def figurenseite() -> list[Line]:
    rows = [
        "Figuren:",
        "(Einsätze ca.)",
        "Erzähler                (2)    Erzähler",
        "Dorfbewohnende",
        "Ruedi Bachmann     (5)   Müller & Gemeinderat",
        "Vreni Bachmann       (3)    Seine Schwester",
        "Die Fahrenden (Beispiel)",
        "Mona         (6)   Weberin",
        "Jugendliche / Kinder",
        "Sepp   m.        (2)      Sohn von Vreni Bachmann",
        "Lisi  w.        (2)      Tochter von Mona",
        "Toni      m.    Statist",
        "Hinweis der Autorin",
    ]
    return [Line(3, 70 + i * 15, 42.5, 11.0, [Span(parse.norm_ws(r))], raw=r) for i, r in enumerate(rows)]


def beispiel() -> list[Line]:
    s10 = Seite(10).titel("Akt 1", 20.0).titel("Szene 1.1", 16.0) \
        .zentriert("Ruedi, Mona, Sepp") \
        .zentriert("Mühle", bold=True) \
        .regie_zentriert("Morgen. Die Mühle klappert.") \
        .replik(1, "Ruedi", "Guete Morge mitenand. Hüt wird gmahle.") \
        .replik(2, "Mona", Span("(lacht) ", italic=True), "Jo gärn. Und denn", gap=14.5) \
        .folge("gömmer zäme as Wasser.", gap=29) \
        .folge("Zweite Absatz chunnt do.", gap=14.5) \
        .replik(3, "Ruedi", "Das esch e", gap=14.5) \
        .folge("lange Satz, de über d", gap=14.5)
    # Seitenumbruch mitten in der Replik 3
    s11 = Seite(11).folge("Siite gaht.") \
        .replik(1, "Sepp", "Ech chume", Span(" (rennt) ", italic=True), "au mit!") \
        .replik(2, "Ruedi/Mona", "Guet!") \
        .replik(3, "Mona", "Denn los.") \
        .replik(4, "Ruedi", "Jo.") \
        .replik(5, "Beide", "Ade!")
    s12 = Seite(12).titel("Szene 1.2", 16.0) \
        .zentriert("Alle ausser Lisi") \
        .zentriert("Dorfplatz", bold=True) \
        .replik(1, "Vreni", "Was esch do los?") \
        .replik(2, "Alle", "Nüt!") \
        .replik(3, "Kinder", "Mir sind do!") \
        .zentriert("Ende", italic=True)
    s12.lines[-1].size = 24.0
    nach_ende = Seite(13).replik(1, "Ruedi", "Das gehört nicht mehr dazu.")
    return figurenseite() + s10.lines + s11.lines + s12.lines + nach_ende.lines


def parsed():
    return parse.parse_lines(beispiel())


def szene(st, sid):
    return next(s for a in st["akte"] for s in a["szenen"] if s["id"] == sid)


# --- Tests -----------------------------------------------------------------
def test_figurenliste():
    st = parsed()
    figs = {f["id"]: f for f in st["figuren"]}
    assert list(figs) == ["erzaehler", "ruedi", "vreni", "mona", "sepp", "lisi", "toni"]
    assert figs["ruedi"]["name"] == "Ruedi Bachmann"
    assert figs["ruedi"]["kurz"] == "Ruedi"
    assert figs["ruedi"]["einsaetze_ca"] == 5
    assert figs["ruedi"]["beschreibung"] == "Müller & Gemeinderat"
    assert figs["ruedi"]["gruppe"] == "dorf"
    assert figs["vreni"]["geschlecht"] == "w"          # aus "Schwester" abgeleitet
    assert figs["vreni"]["unsicher"]                   # Ableitung wird markiert
    assert figs["mona"]["geschlecht"] == "w" and figs["mona"]["gruppe"] == "fahrende"
    assert figs["sepp"]["geschlecht"] == "m" and figs["sepp"]["alter"] == "jugendlich"
    assert figs["sepp"]["unsicher"] == []              # steht explizit im Textbuch
    assert figs["toni"]["sprechrolle"] is False
    assert figs["erzaehler"]["einsaetze_ca"] == 2
    assert figs["erzaehler"]["geschlecht"] is None
    assert "geschlecht unbekannt" in figs["erzaehler"]["unsicher"]


def test_szenenkopf():
    st = parsed()
    assert [a["nr"] for a in st["akte"]] == [1]
    s = szene(st, "1.1")
    assert s["ort"] == "Mühle"
    assert s["personen"][:3] == ["ruedi", "mona", "sepp"]
    assert s["regie"][0]["text"] == "Morgen. Die Mühle klappert."
    assert s["regie"][0]["nach"] is None


def test_ids_pro_szene_statt_seitennummer():
    s = szene(parsed(), "1.1")
    ids = [r["id"] for r in s["repliken"]]
    assert ids == ["1.1-001", "1.1-002", "1.1-003", "1.1-004", "1.1-005", "1.1-006", "1.1-007", "1.1-008"]
    # Seitennummer aus dem PDF bleibt als Info erhalten
    assert s["repliken"][3]["seite"] == 11 and s["repliken"][3]["seite_nr"] == 1


def test_regie_am_anfang_und_absatz():
    r = szene(parsed(), "1.1")["repliken"][1]
    assert r["sprecher"] == ["mona"]
    assert r["regie"] == [{"pos": 0, "text": "lacht"}]
    assert r["text"] == "Jo gärn. Und denn gömmer zäme as Wasser.\n\nZweite Absatz chunnt do."


def test_seitenumbruch_mitten_in_replik():
    r = szene(parsed(), "1.1")["repliken"][2]
    assert r["text"] == "Das esch e lange Satz, de über d Siite gaht."
    assert "11" not in r["text"]  # Seitenzahl nicht im Text


def test_regie_mitten_im_satz():
    r = szene(parsed(), "1.1")["repliken"][3]
    assert r["text"] == "Ech chume au mit!"
    assert r["regie"][0]["text"] == "rennt"
    assert r["text"][: r["regie"][0]["pos"]].strip() == "Ech chume"


def test_schraegstrich_sammelsprecher():
    r = szene(parsed(), "1.1")["repliken"][4]
    assert r["sammel"] == "Ruedi/Mona"
    assert r["sprecher"] == ["ruedi", "mona"]
    assert r["unsicher"] == []


def test_beide_aus_kontext():
    r = szene(parsed(), "1.1")["repliken"][7]
    assert r["sammel"] == "Beide"
    assert sorted(r["sprecher"]) == ["mona", "ruedi"]
    assert r["unsicher"]


def test_alle_ausser_und_alle():
    s = szene(parsed(), "1.2")
    assert "lisi" not in s["personen"]
    assert "erzaehler" not in s["personen"]
    assert {"ruedi", "vreni", "mona", "sepp"} <= set(s["personen"])
    alle = s["repliken"][1]
    assert alle["sammel"] == "Alle"
    assert set(alle["sprecher"]) == set(s["personen"])
    assert alle["unsicher"]


def test_kinder_sind_jugendliche_der_szene():
    r = szene(parsed(), "1.2")["repliken"][2]
    assert r["sammel"] == "Kinder"
    assert r["sprecher"] == ["sepp"]


def test_szenenwechsel_und_ende():
    st = parsed()
    assert [s["id"] for s in st["akte"][0]["szenen"]] == ["1.1", "1.2"]
    alle_texte = " ".join(r["text"] for a in st["akte"] for s in a["szenen"] for r in s["repliken"])
    assert "nicht mehr dazu" not in alle_texte


def test_hash_stabil_und_textabhaengig():
    assert parse.text_hash("Jo, gärn!") == parse.text_hash("jo  gärn")
    assert parse.text_hash("Jo gärn") != parse.text_hash("Nei danke")


def test_korrekturen():
    st = parsed()
    warn = parse.apply_korrekturen(st, {
        "figuren": {"erzaehler": {"geschlecht": "m"}, "gibtsnicht": {"alter": "kind"}},
        "repliken": {"1.1-008": {"sprecher": ["ruedi", "sepp"], "erwartet": "Ade"},
                     "1.1-001": {"text": "Neu", "erwartet": "steht nicht drin"},
                     "9.9-001": {"text": "x"}},
    })
    figs = {f["id"]: f for f in st["figuren"]}
    assert figs["erzaehler"]["geschlecht"] == "m" and figs["erzaehler"]["unsicher"] == []
    r = szene(st, "1.1")["repliken"][7]
    assert r["sprecher"] == ["ruedi", "sepp"] and r["korrigiert"] and r["unsicher"] == []
    assert szene(st, "1.1")["repliken"][0]["text"] != "Neu"
    assert len(warn) == 3


def test_split_regie_mehrere_marken():
    text, regie = parse.split_regie([Span("* 2 Es was einisch. (Pause) * 3 Ende vom Lied.")])
    assert text == "Es was einisch. Ende vom Lied."
    assert [r["text"] for r in regie] == ["*2", "Pause", "*3"]


def test_fussnoten_werden_regie():
    text, regie = parse.split_regie([Span("Das gits würkli ** und au do **HH.")])
    assert text == "Das gits würkli und au do."
    assert all(r["text"].startswith("**") for r in regie)


def test_kursiver_einzelbuchstabe_am_wort_bleibt_text():
    text, regie = parse.split_regie([Span("(staunt) J", italic=True), Span("etzt gohts los.")])
    assert text == "Jetzt gohts los."
    assert regie == [{"pos": 0, "text": "staunt"}]


def test_fette_zeile_ist_regie_nicht_text():
    s = Seite(10).titel("Akt 1", 20.0).titel("Szene 1.1", 16.0) \
        .zentriert("Ruedi") .zentriert("Mühle", bold=True) \
        .replik(1, "Ruedi", "Gnueg für hüt.", gap=14.5) \
        .folge(Span("DUNKEL", bold=True))
    st = parse.parse_lines(figurenseite() + s.lines)
    sz = szene(st, "1.1")
    assert sz["repliken"][0]["text"] == "Gnueg für hüt."
    assert sz["regie"][-1]["text"] == "DUNKEL"


def test_kursiv_gesetzter_sprechtext_bleibt_text():
    # Ganze Replik kursiv (ohne Klammern) -> Sprechtext, markiert; Klammern bleiben Regie
    s = Seite(10).titel("Akt 1", 20.0).titel("Szene 1.1", 16.0) \
        .zentriert("Ruedi, Mona").zentriert("Mühle", bold=True) \
        .replik(1, "Ruedi", Span("(steht auf) Chumm, mer gönd hei.", italic=True)) \
        .replik(2, "Mona", Span("(nickt)", italic=True)) \
        .replik(3, "Ruedi", "Guet.", gap=14.5) \
        .folge(Span("Kurzes Dunkel.", italic=True))
    sz = szene(parse.parse_lines(figurenseite() + s.lines), "1.1")
    r1, r2, r3 = sz["repliken"]
    assert r1["text"] == "Chumm, mer gönd hei."
    assert r1["regie"][0]["text"] == "steht auf"
    assert any("kursiv" in u for u in r1["unsicher"])
    assert r2["text"] == ""                    # nur Regie in Klammern bleibt leer
    assert r3["text"] == "Guet."               # kursive Regie nach Text bleibt Regie
    assert r3["regie"][-1]["text"] == "Kurzes Dunkel."
