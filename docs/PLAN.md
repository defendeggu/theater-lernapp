# theater-lernapp – Plan

Eine Lern-App fürs iPhone, mit der die Spielerinnen und Spieler der Eibeler Volksbühne (EVB) ihren Text für «S'Füür vom Schmied» (Volksstück in 3 Akten, Luzerner Dialekt) auswendig lernen. Jede Person wählt ihre **Rolle** und lernt deren Repliken. Gebaut wird die App mit Claude Code im Repo **`theater-lernapp`**, gehostet auf GitHub Pages.

- **Textfest:** Anfang Dezember 2027 – ab dann ohne Textbuch an die wöchentliche Probe (Vorgabe der Regie)
- **Premiere:** Ende April 2028 (beide Daten in der App einstellbar)
- **Grundlage:** Textbuch-PDF (123 Seiten), lokal unter `input/textbuch.pdf` (nie committen)
- **Erste Nutzerin:** Darstellerin der Alina. Ihre Notizen sind die Ausgangslage.

---

## 1. Wünsche

| Wunsch | Umsetzung in der App |
|---|---|
| Eigene Passagen immer mit dem vorher gesprochenen Text (mind. letzter Satz) als Karteikarte | Jede Karte = **Stichwort** (vorherige Replik, letzter Satz hervorgehoben) + **eigener Text** auf der Rückseite |
| Audio des vorherigen Einsatzes, damit man sprechen kann | Stichwort wird vorgelesen (Sprachausgabe mit Frauen- und Männerstimmen), danach Pause zum Sprechen |
| Ablauf des Stücks zusammengefasst | Ansicht «Ablauf»: alle 27 Szenen mit Ort, Personen und Kurzfassung, eigene Szenen markiert |
| Ablauf auswendig lernen (Quiz) | Ablauf-Quiz mit mehreren Fragetypen (siehe 6) |
| Jeder Akt in eigener Farbe | Akt 1 Gelb, Akt 2 Orange, Akt 3 Rot – wie ein Feuer, das immer heisser brennt |
| Chronologisch und Random | Modi «Chronologisch», «Zufall», dazu «Fällig» und «Schwache Karten» |
| Lernfortschritt speichern | Lokal auf dem iPhone (IndexedDB), pro Rolle, mit Export/Import als Sicherung |
| Belohnung mit Badges | Rund 15 Badges, Tages-Serie, Fortschrittsbalken pro Szene und Akt |
| **Andere Mitspielende sollen die App auch nutzen** | **Rollenwahl** beim Start, alle Sprechrollen auswählbar |
| **Frauen- und Männerstimmen** | Jede Figur bekommt eine Stimme passend zum Geschlecht (siehe 5) |

## 2. Das Textbuch – was wir daraus wissen

- **Struktur:** Akt 1 (Szenen 1.1–1.7), Akt 2 (2.1–2.11), Akt 3 (3.1–3.9) = **27 Szenen**. Jede Szene hat einen Kopf mit Nummer, Personen und Ort (Zigeunerlager/Heitermatt oder Dorfplatz).
- **17 Sprechrollen** mit ungefähren Einsätzen laut Textbuch:

| Figur | Einsätze | Stimme | | Figur | Einsätze | Stimme |
|---|---|---|---|---|---|---|
| Joe Achermann | 155 | Mann | | Alina | 119 | Frau |
| Jakob Suter | 91 | Mann | | Leonie | 46 | Frau |
| Heinrich Ineichen | 90 | Mann | | Gertrud Achermann | 38 | Frau |
| Franziskus Ottiger | 67 | Mann | | Bianca | 34 | Frau |
| Burkard (Jugendl.) | 53 | Mann, jung | | Elisabeth Abderhalden | 33 | Frau |
| Valentin | 43 | Mann | | Antonia (Jugendl.) | 31 | Frau, jung |
| Kandid (Jugendl.) | 26 | Mann, jung | | Anna Zurkirchen | 29 | Frau |
| Erzähler | 4 | Mann | | Emma (Jugendl.) | 22 | Frau, jung |
| | | | | Maria (Kind) | 10 | Frau, jung |

  Statistinnen und Statisten ohne Text erscheinen nicht in der Rollenwahl.
