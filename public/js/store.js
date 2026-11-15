// Lokale Speicherung.
// - IndexedDB "theater-lernapp":
//     kv           Schlüssel (CryptoKey, nicht das Passwort) u.ä.
//     fortschritt  pro Rolle und Karte: {rolle, karte, hash, fach, faellig, wert, hilfe, anzahl, erstmals, zuletzt}
//     rollen       pro Rolle: {rolle, tage: {"YYYY-MM-DD": anzahl}, zuletzt: {...}, quiz: [], badges: {}}
// - localStorage: kleine Einstellungen (Rolle, Position, Schrift, Termine).
// Ein Rollenwechsel löscht nichts: alles ist nach Rolle getrennt.

const DB_NAME = "theater-lernapp";
const DB_VERSION = 2;
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const d = req.result;
        const t = req.transaction;
        if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
        if (!d.objectStoreNames.contains("fortschritt")) {
          d.createObjectStore("fortschritt", { keyPath: ["rolle", "karte"] }).createIndex("rolle", "rolle");
        }
        if (!d.objectStoreNames.contains("rollen")) d.createObjectStore("rollen", { keyPath: "rolle" });
        // M1 -> M2: Ampel-Bewertungen in Fächer übernehmen (rot/gelb -> 1, grün -> 2), fällig heute
        if (ev.oldVersion === 1 && d.objectStoreNames.contains("bewertungen")) {
          const heute = new Date().toISOString().slice(0, 10);
          const ziel = t.objectStore("fortschritt");
          t.objectStore("bewertungen").openCursor().onsuccess = (e) => {
            const c = e.target.result;
            if (!c) { d.deleteObjectStore("bewertungen"); return; }
            const b = c.value;
            ziel.put({ rolle: b.rolle, karte: b.karte, hash: b.hash, fach: b.wert === "gruen" ? 2 : 1,
              faellig: heute, wert: b.wert, hilfe: 0, anzahl: 1, erstmals: heute, zuletzt: b.zeit });
            c.continue();
          };
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("Die App ist in einem anderen Tab offen. Bitte dort schliessen."));
    });
  }
  return dbPromise;
}

