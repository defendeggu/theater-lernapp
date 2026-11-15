// Ablauf-Quiz (rein, ohne DOM – testbar mit node --test).
// Alle Fragen werden aus stueck.enc (Szenen, Kurzfassungen, Personen, Repliken) für die
// gewählte Rolle erzeugt. Zufall über rng(), damit Tests reproduzierbar sind.
//
// Fragetypen (docs/PLAN.md, Abschnitt 6):
//  1 reihenfolge  Szenen eines Akts in die richtige Reihenfolge tippen
//  2 danach       «Was passiert nach Szene X?» – vier Kurzfassungen
//  3 ort          «Wo spielt Szene X?» – Lager oder Dorfplatz
//  4 personen     «Wer ist in Szene X auf der Bühne?» – Mehrfachauswahl
//  5 dabei        «Bist du in Szene X dabei?»
//  6 kurzfassung  «Zu welcher Szene gehört diese Kurzfassung?»
//  7 stichwort    «Wer spricht dein Stichwort?»
import { kartenFuer } from "./cards.js";

export const FRAGETYPEN = ["danach", "ort", "personen", "dabei", "kurzfassung", "stichwort"];
const ORT_NAME = { lager: "Lager der Fahrenden (Heitermatt)", dorf: "Dorfplatz" };

