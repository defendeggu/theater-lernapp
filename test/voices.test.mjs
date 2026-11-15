import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stimmenVorname, stimmenQualitaet, sprachRang, deutscheStimmen, zuteilen, sprechText, sprechStuecke, sprechPause,
} from "../public/js/voices.js";

const v = (name, lang = "de-DE", extra = {}) => ({ name, lang, voiceURI: "uri:" + name, localService: true, ...extra });

const FIGUREN = [
  { id: "joe", geschlecht: "m", alter: "erwachsen", einsaetze: 155 },
  { id: "alina", geschlecht: "w", alter: "erwachsen", einsaetze: 119 },
  { id: "jakob", geschlecht: "m", alter: "erwachsen", einsaetze: 91 },
  { id: "heinrich", geschlecht: "m", alter: "erwachsen", einsaetze: 90 },
  { id: "leonie", geschlecht: "w", alter: "erwachsen", einsaetze: 46 },
  { id: "burkard", geschlecht: "m", alter: "jugendlich", einsaetze: 53 },
  { id: "maria", geschlecht: "w", alter: "kind", einsaetze: 10 },
];

test("Stimmen-Namen erkennen", () => {
  assert.equal(stimmenVorname("Anna (Erweitert)"), "anna");
  assert.equal(stimmenVorname("Petra (Premium)"), "petra");
  assert.equal(stimmenVorname("Microsoft Katja - German (Germany)"), "katja");
  assert.equal(stimmenVorname("Microsoft Conrad Online (Natural) - German (Germany)"), "conrad");
  assert.equal(stimmenVorname("Eddy (Deutsch (Deutschland))"), "eddy");
  assert.equal(stimmenVorname("Google Deutsch"), "google deutsch");
  assert.equal(stimmenQualitaet("Petra (Premium)"), 3);
  assert.equal(stimmenQualitaet("Anna (Enhanced)"), 2);
  assert.equal(stimmenQualitaet("Anna"), 1);
  assert.deepEqual(["de-CH", "de_DE", "de-AT", "de-LU", "en-US"].map(sprachRang), [0, 1, 2, 3, 9]);
});

test("deutsche Stimmen: filtern, Geschlecht, beste zuerst, Overrides", () => {
  const s = deutscheStimmen([
    v("Samantha", "en-US"), v("Anna"), v("Anna (Erweitert)"), v("Markus", "de-AT"), v("Yannick", "de-CH"), v("Zorro"),
  ], { "uri:Zorro": "m" });
  assert.deepEqual(s.map((x) => x.name), ["Anna (Erweitert)", "Yannick", "Anna", "Zorro", "Markus"]); // de-DE vor de-AT
  assert.deepEqual(s.map((x) => x.geschlecht), ["w", "m", "w", "m", "m"]);
});

test("beide Geschlechter: passende Stimme, Hauptrollen zuerst, Kinder höher", () => {
  const st = deutscheStimmen([v("Anna"), v("Petra"), v("Markus"), v("Yannick")]);
  const { zuteilung: z, fehlt, keineDeutsche } = zuteilen(FIGUREN, st);
  assert.deepEqual(fehlt, []);
  assert.equal(keineDeutsche, false);
  for (const f of FIGUREN) {
    const g = st.find((s) => s.id === z.get(f.id).stimme).geschlecht;
    assert.equal(g, f.geschlecht, f.id);
    assert.equal(z.get(f.id).ersatz, false);
  }
  // Männer nach Einsätzen: Joe, Jakob, Heinrich, Burkard -> 2 Stimmen reihum, ab der 3. Figur andere Tonhöhe
  assert.notEqual(z.get("joe").stimme, z.get("jakob").stimme);
  assert.equal(z.get("joe").stimme, z.get("heinrich").stimme);
  assert.notDeepEqual([z.get("joe").pitch, z.get("joe").rate], [z.get("heinrich").pitch, z.get("heinrich").rate]);
  assert.ok(z.get("maria").pitch > 1.2);            // Kind höher
  assert.ok(z.get("burkard").pitch > 1);            // Jugendlicher höher
});

test("alle Männerfiguren unterscheidbar (Stimme + pitch/rate eindeutig)", () => {
  const maenner = Array.from({ length: 8 }, (_, i) => ({ id: "m" + i, geschlecht: "m", alter: "erwachsen", einsaetze: 10 - i }));
  const { zuteilung } = zuteilen(maenner, deutscheStimmen([v("Markus"), v("Yannick")]));
  const kombis = new Set([...zuteilung.values()].map((x) => `${x.stimme}|${x.pitch}|${x.rate}`));
  assert.equal(kombis.size, 8);
});

