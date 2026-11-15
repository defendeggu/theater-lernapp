// Karten für eine Rolle bauen (rein, ohne DOM – testbar mit node --test).
//
// Regeln (docs/PLAN.md, «Karten bauen»):
// - Jede Replik mit Text, bei der die Rolle unter den Sprechern ist, ergibt eine Karte,
//   auch Sammelrepliken (Hinweis «gemeinsam mit …»).
// - Stichwort = die Replik mit Text direkt davor in der Szene. Das ist normalerweise eine
//   andere Figur; spricht die Rolle zweimal hintereinander, ist es die eigene Zeile davor.
//   Der letzte Satz des Stichworts wird fett gezeigt.
// - Erste Karte der Rolle in einer Szene: zusätzlich der Szenenkopf.
// - Lange Repliken (> LANG_WOERTER) mit Absätzen: zusätzlich Teilkarten pro Abschnitt,
//   jeweils mit dem vorherigen Abschnitt als Stichwort. Reihenfolge: Teile, dann ganze Replik.

export const LANG_WOERTER = 60;
export const MIN_TEIL_WOERTER = 12;

const woerter = (t) => (t.match(/\S+/g) || []).length;

/** Index, ab dem der letzte Satz beginnt. */
export function letzterSatzAb(text) {
  const t = text.trimEnd();
  const re = /[.!?…]+[»"”')]*\s+/g;
  let ab = 0;
  let m;
  while ((m = re.exec(t)) !== null) {
    const ende = m.index + m[0].length;
    if (ende < t.length) ab = ende;
  }
  return ab;
}

/** Teilt einen Text an Absätzen in Abschnitte mit mindestens MIN_TEIL_WOERTER Wörtern. */
export function abschnitte(text) {
  const paras = [];
  let pos = 0;
  for (const p of text.split("\n\n")) {
    paras.push({ start: pos, end: pos + p.length, text: p });
    pos += p.length + 2;
  }
  const gruppen = [];
  for (const p of paras) {
    const last = gruppen[gruppen.length - 1];
    if (last && woerter(last.text) < MIN_TEIL_WOERTER) {
      last.end = p.end;
      last.text = text.slice(last.start, last.end);
    } else {
      gruppen.push({ ...p });
    }
  }
  // zu kurzer letzter Abschnitt an den vorherigen hängen
  if (gruppen.length > 1 && woerter(gruppen[gruppen.length - 1].text) < MIN_TEIL_WOERTER) {
    const z = gruppen.pop();
    const v = gruppen[gruppen.length - 1];
    v.end = z.end;
    v.text = text.slice(v.start, v.end);
  }
  return gruppen;
}

function regieIn(regie, start, end, istLetzter) {
  return regie
    .filter((r) => r.pos >= start && (r.pos < end || (istLetzter && r.pos <= end)))
    .map((r) => ({ pos: r.pos - start, text: r.text }));
}

/**
 * Baut alle Karten einer Rolle in Stückreihenfolge.
 * @param {object} stueck  entschlüsselte Daten
 * @param {string} rolle   Figuren-ID
 */
export function kartenFuer(stueck, rolle) {
  const figs = new Map(stueck.figuren.map((f) => [f.id, f]));
  const name = (id) => figs.get(id)?.kurz ?? id;
  const karten = [];

  for (const akt of stueck.akte) {
    for (const sz of akt.szenen) {
      let ersteInSzene = true;
      const reps = sz.repliken;
      for (let i = 0; i < reps.length; i++) {
        const rep = reps[i];
        if (!rep.text || !rep.sprecher.includes(rolle)) continue;

        let vorher = null;
        for (let j = i - 1; j >= 0; j--) {
          if (reps[j].text) { vorher = reps[j]; break; }
        }
        const stichwort = vorher && {
          sprecher: vorher.sammel ?? vorher.sprecher.map(name).join(", "),
          eigen: vorher.sprecher.includes(rolle),
          text: vorher.text,
          fettAb: letzterSatzAb(vorher.text),
        };
        const andere = sz.personen.filter((p) => p !== rolle).map(name);
        const kopf = ersteInSzene || !vorher
          ? `Szene ${sz.id} – ${sz.ort}${andere.length ? " – mit " + andere.join(", ") : ""}`
          : null;
        ersteInSzene = false;

        const basis = {
          replikId: rep.id,
          akt: akt.nr,
          farbe: akt.farbe,
          szene: sz.id,
          ort: sz.ort,
          kopf,
          gemeinsamMit: rep.sprecher.filter((s) => s !== rolle).map(name),
          sammel: rep.sammel,
          hash: rep.hash,
        };

        const teile = woerter(rep.text) > LANG_WOERTER ? abschnitte(rep.text) : [];
        if (teile.length > 1) {
          teile.forEach((t, k) => {
            const vorTeil = teile[k - 1];
            karten.push({
              ...basis,
              id: `${rep.id}#${k + 1}`,
              teil: { nr: k + 1, von: teile.length },
              kopf: k === 0 ? kopf : null,
              stichwort: k === 0 ? stichwort : {
                sprecher: name(rolle), eigen: true, text: vorTeil.text, fettAb: letzterSatzAb(vorTeil.text),
              },
              text: t.text,
              regie: regieIn(rep.regie, t.start, t.end, k === teile.length - 1),
            });
          });
        }
        karten.push({ ...basis, id: rep.id, teil: null, stichwort, text: rep.text, regie: rep.regie });
      }
    }
  }
  return karten;
}

/** Index der ersten Karte ab einer Szene (z.B. "2.3"), sonst 0. */
export function indexAbSzene(karten, szeneId) {
  const [a, s] = szeneId.split(".").map(Number);
  const i = karten.findIndex((k) => {
    const [ka, ks] = k.szene.split(".").map(Number);
    return ka > a || (ka === a && ks >= s);
  });
  return i < 0 ? 0 : i;
}

/** Text + Regie in Stücke zerlegen: [{typ: "text"|"regie"|"absatz", text}] zum Rendern. */
export function textStuecke(text, regie = []) {
  const out = [];
  const marken = [...regie].sort((a, b) => a.pos - b.pos);
  let last = 0;
  const pushText = (t) => {
    t.split("\n\n").forEach((teil, i) => {
      if (i > 0) out.push({ typ: "absatz" });
      if (teil) out.push({ typ: "text", text: teil });
    });
  };
  for (const r of marken) {
    if (r.text.startsWith("*")) continue; // Marken *1 / ** sind für Regie/Technik, nicht für Spielende
    pushText(text.slice(last, r.pos));
    out.push({ typ: "regie", text: r.text });
    last = r.pos;
  }
  pushText(text.slice(last));
  return out;
}