export function mischen(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const waehle = (arr, rng) => arr[Math.floor(rng() * arr.length)];

/** Erster Satz einer Kurzfassung als kurze Beschreibung. */
export function ersterSatz(text) {
  const m = text.match(/^.+?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

/** Alle Szenen flach, mit Akt, Sprechern (Figuren mit Text) und Ort-Typ. */
export function szenenListe(stueck) {
  const out = [];
  for (const a of stueck.akte) {
    for (const s of a.szenen) {
      const sprecher = new Set();
      for (const r of s.repliken) if (r.text) r.sprecher.forEach((x) => sprecher.add(x));
      const ortTyp = s.ort_typ ?? (/lager|heitermatt|zig/i.test(s.ort) ? "lager" : "dorf");
      out.push({ id: s.id, akt: a.nr, farbe: a.farbe, ort: s.ort, ortTyp, kurzfassung: s.kurzfassung ?? "",
        personen: s.personen, sprecher: [...sprecher] });
    }
  }
  return out;
}

const name = (stueck) => {
  const m = new Map(stueck.figuren.map((f) => [f.id, f.kurz ?? f.name]));
  return (id) => m.get(id) ?? id;
};

// --- Einzelne Fragetypen (geben null zurück, wenn für diese Rolle nicht möglich) ---

export function frageReihenfolge(stueck, akt, rng = Math.random) {
  const szenen = szenenListe(stueck).filter((s) => s.akt === akt);
  if (szenen.length < 2) return null;
  let items = mischen(szenen, rng);
  if (items.every((s, i) => s.id === szenen[i].id)) items = [...items.slice(1), items[0]]; // nie schon richtig
  return {
    typ: "reihenfolge", akt,
    frage: `Bring die Szenen von Akt ${akt} in die richtige Reihenfolge.`,
    optionen: items.map((s) => ({ id: s.id, text: ersterSatz(s.kurzfassung) || s.ort })),
    richtig: szenen.map((s) => s.id),
    aufloesung: szenen.map((s) => `${s.id}: ${ersterSatz(s.kurzfassung)}`).join("\n"),
  };
}

function frageDanach(stueck, s, alle, rng) {
  const i = alle.findIndex((x) => x.id === s.id);
  const naechste = alle[i + 1];
  if (!naechste || !naechste.kurzfassung) return null;
  const falsch = mischen(alle.filter((x) => x.id !== naechste.id && x.id !== s.id && x.kurzfassung), rng).slice(0, 3);
  if (falsch.length < 3) return null;
  return {
    typ: "danach", szene: s.id,
    frage: `Was passiert nach Szene ${s.id}?`,
    kontext: `Szene ${s.id}: ${ersterSatz(s.kurzfassung)}`,
    optionen: mischen([naechste, ...falsch], rng).map((x) => ({ id: x.id, text: ersterSatz(x.kurzfassung) })),
    richtig: [naechste.id],
    aufloesung: `Danach kommt Szene ${naechste.id}: ${ersterSatz(naechste.kurzfassung)}`,
  };
}

function frageOrt(stueck, s) {
  return {
    typ: "ort", szene: s.id,
    frage: `Wo spielt Szene ${s.id}?`,
    kontext: ersterSatz(s.kurzfassung),
    optionen: [{ id: "lager", text: ORT_NAME.lager }, { id: "dorf", text: ORT_NAME.dorf }],
    richtig: [s.ortTyp],
    aufloesung: `Szene ${s.id} spielt hier: ${s.ort}.`,
  };
}

function fragePersonen(stueck, s, rng) {
  const n = name(stueck);
  const sprechrollen = stueck.figuren.map((f) => f.id);
  const richtig = s.sprecher.filter((id) => sprechrollen.includes(id));
  if (!richtig.length) return null;
  const andere = mischen(sprechrollen.filter((id) => !richtig.includes(id)), rng);
  const anzahl = Math.min(sprechrollen.length, Math.max(6, richtig.length + 2));
  const optionen = mischen([...richtig, ...andere.slice(0, anzahl - richtig.length)], rng);
  return {
    typ: "personen", szene: s.id, mehrfach: true,
    frage: `Wer spricht in Szene ${s.id}? (alle antippen)`,
    kontext: ersterSatz(s.kurzfassung),
    optionen: optionen.map((id) => ({ id, text: n(id) })),
    richtig,
    aufloesung: `In Szene ${s.id} sprechen: ${richtig.map(n).join(", ")}.`,
  };
}

function frageDabei(stueck, s, rolle) {
  const ja = s.sprecher.includes(rolle);
  return {
    typ: "dabei", szene: s.id,
    frage: `Bist du in Szene ${s.id} dabei?`,
    kontext: ersterSatz(s.kurzfassung),
    optionen: [{ id: "ja", text: "Ja, ich spreche" }, { id: "nein", text: "Nein" }],
    richtig: [ja ? "ja" : "nein"],
    aufloesung: ja ? `Ja – du sprichst in Szene ${s.id}.` : `Nein – in Szene ${s.id} sprichst du nicht.`,
  };
}

function frageKurzfassung(stueck, s, alle, rng) {
  if (!s.kurzfassung) return null;
  // ähnliche Szenen als falsche Antworten: gleicher Akt bevorzugt
  const gleicherAkt = mischen(alle.filter((x) => x.akt === s.akt && x.id !== s.id), rng);
  const rest = mischen(alle.filter((x) => x.akt !== s.akt), rng);
  const falsch = [...gleicherAkt, ...rest].slice(0, 3);
  if (falsch.length < 3) return null;
  return {
    typ: "kurzfassung", szene: s.id,
    frage: "Zu welcher Szene gehört diese Kurzfassung?",
    kontext: s.kurzfassung,
    optionen: mischen([s, ...falsch], rng).map((x) => ({ id: x.id, text: `Szene ${x.id} · ${x.ort}` })),
    richtig: [s.id],
    aufloesung: `Das ist Szene ${s.id} (${s.ort}).`,
  };
}

function frageStichwort(stueck, karte, rng) {
  const sw = karte.stichwort;
  if (!sw || sw.eigen || !sw.sprecher) return null;
  const n = name(stueck);
  const andereNamen = [...new Set(stueck.figuren.map((f) => n(f.id)))].filter((x) => x !== sw.sprecher);
  const falsch = mischen(andereNamen, rng).slice(0, 3);
  if (falsch.length < 3) return null;
  return {
    typ: "stichwort", szene: karte.szene, karte: karte.id,
    frage: "Wer spricht dein Stichwort?",
    kontext: `«${sw.text}»`,
    optionen: mischen([sw.sprecher, ...falsch], rng).map((x) => ({ id: x, text: x })),
    richtig: [sw.sprecher],
    aufloesung: `Das sagt ${sw.sprecher} (Szene ${karte.szene}).`,
  };
}

/**
 * Gemischtes Quiz für eine Rolle.
 * Bevorzugt Szenen der Rolle (ca. 2/3), mischt Fragetypen gleichmässig.
 */
export function erzeugeQuiz(stueck, rolle, { anzahl = 10, rng = Math.random } = {}) {
  const alle = szenenListe(stueck);
  const eigene = alle.filter((s) => s.sprecher.includes(rolle));
  const karten = kartenFuer(stueck, rolle).filter((k) => k.stichwort && !k.stichwort.eigen && !k.teil);
  const fragen = [];
  const gesehen = new Set();
  let versuche = 0;
  let typIndex = Math.floor(rng() * FRAGETYPEN.length);
  while (fragen.length < anzahl && versuche < anzahl * 20) {
    versuche++;
    const typ = FRAGETYPEN[typIndex++ % FRAGETYPEN.length];
    const s = eigene.length && rng() < 0.67 ? waehle(eigene, rng) : waehle(alle, rng);
    let f = null;
    if (typ === "danach") f = frageDanach(stueck, s, alle, rng);
    else if (typ === "ort") f = frageOrt(stueck, s);
    else if (typ === "personen") f = fragePersonen(stueck, s, rng);
    else if (typ === "dabei") f = frageDabei(stueck, waehle(alle, rng), rolle);
    else if (typ === "kurzfassung") f = frageKurzfassung(stueck, s, alle, rng);
    else if (typ === "stichwort" && karten.length) f = frageStichwort(stueck, waehle(karten, rng), rng);
    if (!f) continue;
    const schluessel = `${f.typ}|${f.szene}|${f.karte ?? ""}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    fragen.push(f);
  }
  return fragen;
}

/** Antwort prüfen. Reihenfolge: Liste in Reihenfolge; sonst Menge der gewählten IDs. */
export function pruefen(frage, antwort) {
  const a = [...antwort];
  if (frage.typ === "reihenfolge") return a.length === frage.richtig.length && a.every((x, i) => x === frage.richtig[i]);
  const r = new Set(frage.richtig);
  return a.length === r.size && a.every((x) => r.has(x));
}

/** Für Reihenfolge: wie viele Positionen stimmen (für Teilpunkte in der Anzeige). */
export function richtigePositionen(frage, antwort) {
  return antwort.filter((x, i) => frage.richtig[i] === x).length;
}

// --- «Mein Weg durchs Stück» ------------------------------------------------------
const ABGANG = /\b(ab|abgang|hinaus|verschwindet|verschwinden)\b/i;

/** Pro eigene Szene: wer ist da, erstes Stichwort, letzter eigener Satz, Abgang aus der Regie. */
export function meinWeg(stueck, rolle) {
  const n = name(stueck);
  const karten = kartenFuer(stueck, rolle).filter((k) => !k.teil);
  const out = [];
  for (const a of stueck.akte) {
    for (const s of a.szenen) {
      const eigene = s.repliken.filter((r) => r.text && r.sprecher.includes(rolle));
      if (!eigene.length) continue;
      const ersteKarte = karten.find((k) => k.replikId === eigene[0].id);
      const letzte = eigene[eigene.length - 1];
      const andere = [...new Set(s.repliken.filter((r) => r.text).flatMap((r) => r.sprecher))].filter((x) => x !== rolle);
      const vorher = [...new Set(s.repliken.slice(0, s.repliken.indexOf(eigene[0])).filter((r) => r.text).flatMap((r) => r.sprecher))]
        .filter((x) => x !== rolle);
      const regieAb = [
        ...letzte.regie.map((r) => r.text),
        ...s.regie.filter((r) => r.nach === letzte.id).map((r) => r.text),
      ].find((t) => ABGANG.test(t)) ?? null;
      out.push({
        akt: a.nr, farbe: a.farbe, szene: s.id, ort: s.ort, kurzfassung: s.kurzfassung ?? "",
        einsaetze: eigene.length,
        schonDa: vorher.map(n),
        mitspieler: andere.map(n),
        erstesStichwort: ersteKarte?.stichwort ? { sprecher: ersteKarte.stichwort.eigen ? "du" : ersteKarte.stichwort.sprecher, text: ersteKarte.stichwort.text } : null,
        beginnt: !ersteKarte?.stichwort,
        letzterSatz: letzte.text.split(/(?<=[.!?…])\s+/).filter(Boolean).pop() ?? letzte.text,
        abgang: regieAb,
      });
    }
  }
  return out;
}
