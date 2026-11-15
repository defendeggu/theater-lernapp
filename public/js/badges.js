// Badges (rein, ohne DOM – testbar mit node --test).
// Werden nur aus dem gespeicherten Lernstand EINER Rolle berechnet. Bedingungen sind rollenneutral:
// wo nötig Anteile bzw. min(Ziel, Anzahl Karten), damit es für 4 wie für 155 Einsätze passt.
import { zustand, addTage } from "./leitner.js";

/** Längste Serie aufeinanderfolgender Lerntage. */
export function laengsteSerie(tage = {}) {
  const set = new Set(Object.keys(tage).filter((t) => tage[t] > 0));
  let best = 0;
  for (const t of set) {
    if (set.has(addTage(t, -1))) continue; // nur ab Serienbeginn zählen
    let n = 0, x = t;
    while (set.has(x)) { n++; x = addTage(x, 1); }
    best = Math.max(best, n);
  }
  return best;
}

const fach = (k, ctx) => {
  const z = zustand(k, ctx.fortschritt.get(k.id), ctx.heute);
  return z.neu ? 0 : z.fach;
};
const alleAb = (karten, min, ctx) => karten.length > 0 && karten.every((k) => fach(k, ctx) >= min);
const anteil = (karten, min, ctx) => [karten.filter((k) => fach(k, ctx) >= min).length, karten.length];

/**
 * Badge-Definitionen. pruefe(ctx) -> { ok, ist, ziel } ; nurWenn(ctx) blendet Badges aus,
 * die für die Rolle keinen Sinn ergeben (z.B. Akt ohne eigene Karten).
 */
export const BADGES = [
  { id: "vorhang", name: "Vorhang auf", symbol: "🎭", text: "Die erste Karte gelernt.",
    pruefe: (c) => ({ ok: c.fortschritt.size > 0, ist: Math.min(1, c.fortschritt.size), ziel: 1 }) },
  { id: "szene", name: "Szene sitzt", symbol: "🎬", text: "Eine ganze Szene sitzt (alle Karten ab Fach 3).",
    pruefe: (c) => {
      const proSzene = new Map();
      for (const k of c.karten) { if (!proSzene.has(k.szene)) proSzene.set(k.szene, []); proSzene.get(k.szene).push(k); }
      let best = 0;
      for (const ks of proSzene.values()) { const [a, n] = anteil(ks, 3, c); best = Math.max(best, a / n); }
      return { ok: [...proSzene.values()].some((ks) => alleAb(ks, 3, c)), ist: Math.round(best * 100), ziel: 100, prozent: true };
    } },
  ...[1, 2, 3].map((akt) => ({
    id: `akt${akt}`, name: `Akt ${akt} sitzt`, symbol: ["🟡", "🟠", "🔴"][akt - 1], akt,
    text: `Alle deine Karten in Akt ${akt} ab Fach 4.`,
    nurWenn: (c) => c.karten.some((k) => k.akt === akt),
    pruefe: (c) => {
      const ks = c.karten.filter((k) => k.akt === akt);
      const [a, n] = anteil(ks, 4, c);
      return { ok: alleAb(ks, 4, c), ist: a, ziel: n };
    },
  })),
  { id: "textfest", name: "Textfest", symbol: "📜", text: "Alle Karten in Fach 5 – bereit für die Probe ohne Textbuch.",
    pruefe: (c) => { const [a, n] = anteil(c.karten, 5, c); return { ok: alleAb(c.karten, 5, c), ist: a, ziel: n }; } },
  { id: "fuerfescht", name: "Füürfescht", symbol: "🔥", text: "7 Tage in Folge gelernt.",
    pruefe: (c) => ({ ok: c.serieMax >= 7, ist: Math.min(7, c.serieMax), ziel: 7 }) },
  { id: "dauerbrenner", name: "Dauerbrenner", symbol: "🕯️", text: "30 Tage in Folge gelernt.",
    pruefe: (c) => ({ ok: c.serieMax >= 30, ist: Math.min(30, c.serieMax), ziel: 30 }) },
  { id: "schmiedeeisern", name: "Schmiedeeisern", symbol: "⚒️", text: "100 Tage in Folge gelernt.",
    pruefe: (c) => ({ ok: c.serieMax >= 100, ist: Math.min(100, c.serieMax), ziel: 100 }) },
  { id: "ablaufprofi", name: "Ablauf-Profi", symbol: "🧭", text: "Ein gemischtes Ablauf-Quiz mit allen Antworten richtig.",
    pruefe: (c) => ({ ok: c.quiz.some((q) => q.art === "mix" && q.gesamt >= 10 && q.richtig === q.gesamt), ist: 0, ziel: 1 }) },
  { id: "regieassistenz", name: "Regieassistenz", symbol: "📋", text: "Alle Szenen jedes Akts in die richtige Reihenfolge gebracht.",
    pruefe: (c) => {
      const akte = c.akte.filter((a) => a.szenen > 1).map((a) => a.nr);
      const geschafft = akte.filter((a) => c.quiz.some((q) => q.art === "reihenfolge" && q.akt === a && q.richtig === q.gesamt));
      return { ok: akte.length > 0 && geschafft.length === akte.length, ist: geschafft.length, ziel: akte.length };
    } },
  { id: "ohrwurm", name: "Ohrwurm", symbol: "🎧", text: "10 Hörproben bis zum Schluss gehört.",
    pruefe: (c) => ({ ok: c.hoerproben >= 10, ist: Math.min(10, c.hoerproben), ziel: 10 }) },
  { id: "nachteule", name: "Nachteule", symbol: "🦉", text: "Nach 22 Uhr gelernt.",
    pruefe: (c) => ({ ok: !!c.meta.nachteule, ist: c.meta.nachteule ? 1 : 0, ziel: 1 }) },
  { id: "fruehaufsteher", name: "Frühaufsteher/in", symbol: "🌅", text: "Vor 7 Uhr morgens gelernt.",
    pruefe: (c) => ({ ok: !!c.meta.fruehaufsteher, ist: c.meta.fruehaufsteher ? 1 : 0, ziel: 1 }) },
  { id: "marathon", name: "Marathon", symbol: "🏃", text: "An einem Tag sehr viele Karten bewertet (100 oder alle deine Karten).",
    pruefe: (c) => {
      const ziel = Math.min(100, c.karten.length);
      const max = Math.max(0, ...Object.values(c.meta.tage ?? {}));
      return { ok: ziel > 0 && max >= ziel, ist: Math.min(max, ziel), ziel };
    } },
  { id: "ohnesouffleuse", name: "Ohne Souffleuse", symbol: "🤫", text: "Viele Karten in Folge ohne Hilfe gewusst (20 oder alle deine Karten).",
    pruefe: (c) => {
      const ziel = Math.min(20, c.karten.length);
      const max = c.meta.ohneHilfeMax ?? 0;
      return { ok: ziel > 0 && max >= ziel, ist: Math.min(max, ziel), ziel };
    } },
];

