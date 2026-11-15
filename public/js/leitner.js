// Lernkartei nach Leitner (rein, ohne DOM/IndexedDB – testbar mit node --test).
//
// 5 Fächer. Bewertung (Ampel): rot -> Fach 1, gelb -> Fach bleibt, grün -> Fach +1.
// Intervalle: Fach 1 = gleiche Sitzung, 2 = 1 Tag, 3 = 3 Tage, 4 = 7 Tage, 5 = 14 Tage.
// Phasen richten sich nach dem Textfest (Text auswendig, Standard 1.12.2027) und der Premiere.
// Fortschritt gehört zu Karten-ID UND Text-Hash: geänderter Text -> zurück in Fach 1.

export const FAECHER = 5;
export const INTERVALL = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
export const STANDARD_TERMINE = { textfest: "2027-12-01", premiere: "2028-04-30" };
export const WERTE = ["rot", "gelb", "gruen"];

// --- Datum als lokaler Tag "YYYY-MM-DD" --------------------------------------
const pad = (n) => String(n).padStart(2, "0");
export function tagKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseTag(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12); // Mittag: robust gegen Sommerzeit
}
export function addTage(key, n) {
  const d = parseTag(key);
  d.setDate(d.getDate() + n);
  return tagKey(d);
}
export function tageZwischen(von, bis) {
  return Math.round((parseTag(bis) - parseTag(von)) / 86400000);
}
function addMonate(key, n) {
  const d = parseTag(key);
  d.setMonth(d.getMonth() + n);
  return tagKey(d);
}

// --- Phasen ------------------------------------------------------------------
export const PHASEN = {
  kennenlernen: { name: "Kennenlernen", maxIntervall: Infinity,
    tipp: "Lies dich chronologisch durchs Stück und lerne den Ablauf kennen." },
  festigen: { name: "Festigen", maxIntervall: Infinity,
    tipp: "Lerne täglich die fälligen Karten, gern mit der Hilfe «Anfangsbuchstaben»." },
  endspurt: { name: "Endspurt", maxIntervall: 3,
    tipp: "Bis zum Textfest alles frisch halten: Karten kommen spätestens nach 3 Tagen wieder." },
  halten: { name: "Text halten", maxIntervall: 7,
    tipp: "Der Text sitzt – halte ihn wach. Hör dir ganze Szenen an und übe schwache Karten." },
  spielzeit: { name: "Spielzeit", maxIntervall: 7,
    tipp: "Toi toi toi! Wiederhole vor jeder Vorstellung deine schwachen Karten." },
};

/**
 * Aktuelle Phase.
 * Kennenlernen: bis 6 Monate vor dem Textfest · Festigen: bis 8 Wochen davor ·
 * Endspurt: letzte 8 Wochen · Halten: Textfest bis Premiere · Spielzeit: ab Premiere.
 */
export function phase(heute, termine = STANDARD_TERMINE) {
  const { textfest, premiere } = { ...STANDARD_TERMINE, ...termine };
  const festigenAb = addMonate(textfest, -6);
  const endspurtAb = addTage(textfest, -56);
  let id;
  if (heute >= premiere) id = "spielzeit";
  else if (heute >= textfest) id = "halten";
  else if (heute >= endspurtAb) id = "endspurt";
  else if (heute >= festigenAb) id = "festigen";
  else id = "kennenlernen";
  return {
    id, ...PHASEN[id],
    tageBisTextfest: tageZwischen(heute, textfest),
    tageBisPremiere: tageZwischen(heute, premiere),
    festigenAb, endspurtAb, textfest, premiere,
  };
}

export function intervall(fach, ph) {
  return Math.min(INTERVALL[fach], ph?.maxIntervall ?? Infinity);
}

// --- Zustand einer Karte -------------------------------------------------------
/** Zustand aus gespeichertem Eintrag. Geänderter Text (Hash) zählt wie Fach 1, heute fällig. */
export function zustand(karte, eintrag, heute) {
  if (!eintrag) return { neu: true, fach: 0, faellig: null, geaendert: false };
  if (eintrag.hash !== karte.hash) return { neu: false, fach: 1, faellig: heute, geaendert: true };
  return { neu: false, fach: eintrag.fach, faellig: eintrag.faellig, geaendert: false };
}

export function istFaellig(z, heute) {
  return !z.neu && z.faellig <= heute;
}

