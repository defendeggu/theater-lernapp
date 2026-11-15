// Lokale Speicherung.
// - IndexedDB: Schlüssel (CryptoKey, nicht das Passwort) und Bewertungen pro Rolle.
// - localStorage: kleine Einstellungen (gewählte Rolle, Position, Schriftgrösse).
// M2 baut darauf den Leitner-Fortschritt auf.

const DB_NAME = "theater-lernapp";
const DB_VERSION = 1;
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
        if (!d.objectStoreNames.contains("bewertungen")) {
          const s = d.createObjectStore("bewertungen", { keyPath: ["rolle", "karte"] });
          s.createIndex("rolle", "rolle");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(store, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const kvGet = (k) => tx("kv", "readonly", (s) => s.get(k));
export const kvSet = (k, v) => tx("kv", "readwrite", (s) => { s.put(v, k); });
export const kvDel = (k) => tx("kv", "readwrite", (s) => { s.delete(k); });

export function bewertungSetzen(rolle, karte, wert, hash) {
  return tx("bewertungen", "readwrite", (s) => {
    s.put({ rolle, karte, wert, hash, zeit: Date.now() });
  });
}

/** Map kartenId -> {wert, hash, zeit} für eine Rolle. */
export async function bewertungenFuer(rolle) {
  const alle = await tx("bewertungen", "readonly", (s) => s.index("rolle").getAll(rolle));
  return new Map((alle ?? []).map((b) => [b.karte, b]));
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
