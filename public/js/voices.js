// Stimmen-Zuteilung pro Figur (rein, ohne Browser-API – testbar mit node --test).
//
// Die Web Speech API sagt nicht, ob eine Stimme weiblich oder männlich ist. Darum eine Tabelle
// bekannter Stimmen-Namen (iOS/macOS, Windows/Edge, Chrome, Android). Unbekannte Stimmen können
// in den Einstellungen als w/m markiert werden (overrides).
//
// Zuteilung: Figuren gleichen Geschlechts werden reihum auf die vorhandenen Stimmen verteilt
// (Hauptrollen zuerst bekommen die beste Stimme); reichen die Stimmen nicht, unterscheiden sich
// die Figuren über Tonhöhe (pitch) und Tempo (rate). Jugendliche/Kinder sprechen höher.
// Fehlt ein Geschlecht, wird eine Stimme des anderen Geschlechts verstellt (ersatz: true).

/** Bekannte deutsche Stimmen: Vorname (klein) -> "w" | "m". */
export const BEKANNTE_STIMMEN = {
  // Apple iOS / macOS
  anna: "w", helena: "w", petra: "w", marlene: "w", katja: "w", sandy: "w", shelley: "w", grandma: "w",
  martin: "m", markus: "m", yannick: "m", viktor: "m", eddy: "m", flo: "m", reed: "m", rocko: "m", grandpa: "m",
  // Microsoft (Windows, Edge)
  hedda: "w", amala: "w", leni: "w", ingrid: "w", louisa: "w", elke: "w", gisela: "w", klarissa: "w",
  maja: "w", tanja: "w", seraphina: "w", vicki: "w",
  stefan: "m", conrad: "m", killian: "m", jan: "m", jonas: "m", michael: "m", bernd: "m", christoph: "m",
  kasper: "m", klaus: "m", ralf: "m", florian: "m", hans: "m",
  // Google (Chrome Desktop): "Google Deutsch" ist eine Frauenstimme
  "google deutsch": "w",
};

const VORSILBEN = /^(microsoft|google|apple|com\.apple\.[\w.]+)\s+/i;

