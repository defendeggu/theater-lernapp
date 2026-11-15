import { test } from "node:test";
import assert from "node:assert/strict";
import { BADGES, badgeKontext, berechneBadges, neueBadges, laengsteSerie, metaNachBewertung } from "../public/js/badges.js";
import { kartenFuer } from "../public/js/cards.js";
import { demoGross } from "./fixtures/demo.mjs";

const HEUTE = "2026-11-15";

function ctx(rolle, faecher = {}, meta = {}) {
  const karten = kartenFuer(demoGross, rolle);
  const fortschritt = new Map();
  for (const k of karten) {
    const f = typeof faecher === "number" ? faecher : faecher[k.id];
    if (f) fortschritt.set(k.id, { karte: k.id, hash: k.hash, fach: f, faellig: "2026-12-31" });
  }
  return badgeKontext({ stueck: demoGross, karten, fortschritt, meta, heute: HEUTE });
}
const badge = (liste, id) => liste.find((b) => b.id === id);

test("längste Serie", () => {
  assert.equal(laengsteSerie({}), 0);
  assert.equal(laengsteSerie({ "2026-11-01": 1, "2026-11-02": 4, "2026-11-04": 1 }), 2);
  const t = {};
  for (let d = 1; d <= 9; d++) t[`2026-12-0${d}`] = 1;
  assert.equal(laengsteSerie(t), 9);
  assert.equal(laengsteSerie({ "2026-12-31": 1, "2027-01-01": 2 }), 2); // über Jahreswechsel
});

test("keine Daten: nichts erreicht, Fortschritt 0", () => {
  const b = berechneBadges(ctx("mona"));
  assert.ok(b.every((x) => !x.erreicht));
  assert.equal(badge(b, "textfest").ziel, kartenFuer(demoGross, "mona").length);
});

test("Akt-Badges nur für Akte mit eigenen Karten", () => {
  const ids = berechneBadges(ctx("erzaehler")).map((b) => b.id);
  assert.ok(ids.includes("akt1"));
  assert.ok(!ids.includes("akt2") && !ids.includes("akt3"));
  assert.ok(berechneBadges(ctx("ruedi")).some((b) => b.id === "akt3"));
});

test("Lernstand: Vorhang auf, Szene sitzt, Akt sitzt, Textfest", () => {
  const k = kartenFuer(demoGross, "ruedi"); // 1.1 (2 Karten), 2.1 (2), 3.1 (1)
  const f = Object.fromEntries(k.map((x) => [x.id, x.szene === "3.1" ? 4 : 2]));
  let b = berechneBadges(ctx("ruedi", f));
  assert.ok(badge(b, "vorhang").erreicht);
  assert.ok(badge(b, "szene").erreicht);        // Szene 3.1 komplett ab Fach 3
  assert.ok(badge(b, "akt3").erreicht);         // Akt 3: einzige Karte in Fach 4
  assert.ok(!badge(b, "akt1").erreicht);
  assert.ok(!badge(b, "textfest").erreicht);
  b = berechneBadges(ctx("ruedi", 5));
  assert.ok(["akt1", "akt2", "akt3", "textfest"].every((id) => badge(b, id).erreicht));
});

test("geänderter Text zählt nicht als gelernt", () => {
  const c = ctx("ruedi", 5);
  for (const e of c.fortschritt.values()) e.hash = "alt";
  assert.ok(!badge(berechneBadges(c), "textfest").erreicht);
});

test("Serien-Badges", () => {
  const tage = {};
  for (let d = 0; d < 30; d++) tage[`2026-10-${String(d + 1).padStart(2, "0")}`] = 2;
  const b = berechneBadges(ctx("mona", {}, { tage }));
  assert.ok(badge(b, "fuerfescht").erreicht);
  assert.ok(badge(b, "dauerbrenner").erreicht);
  assert.ok(!badge(b, "schmiedeeisern").erreicht);
  assert.equal(badge(b, "schmiedeeisern").ist, 30);
});

test("Quiz-Badges", () => {
  const quiz = [
    { art: "mix", richtig: 10, gesamt: 10 },
    { art: "reihenfolge", akt: 1, richtig: 3, gesamt: 3 },
    { art: "reihenfolge", akt: 2, richtig: 2, gesamt: 3 },
  ];
  let b = berechneBadges(ctx("mona", {}, { quiz }));
  assert.ok(badge(b, "ablaufprofi").erreicht);
  assert.ok(!badge(b, "regieassistenz").erreicht);
  assert.deepEqual([badge(b, "regieassistenz").ist, badge(b, "regieassistenz").ziel], [1, 3]);
  quiz.push({ art: "reihenfolge", akt: 2, richtig: 3, gesamt: 3 }, { art: "reihenfolge", akt: 3, richtig: 2, gesamt: 2 });
  b = berechneBadges(ctx("mona", {}, { quiz }));
  assert.ok(badge(b, "regieassistenz").erreicht);
});

test("Marathon und Ohne Souffleuse: rollenneutral (kleine Rolle braucht weniger)", () => {
  const nKlein = kartenFuer(demoGross, "erzaehler").length; // 4 Karten
  let b = berechneBadges(ctx("erzaehler", {}, { tage: { [HEUTE]: nKlein }, ohneHilfeMax: nKlein }));
  assert.ok(badge(b, "marathon").erreicht);
  assert.ok(badge(b, "ohnesouffleuse").erreicht);
  b = berechneBadges(ctx("mona", {}, { tage: { [HEUTE]: 3 }, ohneHilfeMax: 3 }));
  assert.ok(!badge(b, "marathon").erreicht);
});

test("Tageszeit und Serie ohne Hilfe", () => {
  let m = metaNachBewertung({}, { wert: "gruen", hilfe: 0, stunde: 23 });
  assert.equal(m.nachteule, true);
  assert.equal(m.ohneHilfeFolge, 1);
  m = metaNachBewertung(m, { wert: "gruen", hilfe: 0, stunde: 6 });
  assert.equal(m.fruehaufsteher, true);
  assert.equal(m.ohneHilfeMax, 2);
  m = metaNachBewertung(m, { wert: "gruen", hilfe: 1, stunde: 12 }); // mit Hilfe: Serie bricht
  assert.equal(m.ohneHilfeFolge, 0);
  assert.equal(m.ohneHilfeMax, 2);
  m = metaNachBewertung(m, { wert: "gelb", hilfe: 0, stunde: 12 });
  assert.equal(m.ohneHilfeFolge, 0);
});

test("neue Badges: erreicht, aber noch ohne Datum; einmal erreicht bleibt erreicht", () => {
  let b = berechneBadges(ctx("ruedi", 5));
  assert.ok(neueBadges(b).includes("textfest"));
  const badges = Object.fromEntries(neueBadges(b).map((id) => [id, HEUTE]));
  b = berechneBadges(ctx("ruedi", 5, { badges }));
  assert.deepEqual(neueBadges(b), []);
  // Karte fällt zurück -> Badge bleibt (mit Datum)
  b = berechneBadges(ctx("ruedi", 1, { badges }));
  assert.ok(badge(b, "textfest").erreicht);
  assert.equal(badge(b, "textfest").datum, HEUTE);
});

test("mindestens 15 Badges definiert, IDs eindeutig", () => {
  assert.ok(BADGES.length >= 15);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
});
