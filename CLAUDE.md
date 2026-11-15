# CLAUDE.md – theater-lernapp

Lern-Web-App fürs iPhone für die Eibeler Volksbühne: Das Ensemble von «S'Füür vom Schmied»
(3 Akte, 27 Szenen, 17 Sprechrollen, Luzerner Dialekt) wählt seine Rolle und lernt den Text
mit Karteikarten, Sprachausgabe, Ablauf-Quiz und Badges. Premiere Ende April 2028.

**Verbindliche Vorgabe ist [docs/PLAN.md](docs/PLAN.md)** (Datenmodell, Rollenwahl, Kartenregeln,
Lernmodi, Stimmen, Badges, Struktur, Meilensteine). Wer davon abweichen will, fragt zuerst.

## Klartext-Regeln (streng)

GitHub Pages ist öffentlich. Das Stück ist unveröffentlicht.

- `input/` (PDF) und `data/private/` (stueck.json, ablauf.json, korrekturen.json, review.html)
  sind in `.gitignore` und werden **nie** committet.
- Das PDF und jeder Klartext aus dem Stück kommen nie ins Repo – auch nicht als Test-Fixture,
  Beispiel in Doku, Kommentar oder Commit-Message. Tests nutzen erfundene Figuren und Sätze.
- Ins Repo kommt nur `public/data/stueck.enc` (AES-GCM 256, PBKDF2-SHA256, 600 000 Iterationen,
  zufälliger Salt + IV im Dateikopf, Formatversion; siehe `public/js/crypto.js`).
- Alles nach der Zeile «Ende» (nach Szene 3.9) wird nicht übernommen. Keine Namen realer
  Personen (Mitspielende, Autorin, Beratung) in Daten, Code oder Doku.
- **Vor jedem Commit:** `git status` prüfen (nichts aus `input/` oder `data/private/`) und
  `python tools/check_klartext.py` laufen lassen (sucht 5-Wort-Folgen aus dem Stück).

## Leitplanken

- Vanilla HTML, CSS, JavaScript als ES-Module. Kein Framework, kein Build-Schritt, keine
  npm-Abhängigkeiten zur Laufzeit.
- Hosting unter `https://defendeggu.github.io/theater-lernapp/` – alle Pfade relativ halten.
- Rollenneutral: keine Rolle im Code fest verdrahtet. Die gewählte Rolle bestimmt Karten,
  Fortschritt, Badges, Quiz und «Mein Weg».
- iPhone zuerst: Safari/iOS 17+, Bedienung mit einer Hand (Knöpfe unten), `safe-area` beachten.
- Oberfläche Deutsch mit Schweizer Schreibweise (ss statt ß). Stücktext bleibt exakt im Dialekt.
- Aktfarben: Akt 1 Gelb `#E8B10E`, Akt 2 Orange `#E9731C`, Akt 3 Rot `#C62828`
  (auf Gelb/Orange dunkle Schrift).
- Karte: Vorderseite Stichwort → von Hand umdrehen → Rückseite eigener Text +
  Selbstbewertung als Ampel (🔴 Nöd gwüsst · 🟡 Fast · 🟢 Sass), immer mit Text.

## Ordnerstruktur

```
input/                  PDF (gitignored)
data/private/           stueck.json, ablauf.json, korrekturen.json, review.html (gitignored)
tools/
  parse.py              PDF -> data/private/stueck.json (wendet korrekturen.json an)
  review.py             -> data/private/review.html
  encrypt.mjs           stueck.json + ablauf.json -> public/data/stueck.enc
  check_klartext.py     Commit-Schutz: kein Stücktext in getrackten Dateien
public/                 wird auf GitHub Pages veröffentlicht
  index.html, manifest.webmanifest, sw.js, robots.txt
  css/app.css
  js/ (app.js, crypto.js, store.js, roles.js, cards.js, leitner.js, speech.js,
       voices.js, quiz.js, badges.js, views/*.js)
  icons/, data/stueck.enc
test/                   *.test.mjs (node --test), test_*.py (pytest)
.github/workflows/pages.yml
```

## Befehle

```sh
# Tests
node --test test/*.test.mjs
python -m pytest -q test

# Daten aufbereiten (lokal, braucht input/textbuch.pdf und pdfplumber)
python tools/parse.py                 # -> data/private/stueck.json
python tools/review.py                # -> data/private/review.html (im Browser öffnen)
node tools/encrypt.mjs                # fragt Passwort verdeckt ab -> public/data/stueck.enc

# Commit-Schutz
python tools/check_klartext.py

# Lokaler Server (App unter http://localhost:8000/)
python -m http.server 8000 -d public
```

Python-Abhängigkeiten nur für die Werkzeuge: `pip install pdfplumber pytest`.

## Parser-Hinweise

- Zeilen werden aus den PDF-Zeichen mit Position und Schrift gebaut (pdfplumber), nicht aus
  `pdftotext -layout` (das trennt Sprecherspalte und Text).
- Sprecherzeile: fette linke Spalte `Nr Name :` (x < 120), Text ab x ≈ 127.6. Folgezeilen bei
  x ≈ 127.6. Nummern beginnen pro Seite neu – IDs werden pro Szene vergeben (`2.11-004`).
- Regie = kursiv oder in Klammern; `*N`-Marken und Fussnoten `**`/`**HH` ebenfalls Regie.
  Ganz fette Zeilen (z.B. «BLACK») sind Szenen-Regie.
- Szenenkopf: «Szene X.Y» (16 pt), danach Personen und Ort (zentriert); «Akt N» 20 pt;
  «Ende» 24 pt beendet das Parsen.
- Sammelsprecher (`A/B`, Beide, Alle, Kinder, Gruppe) werden aufgelöst und markiert;
  Korrekturen von Hand in `data/private/korrekturen.json`.

## Git

- Autor in diesem Repo: `Adrian S. <48011232+defendeggu@users.noreply.github.com>` (lokale Config).
- Repo ist privat bis M1; für GitHub Pages wird es öffentlich (Deploy-Job läuft nur dann).
