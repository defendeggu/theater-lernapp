// Sprachausgabe im Browser (Web Speech API). Die reine Logik steckt in voices.js.
//
// iOS-Eigenheiten:
// - Die erste Ausgabe muss durch ein Tippen ausgelöst werden -> entsperren() im Klick-Handler.
// - Stimmen laden asynchron ("voiceschanged").
// - Lange Texte werden in Stücke geteilt, sonst bricht die Ausgabe ab.
// - Bei gesperrtem Bildschirm hält iOS die Ausgabe an -> Wake Lock während der Hörprobe.
import { deutscheStimmen, zuteilen, sprechStuecke } from "./voices.js";
import { lsGet } from "./store.js";
import { einsaetze } from "./roles.js";

const synth = () => globalThis.speechSynthesis ?? null;
export const verfuegbar = () => !!synth() && typeof SpeechSynthesisUtterance !== "undefined";

let stimmenCache = null;
let entsperrt = false;
let lauf = 0; // erhöht sich bei jedem stop(): laufende Ausgaben brechen ab

/** Alle Stimmen laden (wartet kurz auf "voiceschanged"). */
export function ladeStimmen(timeout = 2000) {
  if (!verfuegbar()) return Promise.resolve([]);
  const jetzt = synth().getVoices();
  if (jetzt.length) { stimmenCache = jetzt; return Promise.resolve(jetzt); }
  return new Promise((resolve) => {
    const fertig = () => { stimmenCache = synth().getVoices(); resolve(stimmenCache); };
    synth().addEventListener?.("voiceschanged", fertig, { once: true });
    setTimeout(fertig, timeout);
  });
}

export const geschlechtOverrides = () => lsGet("stimmen.geschlecht", {});
export const manuelleWahl = () => lsGet("stimmen.manuell", {});
export const grundTempo = () => lsGet("tempo", 1);

/** Zuteilung Figur -> Stimme für das Stück (mit Einstellungen). */
export async function stimmenFuerStueck(stueck) {
  const roh = await ladeStimmen();
  const stimmen = deutscheStimmen(roh, geschlechtOverrides());
  const n = einsaetze(stueck);
  const figuren = stueck.figuren.map((f) => ({ ...f, einsaetze: n.get(f.id) ?? 0 }));
  return { ...zuteilen(figuren, stimmen, manuelleWahl()), stimmen, roh };
}

/** Im Klick-Handler aufrufen: schaltet die Sprachausgabe auf iOS frei. */
export function entsperren() {
  if (entsperrt || !verfuegbar()) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  synth().speak(u);
  entsperrt = true;
}

export function stop() {
  lauf++;
  if (verfuegbar()) synth().cancel();
}

export const spricht = () => verfuegbar() && (synth().speaking || synth().pending);

/**
 * Text mit einer Figurenstimme sprechen. Löst auf, wenn fertig (true) oder abgebrochen (false).
 * @param {string} text
 * @param {{stimme, lang, pitch, rate}} z  Zuteilung aus voices.zuteilen
 */
export async function sprich(text, z = {}) {
  if (!verfuegbar() || !text) return false;
  stop();
  const meinLauf = lauf;
  const voice = (stimmenCache ?? synth().getVoices()).find((v) => (v.voiceURI || v.name) === z.stimme) ?? null;
  for (const stueck of sprechStuecke(text)) {
    if (meinLauf !== lauf) return false;
    const ok = await new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(stueck);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? z.lang ?? "de-DE";
      u.pitch = z.pitch ?? 1;
      u.rate = Math.min(2, Math.max(0.5, (z.rate ?? 1) * grundTempo()));
      u.onend = () => resolve(true);
      u.onerror = (e) => resolve(e.error === "interrupted" || e.error === "canceled" ? false : true);
      synth().speak(u);
      // Sicherheitsnetz: manche Browser melden "end" nie
      setTimeout(() => resolve(true), 2000 + stueck.length * 150);
    });
    if (!ok) return false;
  }
  return meinLauf === lauf;
}

// --- Bildschirm wach halten (Hörprobe) --------------------------------------------
let wakeLock = null;
export async function wachHalten(an) {
  try {
    if (an && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener?.("release", () => { wakeLock = null; });
    } else if (!an && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { /* nicht unterstützt oder verweigert */ }
}