- **Zeilenformat:** `Nr Name:` und dann Text. Die Nummerierung beginnt auf **jeder Seite neu**, ist also nur pro Seite eindeutig. Folgezeilen sind eingerückt.
- **Regieanweisungen** stehen kursiv in Klammern, auch mitten im Text: `(lacht) Jo gärn, mer gönd.` (erfundenes Beispiel) Dazu Regie-Blöcke mit `*1`, `*2` … und Trenner `-----`.
- **Sammelsprecher:** `Alle:`, `Beide:`, `Kinder:`, `Gruppe:`, `Joe/Alina:`. Wichtig für die Rollenwahl: Eine solche Replik gehört allen gemeinten Figuren (siehe 4).
- **Ende des Stücks** ist mit «Ende» markiert. Danach folgen historische Erklärungen und ein Anhang mit Figuren **und Namen der Mitspielenden** – diese Teile kommen nicht in die App.
- Der Text ist **Dialekt**. Das ist für die Sprachausgabe wichtig (siehe 5).

## 3. Wichtig: Der Text gehört nicht öffentlich ins Netz

GitHub Pages ist **öffentlich** (bei kostenlosen Konten auch das Repo). Das Textbuch ist ein unveröffentlichtes Stück der Autorin. Deshalb:

- Das PDF und der daraus erzeugte Klartext (JSON) werden **nie committet** (`input/` und `data/private/` in `.gitignore`).
- Ins Repo kommt nur `stueck.enc` – das ganze Stück (alle Rollen) **verschlüsselt mit einem Passwort** (AES-GCM 256, Schlüssel per PBKDF2-SHA256 mit 600 000 Iterationen). Die App entschlüsselt im Browser mit der WebCrypto-API.
- **Ein gemeinsames Ensemble-Passwort**, das die Regie an die Mitspielenden weitergibt. Beim ersten Start fragt die App einmal danach und merkt sich den abgeleiteten Schlüssel lokal (nicht das Passwort). Wird das Passwort geändert, fragt die App erneut.
- Zusätzlich `noindex` (Meta-Tag + `robots.txt`), damit Suchmaschinen die Seite nicht aufnehmen.

Das ist kein Hochsicherheits-Schutz, aber er verhindert, dass das Stück für jeden lesbar im Netz steht. Vor der Weitergabe an das Ensemble sollte die Regie bzw. der Verein einverstanden sein.

## 4. Architektur

```
textbuch.pdf ──► tools/parse.py ──► data/private/stueck.json ──► Review
                 (pdftotext -layout)        │                    (review.html)
                                            ▼
                         tools/encrypt.mjs (Passwort) ──► public/data/stueck.enc
                                                                  │
GitHub Actions ──► GitHub Pages ──► iPhone Safari ──► «Zum Home-Bildschirm» (PWA, offline)
```

**Technik:**
- Vanilla HTML, CSS, JavaScript als ES-Module. Kein Framework, kein Build-Schritt.
- PWA mit Manifest und Service Worker → läuft offline, als App-Icon auf dem Home-Bildschirm.
- Speicherung: **IndexedDB** für Fortschritt (pro Rolle), `localStorage` nur für Einstellungen. `navigator.storage.persist()` anfragen.
- Tests: `node --test` für Lernalgorithmus, Kartenbau, Quiz-Generator, Badges, Stimmenwahl; `pytest` für den Parser.
- Deployment: GitHub Actions veröffentlicht `public/` auf GitHub Pages → `https://defendeggu.github.io/theater-lernapp/`.

> **iOS-Hinweis:** Safari löscht Daten von Webseiten, die 7 Tage nicht benutzt wurden. Als App auf dem Home-Bildschirm installiert gilt das nicht. Darum: App unbedingt installieren und ab und zu den Fortschritt exportieren. Bei einer Lernzeit bis April 2028 ist das besonders wichtig.

### Ordnerstruktur

