// Ver- und Entschlüsselung von stueck.enc mit der WebCrypto-API.
// Läuft im Browser (Safari/iOS 17+) und in Node 20+ (globalThis.crypto).
//
// Dateiformat stueck.enc (alles Big Endian):
//   0..3   Magic "EVB1"
//   4      Formatversion (1)
//   5..8   PBKDF2-Iterationen (uint32)
//   9..24  Salt (16 Byte)
//   25..36 IV (12 Byte)
//   37..   AES-GCM-256 Chiffrat (inkl. 16 Byte Tag) von gzip(JSON)

export const MAGIC = "EVB1";
export const FORMAT_VERSION = 1;
export const ITERATIONS = 600000;
const SALT_LEN = 16;
const IV_LEN = 12;
const HEADER_LEN = 4 + 1 + 4 + SALT_LEN + IV_LEN;

const subtle = () => globalThis.crypto.subtle;

export function parseHeader(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < HEADER_LEN + 16) throw new Error("Datei zu kurz");
  const magic = String.fromCharCode(...b.slice(0, 4));
  if (magic !== MAGIC) throw new Error("Keine EVB-Datei");
  const version = b[4];
  if (version !== FORMAT_VERSION) throw new Error(`Unbekannte Formatversion ${version}`);
  const iterations = new DataView(b.buffer, b.byteOffset + 5, 4).getUint32(0);
  const salt = b.slice(9, 9 + SALT_LEN);
  const iv = b.slice(9 + SALT_LEN, HEADER_LEN);
  const data = b.slice(HEADER_LEN);
  return { version, iterations, salt, iv, data };
}

/** Leitet den AES-Schlüssel aus Passwort + Salt ab (nicht extrahierbar, in IndexedDB speicherbar). */
export async function deriveKey(password, salt, iterations = ITERATIONS) {
  const base = await subtle().importKey(
    "raw", new TextEncoder().encode(password.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt", "encrypt"]);
}

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export const gzip = (bytes) => pipe(bytes, new CompressionStream("gzip"));
export const gunzip = (bytes) => pipe(bytes, new DecompressionStream("gzip"));

/** Entschlüsselt mit einem bereits abgeleiteten Schlüssel. Wirft bei falschem Schlüssel. */
export async function decryptWithKey(bytes, key) {
  const h = parseHeader(bytes);
  let plain;
  try {
    plain = await subtle().decrypt({ name: "AES-GCM", iv: h.iv }, key, h.data);
  } catch {
    throw new WrongKeyError();
  }
  const json = new TextDecoder().decode(await gunzip(new Uint8Array(plain)));
  return JSON.parse(json);
}

/** Entschlüsselt mit Passwort. Gibt { data, key } zurück, damit der Schlüssel gespeichert werden kann. */
export async function decryptWithPassword(bytes, password) {
  const h = parseHeader(bytes);
  const key = await deriveKey(password, h.salt, h.iterations);
  const data = await decryptWithKey(bytes, key);
  return { data, key };
}

/** Verschlüsselt ein Objekt. Nur fürs Werkzeug tools/encrypt.mjs und für Tests. */
export async function encrypt(obj, password, { iterations = ITERATIONS, salt, iv } = {}) {
  salt = salt ?? globalThis.crypto.getRandomValues(new Uint8Array(SALT_LEN));
  iv = iv ?? globalThis.crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt, iterations);
  const packed = await gzip(new TextEncoder().encode(JSON.stringify(obj)));
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, packed));
  const out = new Uint8Array(HEADER_LEN + ct.length);
  out.set([...MAGIC].map((c) => c.charCodeAt(0)), 0);
  out[4] = FORMAT_VERSION;
  new DataView(out.buffer).setUint32(5, iterations);
  out.set(salt, 9);
  out.set(iv, 9 + SALT_LEN);
  out.set(ct, HEADER_LEN);
  return out;
}

export class WrongKeyError extends Error {
  constructor() {
    super("Passwort falsch oder Daten geändert");
    this.name = "WrongKeyError";
  }
}
