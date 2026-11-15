import { test } from "node:test";
import assert from "node:assert/strict";
import {
  erzeugeQuiz, frageReihenfolge, pruefen, richtigePositionen, szenenListe, ersterSatz, meinWeg, FRAGETYPEN,
} from "../public/js/quiz.js";
import { demo, demoGross } from "./fixtures/demo.mjs";

const gross = demoGross;

function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function gueltig(f) {
  const ids = f.optionen.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, `${f.typ}: Optionen eindeutig`);
  for (const r of f.richtig) assert.ok(ids.includes(r), `${f.typ}: richtige Antwort ist unter den Optionen`);
  assert.ok(f.frage && f.aufloesung, `${f.typ}: Frage und Auflösung`);
}

test("Hilfen", () => {
  assert.equal(ersterSatz("Eins. Zwei."), "Eins.");
  assert.equal(ersterSatz("Ohne Punkt"), "Ohne Punkt");
  const s = szenenListe(gross);
  assert.equal(s.length, 8);
  assert.deepEqual(s.find((x) => x.id === "1.1").sprecher.sort(), ["erzaehler", "mona", "ruedi"]);
});

test("Quiz für eine grosse Rolle: alle Fragetypen kommen vor und sind gültig", () => {
  const fragen = erzeugeQuiz(gross, "mona", { anzahl: 30, rng: rng(3) });
  assert.ok(fragen.length >= 12);
  const typen = new Set(fragen.map((f) => f.typ));
  for (const t of FRAGETYPEN) assert.ok(typen.has(t), "Typ fehlt: " + t);
  fragen.forEach(gueltig);
  const danach = fragen.filter((f) => f.typ === "danach");
  for (const f of danach) assert.equal(f.optionen.length, 4);
  const pers = fragen.find((f) => f.typ === "personen");
  assert.equal(pers.mehrfach, true);
  // keine doppelten Fragen
  const keys = fragen.map((f) => `${f.typ}|${f.szene}|${f.karte ?? ""}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("Quiz für eine kleine Rolle (Erzähler, eine Szene) funktioniert", () => {
  const fragen = erzeugeQuiz(gross, "erzaehler", { anzahl: 10, rng: rng(5) });
  assert.equal(fragen.length, 10);
  fragen.forEach(gueltig);
  // Erzähler beginnt die Szene: keine Stichwort-Frage möglich
  assert.ok(!fragen.some((f) => f.typ === "stichwort"));
});

test("Stichwort-Frage: richtiger Sprecher", () => {
  const f = erzeugeQuiz(gross, "ruedi", { anzahl: 40, rng: rng(9) }).find((x) => x.typ === "stichwort");
  assert.ok(f);
  gueltig(f);
  assert.equal(f.optionen.length, 4);
});

test("Fragen sind reproduzierbar mit gleichem Zufall", () => {
  const a = erzeugeQuiz(gross, "mona", { rng: rng(7) });
  const b = erzeugeQuiz(gross, "mona", { rng: rng(7) });
  assert.deepEqual(a, b);
});

test("Reihenfolge: nie schon richtig, Prüfung und Teilpunkte", () => {
  for (let seed = 1; seed < 20; seed++) {
    const f = frageReihenfolge(gross, 1, rng(seed));
    assert.deepEqual(f.richtig, ["1.1", "1.2", "1.3"]);
    assert.notDeepEqual(f.optionen.map((o) => o.id), f.richtig);
  }
  const f = frageReihenfolge(gross, 1, rng(2));
  assert.equal(pruefen(f, ["1.1", "1.2", "1.3"]), true);
  assert.equal(pruefen(f, ["1.2", "1.1", "1.3"]), false);
  assert.equal(richtigePositionen(f, ["1.2", "1.1", "1.3"]), 1);
  assert.equal(frageReihenfolge(demo, 3, rng(1)), null); // nur eine Szene
});

test("Prüfen: Einfach- und Mehrfachauswahl", () => {
  const f = { typ: "personen", richtig: ["a", "b"] };
  assert.equal(pruefen(f, ["b", "a"]), true);
  assert.equal(pruefen(f, ["a"]), false);
  assert.equal(pruefen(f, ["a", "b", "c"]), false);
  assert.equal(pruefen({ typ: "ort", richtig: ["dorf"] }, ["dorf"]), true);
});

test("Mein Weg: eigene Szenen mit Auftritt, Stichwort, Abgang", () => {
  const w = meinWeg(gross, "mona");
  assert.deepEqual(w.map((x) => x.szene), ["1.1", "1.2", "1.3", "2.2", "2.3", "3.2"]);
  const erste = w[0];
  assert.deepEqual(erste.schonDa, ["Erzähler"]);
  assert.equal(erste.erstesStichwort.sprecher, "Erzähler");
  assert.equal(erste.einsaetze, 4);
  assert.equal(erste.letzterSatz, "Denn wämmer d Ziit guet nutze!");
  const zwei = w[1];
  assert.equal(zwei.abgang, "geht ab");
  assert.deepEqual(zwei.schonDa, ["Vreni"]);
  const ruedi = meinWeg(gross, "ruedi");
  assert.equal(ruedi.find((x) => x.szene === "3.1").beginnt, true);
});
