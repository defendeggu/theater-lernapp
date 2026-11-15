// Rollenliste für die Rollenwahl (rein, ohne DOM).

export const GRUPPEN = [
  { id: "dorf", titel: "Dorf" },
  { id: "fahrende", titel: "Fahrende" },
  { id: "jugendliche", titel: "Jugendliche und Kinder" },
  { id: "erzaehler", titel: "Erzähler" },
];

/** Anzahl Repliken mit Text pro Figur (Sammelrepliken zählen für alle Beteiligten). */
export function einsaetze(stueck) {
  const n = new Map();
  for (const a of stueck.akte)
    for (const s of a.szenen)
      for (const r of s.repliken) {
        if (!r.text) continue;
        for (const id of r.sprecher) n.set(id, (n.get(id) ?? 0) + 1);
      }
  return n;
}

/** Sprechrollen gruppiert, Reihenfolge innerhalb der Gruppe wie im Textbuch. */
export function rollenListe(stueck) {
  const n = einsaetze(stueck);
  const rollen = stueck.figuren
    .filter((f) => (n.get(f.id) ?? 0) > 0)
    .map((f) => ({ id: f.id, name: f.name, kurz: f.kurz, beschreibung: f.beschreibung, gruppe: f.gruppe, einsaetze: n.get(f.id) }));
  const bekannte = new Set(GRUPPEN.map((g) => g.id));
  const gruppen = GRUPPEN.map((g) => ({ ...g, rollen: rollen.filter((r) => r.gruppe === g.id) }));
  const rest = rollen.filter((r) => !bekannte.has(r.gruppe));
  if (rest.length) gruppen.push({ id: "weitere", titel: "Weitere", rollen: rest });
  return gruppen.filter((g) => g.rollen.length);
}

export function figur(stueck, id) {
  return stueck.figuren.find((f) => f.id === id) ?? null;
}

/** Szenen, in denen die Rolle mindestens eine Replik hat. */
export function szenenDerRolle(stueck, rolle) {
  const out = [];
  for (const a of stueck.akte)
    for (const s of a.szenen)
      if (s.repliken.some((r) => r.text && r.sprecher.includes(rolle)))
        out.push({ akt: a.nr, farbe: a.farbe, id: s.id, ort: s.ort });
  return out;
}