```
theater-lernapp/
├─ input/                  # PDF (gitignored)
├─ data/private/           # stueck.json, ablauf.json, review.html (gitignored)
├─ tools/
│  ├─ parse.py             # PDF → stueck.json
│  ├─ review.py            # erzeugt review.html zum Kontrollieren
│  └─ encrypt.mjs          # stueck.json + ablauf.json → public/data/stueck.enc
├─ public/
│  ├─ index.html, manifest.webmanifest, sw.js, robots.txt
│  ├─ css/app.css
│  ├─ js/ (app.js, crypto.js, store.js, roles.js, cards.js, leitner.js,
│  │       speech.js, voices.js, quiz.js, badges.js, views/*.js)
│  ├─ icons/
│  └─ data/stueck.enc
├─ test/
└─ .github/workflows/pages.yml
```

### Datenmodell `stueck.json`

```json
{
  "titel": "S'Füür vom Schmied",
  "figuren": [
    { "id": "alina", "name": "Alina", "geschlecht": "w", "alter": "erwachsen",
      "beschreibung": "Anführerin der Zigeuner & Töpferin", "sprechrolle": true },
    { "id": "joe", "name": "Joe Achermann", "kurz": "Joe", "geschlecht": "m",
      "alter": "erwachsen", "beschreibung": "Dorfschmied & Gemeindeammann",
      "sprechrolle": true },
    { "id": "kandid", "name": "Kandid", "geschlecht": "m", "alter": "jugendlich",
      "sprechrolle": true }
  ],
  "akte": [{ "nr": 1, "farbe": "#E8B10E", "szenen": [
    { "id": "1.1", "ort": "Zigeunerlager",
      "personen": ["erzaehler", "alina", "leonie", "bianca"],
      "repliken": [
        { "id": "1.1-007", "seite": 12, "sprecher": ["alina"],
          "sammel": null,
          "text": "Ech chume grad, wart no chli.",
          "regie": [], "hash": "a3f9c1" },
        { "id": "1.1-008", "seite": 12, "sprecher": ["leonie"],
          "sammel": null, "text": "Guet, denn bis spöter.", "regie": [], "hash": "77b20e" }
      ] }
  ]}]
}
```

- Die **Figurenliste** (Name, Geschlecht, Alter, Beschreibung) kommt aus der Personenliste im Textbuch. Sie steuert Rollenwahl und Stimmen.
- `id` einer Replik = Szene + laufende Nummer **innerhalb der Szene** (nicht die Seitennummer aus dem PDF). `hash` über den normalisierten Text.
- `sprecher` ist eine Liste von Figuren-IDs. Bei Sammelsprechern steht im Feld `sammel` der Originalname (`"Alle"`, `"Beide"`, `"Joe/Alina"`) und in `sprecher` die aufgelösten Figuren:
  - `Joe/Alina` → beide
  - `Beide` → die zwei Figuren, die gerade im Dialog sind (aus dem Kontext)
  - `Alle` → alle Figuren, die laut Szenenkopf und Auf-/Abtritten auf der Bühne sind
  - `Kinder`, `Gruppe` → die Jugendlichen/Kinder der Szene
  - Was der Parser nicht sicher auflösen kann, wird im Review markiert und von Hand in einer kleinen Korrekturdatei `data/private/korrekturen.json` festgelegt (wird beim Parsen angewendet, damit sie ein neues PDF überlebt).
- `regie` enthält die Klammer-Texte mit Position. Die App zeigt sie grau und kursiv, fragt sie nicht ab und liest sie nicht vor.

### Rollenwahl

- Beim ersten Start (nach dem Passwort): Liste aller Sprechrollen mit Beschreibung und Anzahl Einsätze. Antippen = «Das bin ich».
- Die Rolle lässt sich in den Einstellungen wechseln. **Fortschritt, Badges und Serie werden pro Rolle gespeichert**, ein Wechsel löscht nichts. So kann z.B. jemand mit Doppelrolle oder eine Zweitbesetzung mehrere Rollen lernen.
- Alles in der App richtet sich nach der gewählten Rolle: Karten, «Mein Weg durchs Stück», Quiz-Fragen («Bist du in Szene X dabei?»), Statistik.
- Aktueller Rollenname immer sichtbar (oben im Startbildschirm, z.B. «Du spielst: Alina»).

### Karten bauen (in der App, für die gewählte Rolle)