/** Vorname einer Stimme: "Anna (Erweitert)" -> "anna", "Microsoft Katja - German" -> "katja". */
export function stimmenVorname(name) {
  const n = name.trim();
  if (/^google deutsch/i.test(n)) return "google deutsch";
  return n.replace(VORSILBEN, "").split(/[\s(\-–,]/)[0].toLowerCase();
}

export function stimmenQualitaet(name) {
  if (/premium/i.test(name)) return 3;
  if (/erweitert|enhanced|natural|neural|online/i.test(name)) return 2;
  return 1;
}

export function sprachRang(lang) {
  const l = (lang ?? "").toLowerCase().replace("_", "-");
  if (l.startsWith("de-ch")) return 0;
  if (l.startsWith("de-de")) return 1;
  if (l.startsWith("de-at")) return 2;
  if (l.startsWith("de")) return 3;
  return 9;
}

/**
 * Deutsche Stimmen mit Geschlecht und Qualität, sortiert (beste zuerst).
 * @param {Array<{name, lang, voiceURI, localService}>} voices  aus speechSynthesis.getVoices()
 * @param {Object<string, "w"|"m">} overrides  von Hand markiert (Schlüssel voiceURI)
 */
export function deutscheStimmen(voices, overrides = {}) {
  return voices
    .filter((v) => sprachRang(v.lang) < 9)
    .map((v) => ({
      id: v.voiceURI || v.name,
      name: v.name,
      lang: v.lang,
      lokal: v.localService !== false,
      geschlecht: overrides[v.voiceURI || v.name] ?? BEKANNTE_STIMMEN[stimmenVorname(v.name)] ?? null,
      qualitaet: stimmenQualitaet(v.name),
      rang: sprachRang(v.lang),
    }))
    .sort((a, b) => b.qualitaet - a.qualitaet || a.rang - b.rang || Number(b.lokal) - Number(a.lokal)
      || a.name.localeCompare(b.name));
}

// Varianten, damit Figuren mit derselben Stimme unterscheidbar bleiben
export const VARIANTEN = [
  { pitch: 1.0, rate: 1.0 },
  { pitch: 0.85, rate: 0.96 },
  { pitch: 1.15, rate: 1.04 },
  { pitch: 0.75, rate: 1.02 },
  { pitch: 1.25, rate: 0.97 },
  { pitch: 0.92, rate: 1.07 },
  { pitch: 1.08, rate: 0.92 },
];
const ALTER_PITCH = { erwachsen: 1, jugendlich: 1.15, kind: 1.3 };
const ERSATZ_PITCH = { m: 0.72, w: 1.35 }; // Frauenstimme tiefer für Männer, Männerstimme höher für Frauen
const runde = (x) => Math.round(Math.min(2, Math.max(0.5, x)) * 100) / 100;

/**
 * Teilt jeder Figur eine Stimme zu.
 * @param {Array<{id, geschlecht, alter, einsaetze?}>} figuren
 * @param {ReturnType<typeof deutscheStimmen>} stimmen
 * @param {Object<string, {stimme?: string, pitch?: number}>} manuell  Einstellungen pro Figur
 * @returns {{zuteilung: Map<string, {stimme, stimmenName, pitch, rate, ersatz}>, fehlt: string[], keineDeutsche: boolean}}
 */
export function zuteilen(figuren, stimmen, manuell = {}) {
  const pool = {
    w: stimmen.filter((s) => s.geschlecht === "w"),
    m: stimmen.filter((s) => s.geschlecht === "m"),
  };
  const unbekannt = stimmen.filter((s) => !s.geschlecht);
  const fehlt = ["w", "m"].filter((g) => !pool[g].length);
  // Fehlt ein Geschlecht, aber es gibt unbekannte Stimmen: diese nehmen (ohne Verstellung)
  for (const g of fehlt) if (unbekannt.length) pool[g] = unbekannt;

  const reihenfolge = [...figuren].sort((a, b) => (b.einsaetze ?? 0) - (a.einsaetze ?? 0) || a.id.localeCompare(b.id));
  const zaehler = { w: 0, m: 0 };
  const zuteilung = new Map();
  const nachId = new Map(stimmen.map((s) => [s.id, s]));

  for (const f of reihenfolge) {
    const g = f.geschlecht === "w" ? "w" : "m";
    let eigene = pool[g];
    let ersatz = false;
    if (!eigene.length) {
      eigene = pool[g === "w" ? "m" : "w"];
      ersatz = eigene.length > 0;
    }
    const k = zaehler[g]++;
    const n = Math.max(1, eigene.length);
    const stimme = eigene.length ? eigene[k % n] : null;
    const v = VARIANTEN[Math.floor(k / n) % VARIANTEN.length];
    const jung = (ALTER_PITCH[f.alter] ?? 1) > 1;
    // Jugendliche/Kinder nie tiefer als die Grundstimme (sonst verschwindet der Altersunterschied)
    let pitch = (jung ? Math.max(1, v.pitch) : v.pitch) * (ALTER_PITCH[f.alter] ?? 1) * (ersatz ? ERSATZ_PITCH[g] : 1);
    let rate = v.rate;
    let gewaehlt = stimme;

    const m = manuell[f.id];
    if (m?.stimme && nachId.has(m.stimme)) { gewaehlt = nachId.get(m.stimme); ersatz = false; }
    if (typeof m?.pitch === "number") pitch = m.pitch;

    zuteilung.set(f.id, {
      stimme: gewaehlt?.id ?? null,
      stimmenName: gewaehlt?.name ?? null,
      lang: gewaehlt?.lang ?? "de-DE",
      pitch: runde(pitch),
      rate: runde(rate),
      ersatz,
    });
  }
  return { zuteilung, fehlt: stimmen.length ? fehlt.filter((g) => !unbekannt.length) : [], keineDeutsche: !stimmen.length };
}

/** Text für die Sprachausgabe aufbereiten (Regie ist schon entfernt). */
export function sprechText(text) {
  return text
    .replace(/\*\*?\s?\d*/g, " ")
    .replace(/[«»"„“”]/g, "")
    .replace(/…+/g, ", ")
    .replace(/\s*\n\n\s*/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/([,.!?])[,.!?]+/g, "$1")
    .trim();
}

/** In Stücke für die Sprachausgabe teilen (lange Texte bricht iOS/Chrome sonst ab). */
export function sprechStuecke(text, max = 180) {
  const saetze = sprechText(text).match(/[^.!?]+[.!?]*/g) ?? [];
  const out = [];
  let cur = "";
  for (const s of saetze.map((x) => x.trim()).filter(Boolean)) {
    if (cur && (cur + " " + s).length > max) { out.push(cur); cur = s; }
    else cur = cur ? cur + " " + s : s;
  }
  if (cur) out.push(cur);
  return out;
}

/** Pause zum Sprechen der eigenen Replik (ms): ca. 0.45 s pro Wort, mind. 2.5 s, höchstens 25 s. */
export function sprechPause(text, faktor = 1) {
  const w = (text.match(/\S+/g) ?? []).length;
  return Math.round(Math.min(25000, Math.max(2500, w * 450)) * faktor);
}