function tx(stores, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(stores, mode);
    let req;
    try { req = fn(t); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(req instanceof IDBRequest ? req.result : req);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

// --- kv --------------------------------------------------------------------------
export const kvGet = (k) => tx("kv", "readonly", (t) => t.objectStore("kv").get(k));
export const kvSet = (k, v) => tx("kv", "readwrite", (t) => { t.objectStore("kv").put(v, k); });
export const kvDel = (k) => tx("kv", "readwrite", (t) => { t.objectStore("kv").delete(k); });

// --- Fortschritt -----------------------------------------------------------------
/** Map kartenId -> Eintrag für eine Rolle. */
export async function fortschrittFuer(rolle) {
  const alle = await tx("fortschritt", "readonly", (t) => t.objectStore("fortschritt").index("rolle").getAll(rolle));
  return new Map((alle ?? []).map((e) => [e.karte, e]));
}

export function leereRolle(rolle) {
  return { rolle, tage: {}, zuletzt: null, quiz: [], badges: {} };
}

export async function rolleLaden(rolle) {
  return (await tx("rollen", "readonly", (t) => t.objectStore("rollen").get(rolle))) ?? leereRolle(rolle);
}

/** Bewertung speichern: Fortschritt der Karte + Lerntag der Rolle in einer Transaktion. */
export function bewertungSpeichern(rolle, eintrag, heute, zuletzt) {
  return tx(["fortschritt", "rollen"], "readwrite", (t) => {
    t.objectStore("fortschritt").put({ ...eintrag, rolle });
    const rs = t.objectStore("rollen");
    rs.get(rolle).onsuccess = (e) => {
      const r = e.target.result ?? leereRolle(rolle);
      r.tage[heute] = (r.tage[heute] ?? 0) + 1;
      r.zuletzt = zuletzt;
      rs.put(r);
    };
  });
}

export function rolleZuruecksetzen(rolle) {
  return tx(["fortschritt", "rollen"], "readwrite", (t) => {
    const fs = t.objectStore("fortschritt");
    fs.index("rolle").openKeyCursor(IDBKeyRange.only(rolle)).onsuccess = (e) => {
      const c = e.target.result;
      if (c) { fs.delete(c.primaryKey); c.continue(); }
    };
    t.objectStore("rollen").delete(rolle);
  });
}

// --- Export / Import ---------------------------------------------------------------
export const EXPORT_FORMAT = "theater-lernapp-fortschritt";

/** Alle (oder eine) Rolle als JSON-Objekt. Enthält keinen Stücktext, nur IDs und Zahlen. */
export async function exportieren(nurRolle = null) {
  const [fortschritt, rollen] = await tx(["fortschritt", "rollen"], "readonly", (t) => {
    const out = [null, null];
    t.objectStore("fortschritt").getAll().onsuccess = (e) => { out[0] = e.target.result; };
    t.objectStore("rollen").getAll().onsuccess = (e) => { out[1] = e.target.result; };
    return out;
  });
  const daten = {};
  for (const r of rollen) daten[r.rolle] = { meta: r, fortschritt: [] };
  for (const e of fortschritt) {
    daten[e.rolle] ??= { meta: leereRolle(e.rolle), fortschritt: [] };
    const { rolle, ...rest } = e;
    daten[e.rolle].fortschritt.push(rest);
  }
  if (nurRolle) for (const k of Object.keys(daten)) if (k !== nurRolle) delete daten[k];
  return { format: EXPORT_FORMAT, version: 1, exportiert: new Date().toISOString(), rollen: daten };
}

/**
 * Import zusammenführen: pro Karte gewinnt der neuere Eintrag (zuletzt), Lerntage werden vereinigt.
 * Gibt {rollen, karten} zurück.
 */
export async function importieren(json, nurRolle = null) {
  if (json?.format !== EXPORT_FORMAT) throw new Error("Das ist keine Sicherungsdatei dieser App.");
  const rollenIds = Object.keys(json.rollen ?? {}).filter((r) => !nurRolle || r === nurRolle);
  let karten = 0;
  await tx(["fortschritt", "rollen"], "readwrite", (t) => {
    const fs = t.objectStore("fortschritt");
    const rs = t.objectStore("rollen");
    for (const rolle of rollenIds) {
      const { meta, fortschritt } = json.rollen[rolle];
      for (const e of fortschritt ?? []) {
        fs.get([rolle, e.karte]).onsuccess = (ev) => {
          const alt = ev.target.result;
          if (!alt || (e.zuletzt ?? 0) > (alt.zuletzt ?? 0)) { fs.put({ ...e, rolle }); karten++; }
        };
      }
      rs.get(rolle).onsuccess = (ev) => {
        const alt = ev.target.result ?? leereRolle(rolle);
        const tage = { ...alt.tage };
        for (const [tag, n] of Object.entries(meta?.tage ?? {})) tage[tag] = Math.max(tage[tag] ?? 0, n);
        const badges = { ...(meta?.badges ?? {}), ...alt.badges };
        const quiz = [...(alt.quiz ?? []), ...(meta?.quiz ?? []).filter((q) => !(alt.quiz ?? []).some((a) => a.zeit === q.zeit))];
        const zuletzt = (meta?.zuletzt?.zeit ?? 0) > (alt.zuletzt?.zeit ?? 0) ? meta.zuletzt : alt.zuletzt;
        rs.put({ ...alt, rolle, tage, badges, quiz, zuletzt });
      };
    }
  });
  return { rollen: rollenIds.length, karten };
}

export function persistentAnfragen() {
  try { navigator.storage?.persist?.(); } catch { /* egal */ }
}

// --- localStorage (immer mit try/catch: privater Modus, gesperrter Speicher) ---
const P = "tl.";
export function lsGet(k, fallback = null) {
  try { const v = localStorage.getItem(P + k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function lsSet(k, v) {
  try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* egal */ }
}
export function lsDel(k) {
  try { localStorage.removeItem(P + k); } catch { /* egal */ }
}