- Für **jede Replik**, bei der die gewählte Figur unter den Sprechern ist, entsteht eine Karte – auch bei Sammelrepliken (mit Hinweis «gemeinsam mit …»).
- **Stichwort** = der **letzte Satz** der Replik direkt vor dem eigenen Einsatz, in einer Zeile mit dem Sprecher (z.B. «Erzähler: und dann betrat sie die Bühne»). Nur dieser Satz steht auf der Karte; der ganze Text der Replik bleibt in den Daten (z.B. für die Sprachausgabe).
- Spricht die Figur zweimal hintereinander (nur Regieanweisung dazwischen), ist ihre eigene vorherige Zeile das Stichwort.
- **Erste Replik in einer Szene:** Stichwort ist der Szenenkopf («Szene 2.11 – Lager der Zigeuner – mit Joe») und, falls vorhanden, die letzte Replik vor ihrem Einsatz in der Szene.
- **Lange Repliken** (mehr als ca. 60 Wörter) werden zusätzlich in Abschnitte geteilt (nach Absätzen im Textbuch). Jeder Abschnitt ist eine eigene Teilkarte mit dem vorherigen Abschnitt als Stichwort. Betrifft vor allem den Erzähler und Joe.
- **Kartenfarbe** = Aktfarbe (farbiger Rand oben und Akt-/Szenen-Badge).

## 5. Sprachausgabe

**Entscheid:** Vorerst **nur Sprachausgabe** (Web Speech API, `speechSynthesis`). Es gibt keine Stimme für Luzerner Dialekt. Eine deutsche Stimme liest einen Satz wie «Ech chume grad, wart no chli» holprig, aber verständlich – das ist für den Anfang ok. Echte Aufnahmen kommen eventuell später (siehe 9).

### Frauen- und Männerstimmen

- Jede Figur hat ein Geschlecht und ein Alter in der Figurenliste. Die App wählt danach die Stimme: Frauen → Frauenstimme, Männer → Männerstimme, Jugendliche/Kinder → gleiche Stimme mit höherer Tonhöhe.
- Damit mehrere Männer (Joe, Jakob, Heinrich, Franziskus, Valentin) nicht gleich klingen, bekommt jede Figur eine eigene Kombination aus Stimme, Tonhöhe (`pitch`) und Tempo (`rate`). Gibt es mehrere Stimmen eines Geschlechts, werden sie auf die Figuren verteilt.
- **Problem:** Die Web Speech API sagt nicht, ob eine Stimme weiblich oder männlich ist. Darum `js/voices.js`:
  - Tabelle bekannter deutscher iOS-/macOS-Stimmen mit Geschlecht (z.B. Anna, Helena, Petra, Marlene = Frau; Martin, Markus, Yannick, Viktor = Mann; Liste beim Bau auf aktuellem iOS prüfen und ergänzen)
  - unbekannte Stimmen können in den Einstellungen als «Frau»/«Mann» markiert werden
  - de-CH bevorzugen, dann de-DE, dann de-AT; «Erweitert»/«Premium»-Varianten bevorzugen (klingen deutlich besser)
- **Fallback, wenn nur ein Geschlecht installiert ist:** Die vorhandene Stimme wird für das andere Geschlecht per Tonhöhe verstellt (tiefer für Männer, höher für Frauen), und die App zeigt einen Hinweis mit Anleitung: *iPhone-Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch* → eine Männer- bzw. Frauenstimme laden (am besten «Erweitert»).
- **Einstellungen → Stimmen:** Übersicht aller Figuren mit zugeteilter Stimme, Probe-Knopf pro Figur («Hallo, ich bin Joe»), Stimme/Tonhöhe pro Figur von Hand änderbar, Grundtempo für alle.
- Regieanweisungen werden nie vorgelesen.

### Ablauf einer Karte mit Audio

Stichwort wird vorgelesen → Pause (Länge passt sich an die Länge der eigenen Replik an, oder bis Tippen) → man spricht den eigenen Text → Karte umdrehen → selbst bewerten.

**Szenen-Durchlauf («Hörprobe»):** Die ganze Szene läuft ab, alle anderen Rollen werden mit ihren Stimmen gesprochen, bei der eigenen Rolle hält die App an (oder blendet den Text optional nach X Sekunden ein, oder liest ihn ebenfalls vor). Gut zum Üben unterwegs, z.B. mit AirPods.

