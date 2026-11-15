// Hilfestufen vor dem Umdrehen (rein, testbar).
// 0 = nur Stichwort, 1 = Anfangsbuchstaben, 2 = Lückentext (jedes 3. Wort), 3 = ganzer Text.

export const HILFESTUFEN = [
  { id: 0, name: "Nur Stichwort", kurz: "Stichwort" },
  { id: 1, name: "Anfangsbuchstaben", kurz: "A b c" },
  { id: 2, name: "Lückentext", kurz: "Lücken" },
  { id: 3, name: "Ganzer Text", kurz: "Ganz" },
];

const WORT = /[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu;

/** "Ech chume grad, wart no chli." -> "E c g, w n c." (Satzzeichen bleiben, Absätze bleiben) */
export function anfangsbuchstaben(text) {
  return text.split("\n\n").map((absatz) =>
    absatz.replace(WORT, (w) => w[0]).replace(/[ \t]+/g, " ").trim()).join("\n\n");
}

/**
 * Lückentext: jedes n-te Wort wird zur Lücke.
 * Gibt Stücke zurück: [{typ: "text"|"luecke"|"absatz", text}] (Lücke enthält das Wort für die Länge).
 */
export function lueckentext(text, n = 3) {
  const out = [];
  let zaehler = 0;
  text.split("\n\n").forEach((absatz, ai) => {
    if (ai > 0) out.push({ typ: "absatz" });
    let last = 0;
    for (const m of absatz.matchAll(WORT)) {
      zaehler++;
      if (zaehler % n !== 0) continue;
      if (m.index > last) out.push({ typ: "text", text: absatz.slice(last, m.index) });
      out.push({ typ: "luecke", text: m[0] });
      last = m.index + m[0].length;
    }
    if (last < absatz.length) out.push({ typ: "text", text: absatz.slice(last) });
  });
  return out;
}
