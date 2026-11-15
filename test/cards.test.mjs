import { test } from "node:test";
import assert from "node:assert/strict";
import { kartenFuer, letzterSatzAb, letzterSatz, abschnitte, indexAbSzene, textStuecke, LANG_WOERTER } from "../public/js/cards.js";
import { rollenListe, einsaetze, szenenDerRolle } from "../public/js/roles.js";
import { demo } from "./fixtures/demo.mjs";

test("letzter Satz wird gefunden", () => {
  const t = "Erschte Satz. Zweite Satz! Dritte Satz?";
  assert.equal(t.slice(letzterSatzAb(t)), "Dritte Satz?");
  assert.equal(letzterSatzAb("Nume ein Satz."), 0);
  assert.equal(letzterSatz("Jo… und denn?"), "und denn?");
  assert.equal(letzterSatz("Lang her. Wage Nr. 1 isch det."), "Wage Nr. 1 isch det.");
  assert.equal(letzterSatz("Säg em Hr. Müller grüezi."), "Säg em Hr. Müller grüezi.");
  assert.equal(letzterSatz("Erste Absatz ohni Punkt\n\nzweite Absatz"), "zweite Absatz");
  assert.equal(letzterSatz("Er seit: «Chumm do häre.» Und denn?"), "Und denn?");
  assert.equal(letzterSatz("Bis zum Tag…, wo alles anders isch."), "Bis zum Tag…, wo alles anders isch.");
});

test("Rolle Mona: Karten, Stichworte, Sammelreplik", () => {
  const k = kartenFuer(demo, "mona");
  assert.deepEqual(k.map((x) => x.id), ["1.1-002", "1.1-004", "1.1-005", "1.1-006"]);
  // erste Karte in der Szene: Szenenkopf + Stichwort = vorherige Replik (Erzähler)
  assert.match(k[0].kopf, /^Szene 1\.1 – Lager – mit Erzähler, Ruedi$/);
  assert.equal(k[0].stichwort.sprecher, "Erzähler");
  assert.equal(k[0].stichwort.eigen, false);
  // weitere Karte: kein Kopf, Stichwort von Ruedi, letzter Satz fett
  assert.equal(k[1].kopf, null);
  assert.equal(k[1].stichwort.sprecher, "Ruedi");
  assert.equal(k[1].stichwort.text, "Und du chunsch vo wiit her, gäll?");   // nur letzter Satz
  assert.equal(k[1].stichwort.ganz, "Ech be de Müller. Und du chunsch vo wiit her, gäll?");
  // zweimal hintereinander: eigene Zeile ist Stichwort
  assert.equal(k[2].stichwort.eigen, true);
  assert.equal(k[2].stichwort.text, "Mer bliibed nume zwei Wuche.");
  // Sammelreplik
  assert.deepEqual(k[3].gemeinsamMit, ["Ruedi"]);
  assert.equal(k[3].sammel, "Ruedi/Mona");
  assert.equal(k[3].akt, 1);
  assert.equal(k[3].farbe, "#E8B10E");
});

test("Rolle Ruedi: über mehrere Akte, Alle-Replik, Replik ohne Text wird übersprungen", () => {
  const k = kartenFuer(demo, "ruedi");
  assert.deepEqual(k.map((x) => x.id), ["1.1-003", "1.1-006", "2.1-004", "2.1-005", "3.1-001"]);
  // 2.1-004: Stichwort überspringt die leere Replik 2.1-003 → Sepp
  const k204 = k[2];
  assert.equal(k204.stichwort.sprecher, "Sepp");
  assert.match(k204.kopf, /^Szene 2\.1 – Dorfplatz – mit Vreni, Sepp$/);
  // Alle → Sprechername ist das Sammelwort
  assert.deepEqual(k[3].gemeinsamMit, ["Vreni", "Sepp"]);
  assert.equal(k[3].stichwort.eigen, true);
  // erste Replik einer Szene: kein Stichwort, nur Kopf
  assert.equal(k[4].stichwort, null);
  assert.match(k[4].kopf, /^Szene 3\.1/);
  assert.equal(k[4].farbe, "#C62828");
  // Regie bleibt erhalten
  assert.deepEqual(k[0].regie, [{ pos: 0, text: "lacht" }]);
});

test("lange Replik: Teilkarten nach Absätzen, dann ganze Replik", () => {
  const k = kartenFuer(demo, "erzaehler");
  const ganz = demo.akte[0].szenen[0].repliken[0].text;
  assert.ok(ganz.split(/\s+/).length > LANG_WOERTER);
  assert.deepEqual(k.map((x) => x.id), ["1.1-001#1", "1.1-001#2", "1.1-001#3", "1.1-001"]);
  assert.deepEqual(k[0].teil, { nr: 1, von: 3 });
  assert.equal(k[0].stichwort, null);            // Szenenanfang
  assert.ok(k[0].kopf);
  assert.equal(k[1].kopf, null);
  assert.equal(k[1].stichwort.eigen, true);       // vorheriger Abschnitt ist Stichwort
  assert.equal(k[1].stichwort.ganz, k[0].text);
  assert.equal(k[1].stichwort.text, "Jede hed jede kennt.");
  assert.equal(k[0].regie[0].text, "*1");         // Regie dem richtigen Teil zugeordnet
  assert.equal(k[1].regie.length, 0);
  assert.equal(k[3].teil, null);
  assert.equal(k[3].text, ganz);
});

test("Abschnitte: kurze Absätze werden zusammengelegt", () => {
  const t = "Kurz.\n\nAuch kurz.\n\n" + "wort ".repeat(20).trim() + "\n\nEnde.";
  const a = abschnitte(t);
  assert.equal(a.length, 1);
  assert.equal(a[0].text, t);
  for (const g of abschnitte(demo.akte[0].szenen[0].repliken[0].text))
    assert.equal(demo.akte[0].szenen[0].repliken[0].text.slice(g.start, g.end), g.text);
});

test("indexAbSzene", () => {
  const k = kartenFuer(demo, "ruedi");
  assert.equal(indexAbSzene(k, "2.1"), 2);
  assert.equal(indexAbSzene(k, "1.5"), 2);   // nächste Szene mit Karten
  assert.equal(indexAbSzene(k, "9.9"), 0);
});

test("textStuecke: Regie an Position, Absätze, *-Marken ausgeblendet", () => {
  const s = textStuecke("Ech chume.\n\nJetzt!", [{ pos: 0, text: "lacht" }, { pos: 10, text: "*2" }]);
  assert.deepEqual(s, [
    { typ: "regie", text: "lacht" },
    { typ: "text", text: "Ech chume." },
    { typ: "absatz" },
    { typ: "text", text: "Jetzt!" },
  ]);
});

test("Rollenliste: gruppiert, mit Einsätzen, ohne Rollen ohne Text", () => {
  const g = rollenListe(demo);
  assert.deepEqual(g.map((x) => x.id), ["dorf", "fahrende", "jugendliche", "erzaehler"]);
  assert.deepEqual(g[0].rollen.map((r) => [r.id, r.einsaetze]), [["ruedi", 5], ["vreni", 3]]);
  assert.equal(einsaetze(demo).get("mona"), 4);
  assert.deepEqual(szenenDerRolle(demo, "vreni").map((s) => s.id), ["2.1", "3.1"]);
});