**iOS-Eigenheiten:** Die erste Sprachausgabe muss durch ein Tippen ausgelöst werden; Stimmen laden asynchron (`voiceschanged`); bei gesperrtem Bildschirm kann iOS die Ausgabe anhalten. Spracherkennung zur automatischen Kontrolle lassen wir bewusst weg – sie versteht Dialekt nicht zuverlässig.

## 6. Lernmodi

| Modus | Beschreibung |
|---|---|
| **Chronologisch** | Karten in Stückreihenfolge, wählbar ab Akt/Szene. Die App merkt sich, wo man aufgehört hat. |
| **Zufall** | Gemischt, wahlweise ganzes Stück, ein Akt oder eine Szene. |
| **Fällig** | Lernkartei nach Leitner (5 Fächer). Zeigt, was heute dran ist. |
| **Schwache Karten** | Nur Karten in Fach 1–2. |
| **Hörprobe** | Szenen-Durchlauf mit Audio (siehe 5). |
| **Ablauf** | Szenenübersicht und Quiz (siehe unten). |

**Hilfestufen beim Antworten** (umschaltbar, vor dem Aufdecken):
- nur Stichwort
- Anfangsbuchstaben jedes Wortes (`E c g, w n c.` für «Ech chume grad, wart no chli.») – bewährte Auswendiglern-Technik
- Lückentext (jedes 3. Wort fehlt)
- ganzer Text

**Bewertung (Ampel):** Nach dem Umdrehen der Karte drei Knöpfe – 🔴 «Nicht gewusst» (zurück in Fach 1), 🟡 «Fast» (Fach bleibt), 🟢 «Gewusst» (Fach +1). Farbe immer zusammen mit Text (Farbschwäche). Intervalle: Fach 1 = gleiche Sitzung, 2 = 1 Tag, 3 = 3 Tage, 4 = 7 Tage, 5 = 14 Tage.

**Zwei Termine:** Die Regie verlangt, dass alle ihren Text **Anfang Dezember 2027 auswendig** können und ab dann ohne Textbuch an die wöchentliche Probe kommen («Textfest»). Die **Premiere** ist Ende April 2028. Massgebend fürs Lernen ist das Textfest-Datum. Beide Daten sind in den Einstellungen anpassbar (Standard: Textfest 01.12.2027, Premiere 30.04.2028). Die Phasen richten sich nach dem Textfest:
- **Kennenlernen** (bis 6 Monate vor dem Textfest, also bis ca. Juni 2027): normale Intervalle, Fokus auf Ablauf und chronologisches Lesen
- **Festigen** (6 bis 2 Monate vor dem Textfest): normale Intervalle, Fokus auf Fällig und Hilfestufe «Anfangsbuchstaben»
- **Endspurt** (letzte 8 Wochen vor dem Textfest, ab ca. Oktober 2027): Intervalle höchstens 3 Tage, damit alles frisch bleibt; Hinweis auf Hörprobe ganzer Szenen
- **Halten** (vom Textfest bis zur Premiere): Text sitzt und wird wach gehalten; Intervalle höchstens 7 Tage, Fokus auf Hörprobe ganzer Szenen und schwache Karten

Der Startbildschirm zeigt den Countdown bis zum Textfest (danach bis zur Premiere) und die aktuelle Phase.

### Ablauf und Ablauf-Quiz

- **Kurzfassung pro Szene** (2–3 Sätze, Hochdeutsch): Claude Code erstellt sie beim Aufbereiten aus dem Text in `ablauf.json`. Sie wird im Review gelesen und korrigiert. Dazu: Ort und Personen.
- **«Mein Weg durchs Stück»** für die gewählte Rolle: nur die eigenen Szenen, mit Auftritt (wer ist schon da, was ist das erste Stichwort) und Abgang.
- **Quiz-Fragetypen** (automatisch aus den Daten erzeugt, für die gewählte Rolle):
  1. Szenen in die richtige Reihenfolge tippen (pro Akt)
  2. «Was passiert nach Szene X?» – vier Kurzfassungen zur Auswahl
  3. «Wo spielt Szene X?» – Lager oder Dorfplatz
  4. «Wer ist in Szene X auf der Bühne?» – Mehrfachauswahl
  5. «Bist du in Szene X dabei?»
  6. «Zu welcher Szene gehört diese Kurzfassung?»
  7. «Wer spricht dein Stichwort?» – zu einer eigenen Replik

