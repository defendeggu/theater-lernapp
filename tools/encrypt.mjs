// stueck.json + ablauf.json -> public/data/stueck.enc
//
// Aufruf:  node tools/encrypt.mjs [data/private/stueck.json] [data/private/ablauf.json] [public/data/stueck.enc]
//
// Das Passwort wird interaktiv (verdeckt) abgefragt und nie als Argument
// übergeben, damit es nicht in der Shell-History landet.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encrypt, decryptWithPassword, WrongKeyError } from "../public/js/crypto.js";

/**
 * Öffnet das Passwort die bisherige Datei?
 * @returns {"gleich"|"anders"|"keine-datei"|"unlesbar"}
 */
export async function passwortPruefen(bisherigeBytes, passwort) {
  if (!bisherigeBytes || !bisherigeBytes.length) return "keine-datei";
  try {
    await decryptWithPassword(bisherigeBytes, passwort);
    return "gleich";
  } catch (e) {
    return e instanceof WrongKeyError ? "anders" : "unlesbar";
  }
}

async function frage(text) {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(text)).trim().toLowerCase(); } finally { rl.close(); }
}

/** Baut die Nutzdaten für die App: nur was die App braucht, ohne Review-Felder. */
export function buildPayload(stueck, ablauf, stand = new Date().toISOString()) {
  const kurz = new Map((ablauf?.szenen ?? []).map((s) => [s.id, s]));
  const figuren = stueck.figuren
    .filter((f) => f.sprechrolle)
    .map(({ id, name, kurz, geschlecht, alter, beschreibung, gruppe, einsaetze_ca }) =>
      ({ id, name, kurz, geschlecht, alter, beschreibung, gruppe, einsaetze_ca }));
  const akte = stueck.akte.map((a) => ({
    nr: a.nr,
    farbe: a.farbe,
    szenen: a.szenen.map((s) => ({
      id: s.id,
      ort: s.ort,
      ort_typ: kurz.get(s.id)?.ort_typ ?? null,
      personen: s.personen,
      kurzfassung: kurz.get(s.id)?.kurzfassung ?? "",
      regie: s.regie.map(({ nach, text }) => ({ nach, text })),
      repliken: s.repliken.map(({ id, sprecher, sammel, text, regie, hash }) =>
        ({ id, sprecher, sammel, text, regie, hash })),
    })),
  }));
  return { format: 1, stand, titel: stueck.titel, figuren, akte };
}

async function askHidden(prompt) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) throw new Error("Passwort-Abfrage braucht ein Terminal (kein Pipe/Argument).");
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let pw = "";
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(pw);
        }
        if (c === "\u0003") { stdin.setRawMode(false); return reject(new Error("Abgebrochen")); }
        if (c === "\u007f" || c === "\b") { pw = pw.slice(0, -1); continue; }
        pw += c;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const [stueckP = "data/private/stueck.json", ablaufP = "data/private/ablauf.json",
    outP = "public/data/stueck.enc"] = process.argv.slice(2);
  const stueck = JSON.parse(await readFile(stueckP, "utf8"));
  let ablauf = null;
  try { ablauf = JSON.parse(await readFile(ablaufP, "utf8")); } catch { console.warn("Keine ablauf.json gefunden."); }

  const pw1 = await askHidden("Ensemble-Passwort: ");
  if (pw1.length < 8) throw new Error("Passwort zu kurz (mind. 8 Zeichen).");
  const pw2 = await askHidden("Nochmals: ");
  if (pw1 !== pw2) throw new Error("Passwörter stimmen nicht überein.");

  // Schutz vor Tippfehlern: öffnet das Passwort die bisherige Datei?
  const bisher = await readFile(outP).catch(() => null);
  const pruefung = await passwortPruefen(bisher, pw1);
  if (pruefung === "gleich") {
    console.log("Passwort passt zur bisherigen Datei – das Ensemble muss nichts neu eingeben.");
  } else if (pruefung !== "keine-datei") {
    console.warn(pruefung === "anders"
      ? "\nACHTUNG: Dieses Passwort öffnet die bisherige stueck.enc NICHT.\n"
        + "Entweder ein Tippfehler – oder du willst das Ensemble-Passwort wechseln.\n"
        + "Bei einem Wechsel muss das ganze Ensemble das neue Passwort eingeben."
      : "\nACHTUNG: Die bisherige stueck.enc lässt sich nicht lesen (anderes Format?).");
    const antwort = await frage("Passwort wirklich wechseln? (ja/nein): ");
    if (antwort !== "ja" && antwort !== "j") {
      console.log("Abgebrochen – nichts geschrieben.");
      return;
    }
    console.log("Passwort wird gewechselt.");
  }

  const payload = buildPayload(stueck, ablauf);
  const bytes = await encrypt(payload, pw1);
  // Gegenprobe: lässt sich die Datei wieder öffnen?
  const { data } = await decryptWithPassword(bytes, pw1);
  if (data.stand !== payload.stand) throw new Error("Gegenprobe fehlgeschlagen.");

  await mkdir(dirname(outP), { recursive: true });
  await writeFile(outP, bytes);
  const n = payload.akte.reduce((s, a) => s + a.szenen.reduce((t, sz) => t + sz.repliken.length, 0), 0);
  console.log(`${outP}: ${(bytes.length / 1024).toFixed(0)} KB, ${payload.figuren.length} Rollen, ${n} Repliken, Stand ${payload.stand}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error("Fehler:", e.message); process.exit(1); });
}
