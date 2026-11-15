import { test } from "node:test";
import assert from "node:assert/strict";
import {
  phase, intervall, bewerten, zustand, istFaellig, faelligeKarten, schwacheKarten, bereichFilter,
  mischen, statistik, anteilSitzt, serie, addTage, tageZwischen, tagKey, STANDARD_TERMINE, INTERVALL,
} from "../public/js/leitner.js";
import { kartenFuer } from "../public/js/cards.js";
import { demo } from "./fixtures/demo.mjs";

const T = STANDARD_TERMINE; // Textfest 2027-12-01, Premiere 2028-04-30

test("Datum-Hilfen", () => {
  assert.equal(addTage("2027-02-27", 3), "2027-03-02");
  assert.equal(addTage("2028-02-28", 1), "2028-02-29"); // Schaltjahr
  assert.equal(addTage("2026-10-24", 2), "2026-10-26"); // Sommerzeit-Ende
  assert.equal(tageZwischen("2026-11-15", "2027-12-01"), 381);
  assert.equal(tagKey(new Date(2026, 10, 5)), "2026-11-05");
});

test("Phasen richten sich nach dem Textfest", () => {
  assert.equal(phase("2026-11-15", T).id, "kennenlernen");
  assert.equal(phase("2027-05-31", T).id, "kennenlernen");
  assert.equal(phase("2027-06-01", T).id, "festigen");      // 6 Monate vor Textfest
  assert.equal(phase("2027-10-05", T).id, "festigen");
  assert.equal(phase("2027-10-06", T).id, "endspurt");      // 8 Wochen vor Textfest
  assert.equal(phase("2027-11-30", T).id, "endspurt");
  assert.equal(phase("2027-12-01", T).id, "halten");        // ab Textfest
  assert.equal(phase("2028-04-29", T).id, "halten");
  assert.equal(phase("2028-04-30", T).id, "spielzeit");
  const p = phase("2026-11-15", T);
  assert.equal(p.tageBisTextfest, 381);
  assert.equal(p.tageBisPremiere, 532);
});

test("Phasen mit anderen Terminen", () => {
  assert.equal(phase("2027-01-10", { textfest: "2027-03-01", premiere: "2027-06-01" }).id, "endspurt");
  assert.equal(phase("2027-01-10", { textfest: "2027-02-01" }).premiere, T.premiere);
});

test("Intervalle: normal, Endspurt höchstens 3, Halten höchstens 7 Tage", () => {
  const normal = phase("2026-11-15", T), end = phase("2027-11-01", T), halten = phase("2028-01-01", T);
  assert.deepEqual([1, 2, 3, 4, 5].map((f) => intervall(f, normal)), [0, 1, 3, 7, 14]);
  assert.deepEqual([1, 2, 3, 4, 5].map((f) => intervall(f, end)), [0, 1, 3, 3, 3]);
  assert.deepEqual([1, 2, 3, 4, 5].map((f) => intervall(f, halten)), [0, 1, 3, 7, 7]);
  assert.deepEqual(INTERVALL, { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 });
});

const karte = { id: "1.1-002", hash: "aaaa" };
const ph = phase("2026-11-15", T);
const ctx = (heute) => ({ heute, phase: ph, jetzt: 1000 });

test("Bewertung: grün +1, gelb bleibt, rot zurück in Fach 1", () => {
  let e = bewerten(undefined, karte, "gruen", ctx("2026-11-15"));
  assert.equal(e.fach, 2);                       // neue Karte startet in Fach 1 -> grün = Fach 2
  assert.equal(e.faellig, "2026-11-16");
  assert.equal(e.erstmals, "2026-11-15");
  e = bewerten(e, karte, "gruen", ctx("2026-11-16"));
  assert.equal(e.fach, 3);
  assert.equal(e.faellig, "2026-11-19");
  e = bewerten(e, karte, "gelb", ctx("2026-11-19"));
  assert.equal(e.fach, 3);
  assert.equal(e.faellig, "2026-11-22");
  e = bewerten(e, karte, "gruen", ctx("2026-11-22"));
  e = bewerten(e, karte, "gruen", ctx("2026-11-29"));
  assert.equal(e.fach, 5);
  assert.equal(e.faellig, "2026-12-13");
  e = bewerten(e, karte, "gruen", ctx("2026-12-13"));
  assert.equal(e.fach, 5);                       // nicht über Fach 5
  e = bewerten(e, karte, "rot", ctx("2026-12-27"));
  assert.equal(e.fach, 1);
  assert.equal(e.faellig, "2026-12-27");         // Fach 1 = gleiche Sitzung
  assert.equal(e.anzahl, 7);
  assert.equal(e.erstmals, "2026-11-15");
  assert.throws(() => bewerten(e, karte, "blau", ctx("2026-12-27")));
});

test("Bewertung im Endspurt: Fach 5 kommt nach 3 Tagen wieder", () => {
  const e = bewerten({ karte: karte.id, hash: "aaaa", fach: 4, faellig: "2027-11-01", anzahl: 3, erstmals: "2027-01-01" },
    karte, "gruen", { heute: "2027-11-01", phase: phase("2027-11-01", T) });
  assert.equal(e.fach, 5);
  assert.equal(e.faellig, "2027-11-04");
});