## 7. Belohnungen

Badges werden pro Rolle lokal gespeichert, mit Datum. Eine Sammelvitrine zeigt erreichte (farbig) und offene (grau, mit Hinweis) Badges. Vorschläge:

| Badge | Bedingung |
|---|---|
| Vorhang auf | erste Karte gelernt |
| Szene sitzt | erste Szene komplett in Fach ≥ 3 |
| Akt 1 / Akt 2 / Akt 3 sitzt | alle Karten eines Akts in Fach ≥ 4 |
| Textfest | alle Karten in Fach 5 |
| Füürfescht | 7 Tage Serie |
| Dauerbrenner | 30 Tage Serie |
| Schmiedeeisern | 100 Tage Serie |
| Ablauf-Profi | Ablauf-Quiz 100 % |
| Regieassistenz | alle 27 Szenen in richtiger Reihenfolge |
| Ohrwurm | 10 Hörproben komplett |
| Nachteule | nach 22 Uhr gelernt |
| Frühaufsteher/in | vor 7 Uhr gelernt |
| Marathon | 100 Karten an einem Tag |
| Ohne Souffleuse | 20 Karten ohne Hilfestufe richtig in Folge |

Dazu: kleine Animation (Funken in Aktfarbe) beim neuen Badge, Tages-Serie und Fortschrittsringe pro Akt auf dem Startbildschirm. Die Badge-Bedingungen sind rollenneutral formuliert, damit sie für 4 wie für 155 Einsätze funktionieren (Anteile statt fester Zahlen, wo nötig).

## 8. Oberfläche (iPhone zuerst)

- **Start:** «Du spielst: Alina», Countdown zum Textfest (danach zur Premiere) mit Phase, drei Fortschrittsringe (Akt 1–3), Knopf «Heute lernen (23 fällig)», Kacheln für die Modi, Serie, neuestes Badge.
- **Karte:** oben Akt-Farbband mit «Akt 2 · Szene 2.11 · Lager»; Vorderseite = Stichwort mit Sprecher und Knopf ▶︎ (vorlesen). Nachdem man das Stichwort gelesen oder gehört und den eigenen Text gesprochen hat, wird die Karte **von Hand umgedreht** (grosser Knopf «Umdrehen» oder Tippen auf die Karte, mit Dreh-Animation, `prefers-reduced-motion` beachten). Rückseite = eigener Text (Regie grau/kursiv) und darunter die **Selbstbewertung als Ampel** (🔴 Nicht gewusst · 🟡 Fast · 🟢 Gewusst). Erst nach der Bewertung geht es zur nächsten Karte; Wischen geht auch.
- Grosse Schrift (einstellbar), Dark Mode, Bedienung mit einer Hand (Knöpfe unten), `safe-area` für die iPhone-Ränder.
- Alle Texte Deutsch, Schweizer Schreibweise. Knöpfe in normalem Hochdeutsch, kein Slang («Nicht gewusst», «Fast», «Gewusst»).
- Läuft auch auf Android (Chrome, installierbar über das Manifest) und am Computer. Getestet wird im iPhone- und im Android-Format.
- **App-Icon:** eigenes Motiv «Amboss mit Funken» in den Aktfarben (`tools/make_icons.py`) – bewusst kein Bild aus dem Textbuch (Personen, Rechte).

## 9. Vorgehen in Meilensteinen