/** Kontext für die Berechnung. */
export function badgeKontext({ stueck, karten, fortschritt, meta, heute }) {
  return {
    karten, fortschritt, heute,
    meta: meta ?? {},
    quiz: meta?.quiz ?? [],
    hoerproben: meta?.hoerproben ?? 0,
    serieMax: laengsteSerie(meta?.tage ?? {}),
    akte: (stueck?.akte ?? []).map((a) => ({ nr: a.nr, szenen: a.szenen.length })),
  };
}

/** Alle (für die Rolle sinnvollen) Badges mit Stand und Datum (aus meta.badges). */
export function berechneBadges(ctx) {
  const datum = ctx.meta.badges ?? {};
  return BADGES.filter((b) => !b.nurWenn || b.nurWenn(ctx)).map((b) => {
    const r = b.pruefe(ctx);
    return { id: b.id, name: b.name, symbol: b.symbol, text: b.text, akt: b.akt ?? null,
      erreicht: r.ok || !!datum[b.id], ist: r.ist, ziel: r.ziel, prozent: !!r.prozent, datum: datum[b.id] ?? null };
  });
}

/** IDs, die jetzt erreicht sind, aber noch kein Datum haben. */
export function neueBadges(berechnet) {
  return berechnet.filter((b) => b.erreicht && !b.datum).map((b) => b.id);
}

/** Meta-Daten nach einer Bewertung nachführen (Serie ohne Hilfe, Tageszeit). */
export function metaNachBewertung(meta, { wert, hilfe, stunde }) {
  const m = { ...meta };
  m.ohneHilfeFolge = wert === "gruen" && hilfe === 0 ? (m.ohneHilfeFolge ?? 0) + 1 : 0;
  m.ohneHilfeMax = Math.max(m.ohneHilfeMax ?? 0, m.ohneHilfeFolge);
  if (stunde >= 22 || stunde < 4) m.nachteule = true;
  if (stunde >= 4 && stunde < 7) m.fruehaufsteher = true;
  return m;
}