/** Neue Eintrag nach einer Bewertung. */
export function bewerten(eintrag, karte, wert, { heute, phase: ph, hilfe = 0, jetzt = Date.now() }) {
  if (!WERTE.includes(wert)) throw new Error("Unbekannte Bewertung: " + wert);
  const z = zustand(karte, eintrag, heute);
  const alt = z.neu ? 1 : z.fach;
  const fach = wert === "rot" ? 1 : wert === "gelb" ? alt : Math.min(FAECHER, alt + 1);
  return {
    karte: karte.id,
    hash: karte.hash,
    fach,
    faellig: addTage(heute, intervall(fach, ph)),
    wert,
    hilfe,
    anzahl: (z.geaendert ? 0 : eintrag?.anzahl ?? 0) + 1,
    erstmals: (!z.geaendert && eintrag?.erstmals) || heute,
    zuletzt: jetzt,
  };
}

// --- Auswahl von Karten --------------------------------------------------------
/**
 * Fällige Karten: zuerst fällige (tiefes Fach zuerst, dann Stückreihenfolge),
 * danach neue Karten in Stückreihenfolge bis zum Tageslimit.
 */
export function faelligeKarten(karten, fortschritt, heute, { neuProTag = 20 } = {}) {
  const faellig = [];
  const neu = [];
  let neuHeute = 0;
  for (const e of fortschritt.values()) if (e.erstmals === heute) neuHeute++;
  karten.forEach((k, i) => {
    const z = zustand(k, fortschritt.get(k.id), heute);
    if (z.neu) neu.push(k);
    else if (istFaellig(z, heute)) faellig.push({ k, i, fach: z.fach });
  });
  faellig.sort((a, b) => a.fach - b.fach || a.i - b.i);
  return [...faellig.map((x) => x.k), ...neu.slice(0, Math.max(0, neuProTag - neuHeute))];
}

/** Schwache Karten: Fach 1–2 (inkl. geänderter Texte), Stückreihenfolge. */
export function schwacheKarten(karten, fortschritt, heute) {
  return karten.filter((k) => {
    const z = zustand(k, fortschritt.get(k.id), heute);
    return !z.neu && z.fach <= 2;
  });
}

/** Karten eines Bereichs: "stueck", "akt:2", "szene:2.3". */
export function bereichFilter(karten, bereich = "stueck") {
  const [art, wert] = bereich.split(":");
  if (art === "akt") return karten.filter((k) => String(k.akt) === wert);
  if (art === "szene") return karten.filter((k) => k.szene === wert);
  return karten.slice();
}

export function mischen(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Statistik und Serie --------------------------------------------------------
function leer() { return { gesamt: 0, neu: 0, faecher: [0, 0, 0, 0, 0], faellig: 0 }; }
function zaehle(s, z, heute) {
  s.gesamt++;
  if (z.neu) s.neu++;
  else { s.faecher[z.fach - 1]++; if (istFaellig(z, heute)) s.faellig++; }
}

/** Zahlen für die Rolle: gesamt, pro Akt, pro Szene. Anteil "sitzt" = Fach >= 3. */
export function statistik(karten, fortschritt, heute) {
  const gesamt = leer();
  const proAkt = new Map();
  const proSzene = new Map();
  for (const k of karten) {
    const z = zustand(k, fortschritt.get(k.id), heute);
    zaehle(gesamt, z, heute);
    if (!proAkt.has(k.akt)) proAkt.set(k.akt, { ...leer(), farbe: k.farbe });
    zaehle(proAkt.get(k.akt), z, heute);
    if (!proSzene.has(k.szene)) proSzene.set(k.szene, { ...leer(), akt: k.akt, ort: k.ort, farbe: k.farbe });
    zaehle(proSzene.get(k.szene), z, heute);
  }
  return { gesamt, proAkt, proSzene };
}

export function anteilSitzt(s) {
  return s.gesamt ? (s.faecher[2] + s.faecher[3] + s.faecher[4]) / s.gesamt : 0;
}

/** Tages-Serie: aufeinanderfolgende Lerntage bis heute (oder bis gestern, wenn heute noch nicht gelernt). */
export function serie(lernTage, heute) {
  const tage = lernTage ?? {};
  let tag = tage[heute] ? heute : addTage(heute, -1);
  let n = 0;
  while (tage[tag]) { n++; tag = addTage(tag, -1); }
  return n;
}