| # | Inhalt | Ergebnis zum Testen |
|---|---|---|
| **M0** ✅ | Repo `theater-lernapp`, `.gitignore`, Parser mit Figurenliste und Sammelsprechern, Korrekturdatei, Review-Bericht, Kurzfassungen `ablauf.json`, Verschlüsselung | `review.html` lokal: alle 27 Szenen, Repliken pro Figur gezählt und mit den Textbuch-Angaben verglichen, Auffälligkeiten markiert. **Kontrolle durch Alina-Darstellerin.** |
| **M1** ✅ | App-Gerüst, Passwort/Entschlüsselung, **Rollenwahl**, Karten chronologisch, Aktfarben, Aufdecken | Erste Version auf GitHub Pages, auf dem iPhone öffnen, verschiedene Rollen ausprobieren |
| **M2** ✅ | Leitner mit Phasen, Bewertung, Zufall/Fällig/Schwach, Hilfestufen, Fortschritt pro Rolle, Export/Import | Täglich lernen möglich |
| **M3** ✅ | Sprachausgabe mit Frauen-/Männerstimmen, Stimmen-Einstellungen, Hörprobe | Stichworte hören, Stimmen pro Figur |
| **M4** ✅ | Ablauf-Ansicht, «Mein Weg», Quiz | Ablauf lernen |
| **M5** | Badges, Startbildschirm, PWA/offline, Countdown Textfest/Premiere, Feinschliff | Fertige App fürs Ensemble |
| **M6** | **KI-Stimmen mit ElevenLabs**: natürliche Stimme pro Figur, vorab erzeugt, verschlüsselt ausgeliefert | Hörprobe und Stichworte mit natürlichen Stimmen |
| *M7 (später)* | *Echte Sprachaufnahmen* | *siehe unten* |

Nach jedem Meilenstein auf dem iPhone testen und Rückmeldung einholen, bevor es weitergeht. Nach M5 zuerst mit 2–3 Mitspielenden testen, dann ans ganze Ensemble.

### M6 – KI-Stimmen mit ElevenLabs (neu, 15.11.2026)

**Machbar: ja.** ElevenLabs erzeugt aus Text sehr natürliche Sprache (Modelle «Multilingual v2», «v3»/«v4» mit Ausdruck wie Lachen oder Flüstern). Statt der holprigen Gerätestimme hört man dann für jede Figur eine eigene, natürliche Stimme – im Lernmodus beim Stichwort und in der Hörprobe.

**Grundsatz:** Die Audiodateien werden **einmal am Computer erzeugt** (Werkzeug `tools/elevenlabs.mjs`), nicht in der App. Der API-Schlüssel bleibt lokal (Umgebungsvariable, nie im Repo, nie im Browser). Die Dateien werden wie der Text **verschlüsselt** und mit der App ausgeliefert.

**Umfang und Kosten (Schätzung)**
- 890 Repliken, rund **85 000 Zeichen** ≈ **100 Minuten** Audio für das ganze Stück.
- Abrechnung in Credits: Multilingual v2 = 1 Credit pro Zeichen, Flash/Turbo = 0,5. Eine komplette Generierung braucht also ca. **85 000 Credits** (Grössenordnung ein Monat «Creator»-Abo), plus Reserve für Neuversuche.
- Bei Textänderungen werden nur Repliken mit geändertem Hash neu erzeugt (Cache nach Replik-ID + Hash).
- Preise und Pläne vor dem Start auf elevenlabs.io/pricing prüfen – Drittquellen widersprechen sich.

**Dialekt**
- ElevenLabs hat keine ausgewiesene Stimme für Luzerner Dialekt. Eine deutsche Stimme liest Mundart deutlich besser als die iPhone-Stimme, aber nicht wie ein Einheimischer.
- Darum zuerst ein **Pilot**: 1 Szene (z.B. 2.11), 3–4 Stimmen, Hörtest mit 2–3 Mitspielenden.
- Option **Voice Cloning**: Eine Mundart sprechende Person (z.B. aus dem Ensemble, mit schriftlichem Einverständnis) liefert ein paar Minuten Aufnahme → daraus eine Stimme mit echter Färbung. Sprecherwechsel pro Figur über Tonlage/Stil.

**Stimmen pro Figur**
- Pro Figur eine Stimme aus der ElevenLabs-Bibliothek passend zu Geschlecht und Alter (Joe, Jakob, Heinrich, Franziskus, Valentin klar unterscheidbar; Jugendliche/Kind jünger).
- Zuordnung in `data/private/elevenlabs.json` (Figur → Voice-ID, Modell, Stabilität/Stil).
- Regieanweisungen werden nicht gesprochen, können aber den Ausdruck steuern (z.B. «lacht» → Audio-Tag `[laughs]` bei v3/v4).

