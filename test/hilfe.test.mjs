import { test } from "node:test";
import assert from "node:assert/strict";
import { anfangsbuchstaben, lueckentext, HILFESTUFEN } from "../public/js/hilfe.js";

test("vier Hilfestufen", () => {
  assert.deepEqual(HILFESTUFEN.map((s) => s.name), ["Nur Stichwort", "Anfangsbuchstaben", "Lückentext", "Ganzer Text"]);
});

test("Anfangsbuchstaben: Satzzeichen und Absätze bleiben", () => {
  assert.equal(anfangsbuchstaben("Ech chume grad, wart no chli."), "E c g, w n c.");
  assert.equal(anfangsbuchstaben("Jo! Öppis Übels… «Sicher»?"), "J! Ö Ü… «S»?");
  assert.equal(anfangsbuchstaben("D’Bewilligung isch do.\n\nZweite Absatz"), "D i d.\n\nZ A");
  assert.equal(anfangsbuchstaben("Am 3. Tag – 20 Franke"), "A 3. T – 2 F");
});

test("Lückentext: jedes 3. Wort fehlt", () => {
  const s = lueckentext("eis zwei drü vier füf sächs sibe");
  assert.deepEqual(s, [
    { typ: "text", text: "eis zwei " },
    { typ: "luecke", text: "drü" },
    { typ: "text", text: " vier füf " },
    { typ: "luecke", text: "sächs" },
    { typ: "text", text: " sibe" },
  ]);
});

test("Lückentext: zählt über Absätze weiter, Satzzeichen bleiben stehen", () => {
  const s = lueckentext("Eis, zwei.\n\nDrü vier!");
  assert.deepEqual(s, [
    { typ: "text", text: "Eis, zwei." },
    { typ: "absatz" },
    { typ: "luecke", text: "Drü" },
    { typ: "text", text: " vier!" },
  ]);
  assert.equal(lueckentext("a b c d e f", 2).filter((x) => x.typ === "luecke").length, 3);
});