test("nur Frauenstimmen: Männer bekommen verstellte Frauenstimme + Hinweis", () => {
  const { zuteilung: z, fehlt } = zuteilen(FIGUREN, deutscheStimmen([v("Anna"), v("Helena")]));
  assert.deepEqual(fehlt, ["m"]);
  assert.equal(z.get("joe").ersatz, true);
  assert.ok(z.get("joe").pitch < 0.8);
  assert.equal(z.get("alina").ersatz, false);
});

test("nur Männerstimmen: Frauen bekommen verstellte Männerstimme + Hinweis", () => {
  const { zuteilung: z, fehlt } = zuteilen(FIGUREN, deutscheStimmen([v("Markus")]));
  assert.deepEqual(fehlt, ["w"]);
  assert.equal(z.get("alina").ersatz, true);
  assert.ok(z.get("alina").pitch > 1.3);
  assert.equal(z.get("joe").ersatz, false);
});

test("viele Stimmen: jede Figur eine eigene Stimme", () => {
  const st = deutscheStimmen(["Anna", "Petra", "Helena", "Katja", "Markus", "Yannick", "Martin", "Viktor"].map((n) => v(n)));
  const { zuteilung } = zuteilen(FIGUREN, st);
  const stimmen = [...zuteilung.values()].map((x) => x.stimme);
  assert.equal(new Set(stimmen).size, FIGUREN.length);
  assert.equal(zuteilung.get("joe").pitch, 1);      // genug Stimmen: keine Verstellung bei Erwachsenen
});

test("keine deutsche Stimme: Systemstimme mit Tonhöhen", () => {
  const { zuteilung, keineDeutsche, fehlt } = zuteilen(FIGUREN, deutscheStimmen([v("Samantha", "en-US")]));
  assert.equal(keineDeutsche, true);
  assert.deepEqual(fehlt, []);
  assert.equal(zuteilung.get("joe").stimme, null);
  assert.equal(zuteilung.get("joe").lang, "de-DE");
});

test("unbekannte Stimme springt ein, wenn ein Geschlecht fehlt", () => {
  const { zuteilung: z, fehlt } = zuteilen(FIGUREN, deutscheStimmen([v("Anna"), v("Zorro")]));
  assert.deepEqual(fehlt, []);
  assert.equal(z.get("joe").stimme, "uri:Zorro");
  assert.equal(z.get("joe").ersatz, false);
});

test("stabil: gleiche Zuteilung unabhängig von der Reihenfolge der Stimmen", () => {
  const a = ["Anna", "Petra", "Markus", "Yannick"].map((n) => v(n));
  const z1 = zuteilen(FIGUREN, deutscheStimmen(a)).zuteilung;
  const z2 = zuteilen([...FIGUREN].reverse(), deutscheStimmen([...a].reverse())).zuteilung;
  for (const f of FIGUREN) assert.deepEqual(z1.get(f.id), z2.get(f.id));
});

test("manuelle Wahl pro Figur hat Vorrang", () => {
  const st = deutscheStimmen([v("Anna"), v("Markus"), v("Yannick")]);
  const { zuteilung: z } = zuteilen(FIGUREN, st, { joe: { stimme: "uri:Yannick", pitch: 0.7 }, alina: { stimme: "uri:gibtsnicht" } });
  assert.equal(z.get("joe").stimme, "uri:Yannick");
  assert.equal(z.get("joe").pitch, 0.7);
  assert.equal(z.get("alina").stimme, "uri:Anna");  // unbekannte Wahl wird ignoriert
});

test("Sprechtext und Stücke", () => {
  assert.equal(sprechText("Jo… «sicher» ** gäll?\n\nNei!"), "Jo, sicher gäll? Nei!");
  const lang = "Eis zwei drü. ".repeat(30);
  const st = sprechStuecke(lang, 100);
  assert.ok(st.length > 3 && st.every((x) => x.length <= 100));
  assert.equal(st.join(" "), sprechText(lang));
  assert.equal(sprechPause("eis"), 2500);
  assert.equal(sprechPause("w ".repeat(20)), 9000);
  assert.equal(sprechPause("w ".repeat(200)), 25000);
});