**Technik**
- Pro Replik eine MP3 (mono, 64 kbit/s) ≈ 0,5 MB/Minute → ca. **50 MB** fürs ganze Stück.
- Mit Zeitmarken («with timestamps») erzeugen: so kann die App beim Stichwort nur den **letzten Satz** abspielen.
- Pro Szene eine verschlüsselte Datei `public/audio/<szene>.enc` (AES-GCM, gleicher Schlüssel wie der Text), wird erst beim Öffnen der Szene geladen.
- App: Gibt es eine Aufnahme mit passender Replik-ID **und** passendem Hash, wird sie gespielt, sonst wie bisher die Gerätestimme. Einstellung «Stimmen: Natürlich (ElevenLabs) / Gerät». Offline-Speicher optional pro Szene.

**Rechte und Datenschutz**
- Der unveröffentlichte Stücktext geht dafür an einen externen Dienst → **Einverständnis von Autorin und Verein** nötig. Nutzungsbedingungen zur Datenverwendung prüfen.
- Kommerzielle Nutzung erst ab bezahltem Plan; Voice Cloning nur mit schriftlicher Zustimmung der geklonten Person.

**Schritte**
1. Einverständnis, Konto und Budget klären.
2. Pilot mit 1 Szene, Stimmen auswählen, Hörtest.
3. `tools/elevenlabs.mjs`: erzeugen mit Cache nach Hash, Zeitmarken speichern, Kostenvorschau vor dem Lauf («x Zeichen, y Credits»).
4. `tools/encrypt-audio.mjs`: pro Szene verschlüsseln → `public/audio/*.enc`.
5. App: Abspielen mit Fallback, Einstellung, Laden bei Bedarf; Tests mit erfundenen Audiodaten.
6. README: Audio aktualisieren nach Textänderung.

**Ergebnis zum Testen:** Hörprobe und Stichworte mit natürlichen Stimmen für alle Figuren.

### Später: echte Sprachaufnahmen (M7, optional)

Wenn die holprige Sprachausgabe stört, können die Stichworte im echten Dialekt aufgenommen werden. Das Datenmodell ist vorbereitet: Jede Replik hat eine feste `id`, über die eine Aufnahme zugeordnet wird. Varianten:
- **Persönlich:** Jede Person nimmt Stichworte auf ihrem iPhone selbst auf (MediaRecorder, Speicherung in IndexedDB). Einfach, aber jede Person muss es selbst tun.
- **Fürs ganze Ensemble:** Jede Person nimmt ihre **eigenen** Repliken auf (z.B. in einem «Aufnahme-Modus» der App oder an einer Probe). Die Dateien werden gesammelt, verschlüsselt wie der Text und als `audio/*.enc` mit der App ausgeliefert. Dann hört jede Person die echten Stimmen der Mitspielenden. Braucht deren Einverständnis und etwas Speicherplatz (geschätzt 50–150 MB für das ganze Stück).
- Die App spielt eine Aufnahme ab, wenn es eine gibt, sonst die Sprachausgabe.

### Aktfarben

| Akt | Farbe | Hex |
|---|---|---|
| 1 | Gelb | `#E8B10E` |
| 2 | Orange | `#E9731C` |
| 3 | Rot | `#C62828` |

Auf Gelb und Orange steht dunkle Schrift (Kontrast), auf Rot helle.

## 10. Offene Punkte

- [x] Repo-Name: `theater-lernapp` (privat bis M1, dann öffentlich für GitHub Pages)
- [x] Premiere: Ende April 2028 (genaues Datum später in der App setzen)
- [x] Textfest: Anfang Dezember 2027 (Standard 01.12.2027)
- [x] Ensemble-Passwort festgelegt, `stueck.enc` erzeugt
- [x] Mitspielende nutzen die App ebenfalls → Rollenwahl
- [x] Sprachausgabe auf Hochdeutsch vorerst ok
- [ ] Einverständnis von Regie/Verein, das Stück verschlüsselt in der App zu verteilen
- [ ] Textänderungen der Regie: neues PDF → Parser erneut laufen lassen. Der Lernstand wird über Replik-ID und Text-Hash zugeordnet; geänderte Repliken kommen zurück in Fach 1, unveränderte behalten ihren Stand.
