// Einstieg: Daten laden, entschlüsseln, Rolle, einfacher Hash-Router.
import { decryptWithKey, decryptWithPassword, WrongKeyError } from "./crypto.js";
import { kvGet, kvSet, kvDel, lsGet, lsSet, persistentAnfragen } from "./store.js";
import { h, leeren } from "./dom.js";
import { figur } from "./roles.js";
import { zeigePasswort } from "./views/passwort.js";
import { zeigeRollenwahl } from "./views/rolle.js";
import { zeigeStart } from "./views/start.js";
import { zeigeKarten } from "./views/karte.js";
import { zeigeEinstellungen } from "./views/einstellungen.js";
import { zeigeZufall } from "./views/zufall.js";
import { zeigeStatistik } from "./views/statistik.js";
import { STANDARD_TERMINE } from "./leitner.js";
import { stop as sprachausgabeStop, wachHalten } from "./speech.js";
import { zeigeHoerprobe } from "./views/hoerprobe.js";
import { zeigeStimmen } from "./views/stimmen.js";
import { zeigeAblauf } from "./views/ablauf.js";
import { zeigeWeg } from "./views/weg.js";
import { zeigeQuiz } from "./views/quiz.js";

const DATEN_URL = "data/stueck.enc";
const SCHLUESSEL = "schluessel";

const root = document.getElementById("app");

export const app = {
  stueck: null,
  bytes: null,
  get rolle() { return lsGet("rolle"); },
  set rolle(id) { lsSet("rolle", id); },
  rolleFigur() { return this.rolle ? figur(this.stueck, this.rolle) : null; },
  termine() {
    return { textfest: lsGet("textfest", STANDARD_TERMINE.textfest), premiere: lsGet("premiere", STANDARD_TERMINE.premiere) };
  },
  gehe(hash) { if (location.hash === hash) route(); else location.hash = hash; },
  async passwortZuruecksetzen() {
    await kvDel(SCHLUESSEL);
    this.stueck = null;
    location.hash = "#/";
    await start();
  },
};

function schrift() {
  document.documentElement.dataset.schrift = lsGet("schrift", "normal");
  const thema = lsGet("thema", "auto");
  if (thema === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = thema;
}
app.schrift = schrift;

function laden(text) {
  leeren(root).append(h("div.laden", { role: "status" }, h("div.spinner"), h("p", text)));
}

function fehler(text, nochmal) {
  leeren(root).append(h("section.seite.mitte",
    h("h1", "Etwas hat nicht geklappt"), h("p", text),
    nochmal && h("button.knopf.primaer", { onclick: nochmal }, "Nochmals versuchen")));
}

async function datenHolen() {
  const res = await fetch(DATEN_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Daten nicht gefunden (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

async function start() {
  schrift();
  laden("Stück wird geladen …");
  try {
    app.bytes = await datenHolen();
  } catch (e) {
    return fehler("Die Daten konnten nicht geladen werden. Bist du online? " + e.message, start);
  }
  let hinweis = null;
  const key = await kvGet(SCHLUESSEL).catch(() => null);
  if (key) {
    try {
      app.stueck = await decryptWithKey(app.bytes, key);
    } catch (e) {
      if (!(e instanceof WrongKeyError)) return fehler(e.message, start);
      await kvDel(SCHLUESSEL);
      hinweis = "Es gibt eine neue Version oder ein neues Passwort. Bitte gib das Ensemble-Passwort nochmals ein.";
    }
  }
  if (!app.stueck) {
    return zeigePasswort(root, {
      hinweis,
      async pruefen(pw) {
        const { data, key: k } = await decryptWithPassword(app.bytes, pw);
        app.stueck = data;
        try { await kvSet(SCHLUESSEL, k); } catch { /* ohne Speicher: beim nächsten Start nochmals fragen */ }
        persistentAnfragen();
        bereit();
      },
    });
  }
  bereit();
}

function bereit() {
  persistentAnfragen();
  if (app.rolle && !app.rolleFigur()) app.rolle = null; // Rolle gibt es nicht mehr
  window.removeEventListener("hashchange", route);
  window.addEventListener("hashchange", route);
  route();
}

function route() {
  if (!app.stueck) return;
  const [pfad, query] = location.hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query ?? "");
  window.scrollTo(0, 0);
  sprachausgabeStop();   // Seitenwechsel beendet jede Sprachausgabe
  wachHalten(false);
  if (!app.rolle && pfad !== "/rolle") return app.gehe("#/rolle");
  switch (pfad) {
    case "/rolle": return zeigeRollenwahl(root, app);
    case "/lernen": return zeigeKarten(root, app, params);
    case "/einstellungen": return zeigeEinstellungen(root, app);
    case "/zufall": return zeigeZufall(root, app);
    case "/statistik": return zeigeStatistik(root, app);
    case "/hoerprobe": return zeigeHoerprobe(root, app, params);
    case "/stimmen": return zeigeStimmen(root, app);
    case "/ablauf": return zeigeAblauf(root, app);
    case "/weg": return zeigeWeg(root, app);
    case "/quiz": return zeigeQuiz(root, app, params);
    default: return zeigeStart(root, app);
  }
}

start();
