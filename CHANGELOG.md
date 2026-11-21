# Changelog

Versionen nach [Semantic Versioning](https://semver.org/lang/de/). Bis zur Freigabe fürs Ensemble
gilt 0.x; **1.0.0** ist die erste Version für alle (nach M5).

- **MINOR** (0.x.0): neuer Meilenstein oder neue Funktion
- **PATCH** (0.x.y): Fehlerbehebung, neue Textdaten (`stueck.enc`), kleine Anpassungen

## [0.6.2] – 2026-11-21

- Behoben: Die Textdaten von 0.6.1 waren mit einem falschen Passwort verschlüsselt und liessen
  sich mit dem Ensemble-Passwort nicht öffnen. Jetzt wieder mit dem Ensemble-Passwort.

## [0.6.1] – 2026-11-21

- Neue Textbuch-Fassung vom 14.11.2026 eingelesen (Text unverändert, nur Layout)
- Behoben: Im Textbuch kursiv gesetzte Sprechtexte wurden als Regie erkannt – 6 Repliken
  hatten keine Karte (Joe +2, Alina +2, Jakob +1, Bianca +1). Der übrige Lernstand bleibt erhalten.

## [0.6.0] – 2026-11-15 · M5

- Badges: 16 Auszeichnungen (Vorhang auf, Szene sitzt, Akt 1–3 sitzt, Textfest, Serien,
  Ablauf-Profi, Regieassistenz, Ohrwurm, Nachteule, Frühaufsteher/in, Marathon, Ohne Souffleuse),
  rollenneutral; Vitrine mit Datum und Fortschritt; Funken-Animation bei neuen Badges
- Startseite: Kachel mit neuestem Badge
- Offline: Service Worker speichert App und verschlüsseltes Stück; Hinweis «Neue Version» mit
  «Aktualisieren»
- Einstellungen: «Alles zurücksetzen» für alle Rollen

## [0.5.0] – 2026-11-15 · M4

- Ablauf: alle 27 Szenen in Aktfarben mit Ort, Kurzfassung und Sprechenden; eigene Szenen markiert
- «Mein Weg durchs Stück»: eigene Szenen mit Auftritt, erstem Stichwort, letztem Satz und Abgang
- Ablauf-Quiz mit 7 Fragetypen (Reihenfolge pro Akt, Was passiert danach, Ort, Wer spricht,
  Bist du dabei, Kurzfassung zuordnen, Wer spricht dein Stichwort); Resultate pro Rolle gespeichert
- Behoben: leere Werte erschienen auf einigen Seiten als «false»/«undefined»

## [0.4.0] – 2026-11-15

- Eigenes App-Icon «Amboss mit Funken» in den Aktfarben, Web-Manifest: auf Android installierbar
- Android: Stimmen ohne bekanntes Geschlecht werden erkannt und nach Figur höher/tiefer gestellt,
  Hinweis zum Zuordnen; Anleitung zum Laden der Stimmen für iPhone und Android
- Versionsnummer in der Fusszeile und in den Einstellungen

## [0.3.0] – 2026-11-15 · M3

- Sprachausgabe mit Frauen- und Männerstimmen, Zuteilung pro Figur nach Geschlecht und Alter
- Stichwort vorlesen (▶︎), automatisches Vorlesen mit Pause und Umdrehen
- Hörprobe: ganze Szene mit allen Stimmen, bei der eigenen Rolle anhalten/einblenden/mitlesen
- Einstellungen → Stimmen; README für Ensemble und Betreuung

## [0.2.0] – 2026-11-15 · M2

- Lernkartei (5 Fächer) mit Phasen bis zum Textfest (1.12.2027)
- Modi: Heute lernen, Zufall, Schwache Karten; Hilfestufen; Statistik; Lernstand sichern/laden
- Stichwort zeigt nur noch den letzten Satz; Ampel «Nicht gewusst / Fast / Gewusst»

## [0.1.0] – 2026-11-15 · M1

- Passwort, Rollenwahl, Karteikarten chronologisch mit Umdrehen und Ampel-Bewertung
- Aktfarben gelb/orange/rot

## M0 – 2026-11-15

- Parser, Review-Bericht, Verschlüsselung, Workflow (noch keine App-Version)