test("geänderter Text (Hash) -> zurück in Fach 1, heute fällig, Zähler neu", () => {
  const alt = { karte: karte.id, hash: "alt0", fach: 5, faellig: "2027-01-01", anzahl: 9, erstmals: "2026-01-01" };
  const z = zustand(karte, alt, "2026-11-15");
  assert.deepEqual(z, { neu: false, fach: 1, faellig: "2026-11-15", geaendert: true });
  assert.ok(istFaellig(z, "2026-11-15"));
  const e = bewerten(alt, karte, "gruen", ctx("2026-11-15"));
  assert.equal(e.fach, 2);
  assert.equal(e.hash, "aaaa");
  assert.equal(e.anzahl, 1);
  assert.equal(e.erstmals, "2026-11-15");
});

test("Fällige Karten: fällige zuerst (tiefes Fach), dann neue bis Tageslimit", () => {
  const k = kartenFuer(demo, "ruedi"); // 1.1-003, 1.1-006, 2.1-004, 2.1-005, 3.1-001
  const h = (id) => k.find((x) => x.id === id).hash;
  const fs = new Map([
    ["1.1-003", { karte: "1.1-003", hash: h("1.1-003"), fach: 3, faellig: "2026-11-15", erstmals: "2026-11-01" }],
    ["1.1-006", { karte: "1.1-006", hash: h("1.1-006"), fach: 1, faellig: "2026-11-14", erstmals: "2026-11-01" }],
    ["2.1-004", { karte: "2.1-004", hash: h("2.1-004"), fach: 2, faellig: "2026-11-16", erstmals: "2026-11-15" }], // morgen
  ]);
  assert.deepEqual(faelligeKarten(k, fs, "2026-11-15", { neuProTag: 20 }).map((x) => x.id),
    ["1.1-006", "1.1-003", "2.1-005", "3.1-001"]);
  // heute schon 1 neue gelernt (2.1-004 erstmals heute) -> bei Limit 2 nur noch 1 neue
  assert.deepEqual(faelligeKarten(k, fs, "2026-11-15", { neuProTag: 2 }).map((x) => x.id),
    ["1.1-006", "1.1-003", "2.1-005"]);
  assert.deepEqual(faelligeKarten(k, fs, "2026-11-15", { neuProTag: 0 }).map((x) => x.id), ["1.1-006", "1.1-003"]);
});

test("Schwache Karten: Fach 1–2 und geänderte, keine neuen", () => {
  const k = kartenFuer(demo, "ruedi");
  const h = (id) => k.find((x) => x.id === id).hash;
  const fs = new Map([
    ["1.1-003", { hash: h("1.1-003"), fach: 2, faellig: "2026-11-20" }],
    ["1.1-006", { hash: h("1.1-006"), fach: 4, faellig: "2026-11-20" }],
    ["2.1-004", { hash: "geaendert", fach: 5, faellig: "2026-12-20" }],
  ]);
  assert.deepEqual(schwacheKarten(k, fs, "2026-11-15").map((x) => x.id), ["1.1-003", "2.1-004"]);
});

test("Bereich und Mischen", () => {
  const k = kartenFuer(demo, "ruedi");
  assert.deepEqual(bereichFilter(k, "akt:2").map((x) => x.id), ["2.1-004", "2.1-005"]);
  assert.deepEqual(bereichFilter(k, "szene:3.1").map((x) => x.id), ["3.1-001"]);
  assert.equal(bereichFilter(k).length, 5);
  let s = 1;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const m = mischen(k, rng);
  assert.equal(m.length, 5);
  assert.deepEqual(new Set(m.map((x) => x.id)), new Set(k.map((x) => x.id)));
  assert.notDeepEqual(m.map((x) => x.id), k.map((x) => x.id));
});

test("Statistik pro Akt und Szene", () => {
  const k = kartenFuer(demo, "ruedi");
  const h = (id) => k.find((x) => x.id === id).hash;
  const fs = new Map([
    ["1.1-003", { hash: h("1.1-003"), fach: 5, faellig: "2026-12-01" }],
    ["1.1-006", { hash: h("1.1-006"), fach: 1, faellig: "2026-11-15" }],
    ["2.1-004", { hash: h("2.1-004"), fach: 3, faellig: "2026-11-10" }],
  ]);
  const st = statistik(k, fs, "2026-11-15");
  assert.equal(st.gesamt.gesamt, 5);
  assert.equal(st.gesamt.neu, 2);
  assert.deepEqual(st.gesamt.faecher, [1, 0, 1, 0, 1]);
  assert.equal(st.gesamt.faellig, 2);
  assert.equal(anteilSitzt(st.gesamt), 2 / 5);
  assert.deepEqual([...st.proAkt.keys()], [1, 2, 3]);
  assert.equal(st.proAkt.get(1).gesamt, 2);
  assert.equal(st.proSzene.get("2.1").faecher[2], 1);
  assert.equal(st.proSzene.get("3.1").neu, 1);
});

test("Serie: Tage in Folge bis heute oder gestern", () => {
  const tage = { "2026-11-12": 3, "2026-11-13": 1, "2026-11-14": 8 };
  assert.equal(serie(tage, "2026-11-14"), 3);
  assert.equal(serie(tage, "2026-11-15"), 3);     // heute noch nicht gelernt: Serie hält
  assert.equal(serie(tage, "2026-11-16"), 0);
  assert.equal(serie({ ...tage, "2026-11-15": 1 }, "2026-11-15"), 4);
  assert.equal(serie({}, "2026-11-15"), 0);
});
