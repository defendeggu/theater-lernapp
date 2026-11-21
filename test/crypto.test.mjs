// Tests für public/js/crypto.js und tools/encrypt.mjs (erfundene Beispieldaten).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encrypt, decryptWithPassword, decryptWithKey, deriveKey, parseHeader, WrongKeyError, ITERATIONS,
} from "../public/js/crypto.js";
import { buildPayload, passwortPruefen } from "../tools/encrypt.mjs";

const FAST = { iterations: 1000 }; // Tests schnell halten; App/Werkzeug nutzen 600000

const beispiel = {
  titel: "Testspiel",
  figuren: [
    { id: "ruedi", name: "Ruedi Bachmann", kurz: "Ruedi", geschlecht: "m", alter: "erwachsen",
      beschreibung: "Müller", gruppe: "dorf", einsaetze_ca: 2, sprechrolle: true, unsicher: ["x"] },
    { id: "toni", name: "Toni", kurz: "Toni", geschlecht: "m", alter: "kind",
      beschreibung: "Statist", gruppe: "jugendliche", einsaetze_ca: null, sprechrolle: false, unsicher: [] },
  ],
  akte: [{ nr: 1, farbe: "#E8B10E", szenen: [{
    id: "1.1", ort: "Mühle", personen: ["ruedi"], personen_text: "Ruedi", unsicher: [],
    regie: [{ nach: null, text: "Morgen." }],
    repliken: [{ id: "1.1-001", seite: 10, seite_nr: 1, sprecher: ["ruedi"], sammel: null,
      text: "Grüezi mitenand – äöü «»", regie: [], hash: "abcd1234", unsicher: [] }],
  }] }],
};
const ablauf = { szenen: [{ id: "1.1", ort_typ: "dorf", kurzfassung: "Ruedi grüsst." }] };

test("Rundreise: verschlüsseln und mit Passwort entschlüsseln", async () => {
  const bytes = await encrypt(beispiel, "geheim-123", FAST);
  const { data, key } = await decryptWithPassword(bytes, "geheim-123");
  assert.deepEqual(data, beispiel);
  // gespeicherter Schlüssel funktioniert ohne Passwort
  assert.deepEqual(await decryptWithKey(bytes, key), beispiel);
});

test("Kopf enthält Magic, Version, Iterationen, Salt und IV", async () => {
  const bytes = await encrypt(beispiel, "pw", FAST);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "EVB1");
  const h = parseHeader(bytes);
  assert.equal(h.version, 1);
  assert.equal(h.iterations, 1000);
  assert.equal(h.salt.length, 16);
  assert.equal(h.iv.length, 12);
  assert.equal(ITERATIONS, 600000);
});

test("Salt und IV sind zufällig", async () => {
  const a = parseHeader(await encrypt(beispiel, "pw", FAST));
  const b = parseHeader(await encrypt(beispiel, "pw", FAST));
  assert.notDeepEqual(a.salt, b.salt);
  assert.notDeepEqual(a.iv, b.iv);
});

test("falsches Passwort wirft WrongKeyError", async () => {
  const bytes = await encrypt(beispiel, "richtig", FAST);
  await assert.rejects(decryptWithPassword(bytes, "falsch"), WrongKeyError);
});

test("alter Schlüssel passt nach neuer Verschlüsselung (neuer Salt) nicht mehr", async () => {
  const alt = await encrypt(beispiel, "pw", FAST);
  const key = (await decryptWithPassword(alt, "pw")).key;
  const neu = await encrypt(beispiel, "pw", FAST);
  await assert.rejects(decryptWithKey(neu, key), WrongKeyError);
});

test("manipulierte Daten werden erkannt", async () => {
  const bytes = await encrypt(beispiel, "pw", FAST);
  bytes[bytes.length - 1] ^= 1;
  const key = await deriveKey("pw", parseHeader(bytes).salt, 1000);
  await assert.rejects(decryptWithKey(bytes, key), WrongKeyError);
});

test("fremde Datei wird abgelehnt", () => {
  assert.throws(() => parseHeader(new Uint8Array(100)), /Keine EVB-Datei/);
});

test("buildPayload: nur Sprechrollen, keine Review-Felder, Kurzfassung eingefügt", async () => {
  const p = buildPayload(beispiel, ablauf, "2026-11-15T00:00:00.000Z");
  assert.equal(p.format, 1);
  assert.deepEqual(p.figuren.map((f) => f.id), ["ruedi"]);
  assert.equal("unsicher" in p.figuren[0], false);
  const sz = p.akte[0].szenen[0];
  assert.equal(sz.kurzfassung, "Ruedi grüsst.");
  assert.equal(sz.ort_typ, "dorf");
  assert.equal("unsicher" in sz, false);
  assert.deepEqual(Object.keys(sz.repliken[0]).sort(), ["hash", "id", "regie", "sammel", "sprecher", "text"]);
  // und lässt sich verschlüsseln + entschlüsseln
  const bytes = await encrypt(p, "pw", FAST);
  assert.deepEqual((await decryptWithPassword(bytes, "pw")).data, p);
});

test("Passwort-Prüfung gegen die bisherige Datei (Schutz vor Tippfehlern)", async () => {
  const bisher = await encrypt(beispiel, "ensemble-pw", FAST);
  assert.equal(await passwortPruefen(bisher, "ensemble-pw"), "gleich");
  assert.equal(await passwortPruefen(bisher, "ensemble-pv"), "anders");
  assert.equal(await passwortPruefen(null, "egal"), "keine-datei");
  assert.equal(await passwortPruefen(new Uint8Array(0), "egal"), "keine-datei");
  assert.equal(await passwortPruefen(new Uint8Array(100), "egal"), "unlesbar");
});
