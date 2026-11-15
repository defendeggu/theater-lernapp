// Kartenansicht. Vorderseite: letzter Satz vor dem Einsatz (+ Hilfestufe) → von Hand umdrehen →
// Rückseite: eigener Text + Selbstbewertung (Ampel). Modi: chronologisch, fällig, zufall, schwach.
import { h, leeren, kontrastFarbe } from "../dom.js";
import { kartenFuer, indexAbSzene, textStuecke } from "../cards.js";
import { anfangsbuchstaben, lueckentext, HILFESTUFEN } from "../hilfe.js";
import {
  bewerten, zustand, faelligeKarten, schwacheKarten, bereichFilter, mischen, tagKey, phase,
} from "../leitner.js";
import { bewertungSpeichern, fortschrittFuer, lsGet, lsSet } from "../store.js";
import { stimmenFuerStueck, sprich, stop, entsperren, verfuegbar } from "../speech.js";
import { sprechPause } from "../voices.js";

export const AMPEL = [
  { wert: "rot", text: "Nicht gewusst", hilfe: "Zurück in Fach 1, kommt bald wieder" },
  { wert: "gelb", text: "Fast", hilfe: "Bleibt im gleichen Fach" },
  { wert: "gruen", text: "Gewusst", hilfe: "Ein Fach weiter" },
];
const AMPEL_TEXT = Object.fromEntries(AMPEL.map((a) => [a.wert, a.text]));

export const MODI = {
  chrono: { name: "Chronologisch" },
  faellig: { name: "Fällige Karten" },
  zufall: { name: "Zufall" },
  schwach: { name: "Schwache Karten" },
};

const WIEDERHOLEN_NACH = 4; // "Nicht gewusst" kommt in der gleichen Sitzung nach 4 Karten nochmals
const MAX_WIEDERHOLUNG = 2;

function eigenerText(k) {
  const absaetze = [[]];
  for (const s of textStuecke(k.text, k.regie)) {
    if (s.typ === "absatz") absaetze.push([]);
    else if (s.typ === "regie") absaetze[absaetze.length - 1].push(h("span.regie", `(${s.text}) `));
    else absaetze[absaetze.length - 1].push(s.text);
  }
  return h("div.eigener-text", absaetze.filter((a) => a.length).map((a) => h("p", a)));
}

function hilfeText(k, stufe) {
  if (stufe === 1) return h("div.hilfe-text.anfang", anfangsbuchstaben(k.text).split("\n\n").map((p) => h("p", p)));
  if (stufe === 2) {
    const absaetze = [[]];
    for (const s of lueckentext(k.text)) {
      if (s.typ === "absatz") absaetze.push([]);
      else if (s.typ === "luecke") absaetze[absaetze.length - 1].push(
        h("span.luecke", { style: { width: `${Math.max(2, s.text.length) * 0.55}em` }, "aria-label": "Lücke" }));
      else absaetze[absaetze.length - 1].push(s.text);
    }
    return h("div.hilfe-text", absaetze.map((a) => h("p", a)));
  }
  if (stufe === 3) return h("div.hilfe-text.ganz", eigenerText(k));
  return null;
}

/** Warteschlange für die Sitzung nach Modus. */
function sitzung(modus, params, karten, fortschritt, heute) {
  const neuProTag = lsGet("neuProTag", 20);
  switch (modus) {
    case "faellig": return faelligeKarten(karten, fortschritt, heute, { neuProTag });
    case "schwach": return schwacheKarten(karten, fortschritt, heute);
    case "zufall": return mischen(bereichFilter(karten, params.get("bereich") ?? "stueck"));
    default: return karten;
  }
}

export async function zeigeKarten(root, app, params) {
  const rolle = app.rolle;
  const f = app.rolleFigur();
  const modus = MODI[params.get("modus")] ? params.get("modus") : "chrono";
  const alleKarten = kartenFuer(app.stueck, rolle);
  const heute = tagKey();
  const ph = phase(heute, app.termine());
  let fortschritt = new Map();
  try { fortschritt = await fortschrittFuer(rolle); } catch { /* ohne IndexedDB weiter */ }

  const queue = sitzung(modus, params, alleKarten, fortschritt, heute).slice();
  const wiederholt = new Map();
  const ergebnis = { rot: 0, gelb: 0, gruen: 0 };
  let hilfe = lsGet("hilfe", 0);

  // Sprachausgabe: Stichwort vorlesen -> Pause zum Sprechen -> (optional) automatisch umdrehen
  let audio = null;
  if (verfuegbar()) stimmenFuerStueck(app.stueck).then((a) => { audio = a; }).catch(() => {});
  let autoVorlesen = lsGet("autoVorlesen", false);
  let interagiert = false; // iOS: erste Ausgabe erst nach einem Tippen
  let ablauf = 0;          // Zähler: neue Karte/Drehen bricht laufenden Ablauf ab
  let pauseTimer = null;

  let i = 0;
  if (modus === "chrono") {
    if (params.get("karte")) i = Math.max(0, queue.findIndex((k) => k.id === params.get("karte")));
    else if (params.get("ab")) i = indexAbSzene(queue, params.get("ab"));
  }
  let gedreht = false;

  const seite = h("section.karten-seite");
  leeren(root).append(seite);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (!queue.length) {
    const leer = {
      faellig: ["Heute ist nichts fällig", "Alle fälligen Karten sind erledigt. Morgen geht es weiter – oder lerne chronologisch oder im Zufallsmodus."],
      schwach: ["Keine schwachen Karten", "Keine Karte liegt in Fach 1 oder 2. Gut gemacht!"],
    }[modus] ?? ["Keine Karten", "In diesem Bereich gibt es keine Karten für deine Rolle."];
    leeren(seite).append(h("div.seite.mitte.fertig",
      h("h1", leer[0]), h("p", leer[1]), h("a.knopf.primaer.gross", { href: "#/" }, "Zur Übersicht")));
    return;
  }

  function ende() {
    if (modus === "chrono") lsSet(`pos.${rolle}`, null);
    const n = ergebnis.rot + ergebnis.gelb + ergebnis.gruen;
    leeren(seite).append(h("div.seite.mitte.fertig",
      h("div.funken", { "aria-hidden": "true" }, "✦ ✦ ✦"),
      h("h1", "Geschafft!"),
      h("p", modus === "chrono"
        ? `Du bist alle Karten von ${f.kurz} bis zum Schluss durchgegangen.`
        : `${MODI[modus].name}: ${n} Bewertungen in dieser Runde.`),
      n > 0 && h("ul.ergebnis",
        AMPEL.map((a) => h("li", { "data-wert": a.wert }, h("b", String(ergebnis[a.wert])), " ", a.text))),
      h("a.knopf.primaer.gross", { href: "#/" }, "Zur Übersicht"),
      modus === "chrono" && h("button.knopf", { onclick() { i = 0; zeichnen(); } }, "Nochmals von vorne")));
  }

  function zeichnen(richtung = 0) {
    if (i >= queue.length) return ende();
    const k = queue[i];
    if (modus === "chrono") lsSet(`pos.${rolle}`, k.id);
    const z = zustand(k, fortschritt.get(k.id), heute);
    const e = fortschritt.get(k.id);
    seite.style.setProperty("--akt", k.farbe);
    seite.style.setProperty("--akt-text", kontrastFarbe(k.farbe));

    const gemeinsam = k.gemeinsamMit.length
      ? h("p.hinweis.gemeinsam", `Gemeinsam mit ${k.gemeinsamMit.join(", ")}${k.sammel ? ` («${k.sammel}»)` : ""}`)
      : null;
    const teil = k.teil ? h("span.teil", `Teil ${k.teil.nr} von ${k.teil.von}`)
      : (alleKarten.some((x) => x.replikId === k.replikId && x.teil) ? h("span.teil", "Ganze Replik") : null);
    const fach = z.neu ? h("span.fach.neu", "Neu") : h("span.fach", { title: "Fach in der Lernkartei" },
      z.geaendert ? "Text geändert" : `Fach ${z.fach}`);

    const vorleseKnopf = verfuegbar() && h("button.vorlesen", {
      "aria-label": "Stichwort vorlesen", title: "Stichwort vorlesen",
      onclick(ev) { ev.stopPropagation(); interagiert = true; entsperren(); vorlesen(autoVorlesen); },
    }, "▶︎");
    const stichwortZeile = k.stichwort
      ? h("p.stichwort",
          h("b.sprecher", k.stichwort.eigen ? (k.teil ? "Du (vorheriger Abschnitt): " : "Du (vorher): ") : `${k.stichwort.sprecher}: `),
          h("span", k.stichwort.text))
      : h("p.stichwort.anfang", "Du beginnst die Szene.");

    const vorne = h("div.kartenseite.vorne", { "aria-hidden": gedreht ? "true" : "false" },
      h("div.band", h("span", `Akt ${k.akt} · Szene ${k.szene} · ${k.ort}`), teil),
      h("div.inhalt",
        k.kopf && h("p.szenenkopf", k.kopf),
        h("div.stichwort-reihe", stichwortZeile, vorleseKnopf),
        gemeinsam,
        hilfeText(k, hilfe),
        h("div.meta", fach,
          !z.neu && !z.geaendert && e && h("span.zuletzt", { "data-wert": e.wert }, `Zuletzt: ${AMPEL_TEXT[e.wert]}`)),
        h("p.tipp", hilfe === 3 ? "Lies deinen Text – dann umdrehen und bewerten." : "Sprich deinen Text – dann umdrehen.")));

    const hinten = h("div.kartenseite.hinten", { "aria-hidden": gedreht ? "false" : "true" },
      h("div.band", h("span", `${f.kurz} · Szene ${k.szene}`), teil?.cloneNode(true)),
      h("div.inhalt",
        h("p.label", "Dein Text"),
        gemeinsam?.cloneNode(true),
        eigenerText(k),
        h("p.tipp", "Wie gut konntest du es?")));

    const karte = h("div.karte", {
      class: "karte" + (gedreht ? " gedreht" : ""), role: "button", tabindex: "0",
      "aria-label": gedreht ? "Karte zeigt deinen Text. Tippen zum Zurückdrehen." : "Karte zeigt das Stichwort. Tippen zum Umdrehen.",
      onclick(ev) { if (!ev.target.closest(".hilfe-wahl, .vorlesen")) { interagiert = true; entsperren(); drehen(); } },
    }, vorne, hinten);

    const buehne = h("div.buehne", karte);
    if (richtung && !reducedMotion) buehne.classList.add(richtung > 0 ? "rein-rechts" : "rein-links");
    wischen(buehne);

    const hilfeWahl = h("div.hilfe-wahl", { role: "radiogroup", "aria-label": "Hilfestufe" },
      HILFESTUFEN.map((s) => h("button", {
        class: "hilfe-knopf" + (s.id === hilfe ? " aktiv" : ""), role: "radio",
        "aria-checked": s.id === hilfe ? "true" : "false", title: s.name,
        onclick() { hilfe = s.id; lsSet("hilfe", hilfe); zeichnen(); },
      }, s.kurz)));

    const aktionen = gedreht
      ? h("footer.aktionen.ampel",
          h("div.ampel-reihe", AMPEL.map((a, n) => h("button", {
            class: `knopf ampel-knopf ${a.wert}`, "data-wert": a.wert, title: `${a.hilfe} (Taste ${n + 1})`,
            onclick(ev) { ev.stopPropagation(); interagiert = true; entsperren(); bewerte(a.wert); },
          }, h("span.punkt", { "aria-hidden": "true" }, "●"), h("span", a.text)))),
          h("button.link", { onclick: drehen }, "↺ Vorderseite nochmals ansehen"))
      : h("footer.aktionen",
          h("button.knopf.rund", { onclick: () => gehe(-1), disabled: i === 0, "aria-label": "Vorherige Karte" }, "‹"),
          h("button.knopf.primaer.gross.umdrehen", { onclick() { interagiert = true; entsperren(); drehen(); } }, "Umdrehen"),
          h("button.knopf.rund", { onclick: () => gehe(1), "aria-label": "Nächste Karte" }, "›"));

    leeren(seite).append(
      h("header.kartenkopf",
        h("a.zurueck", { href: "#/", "aria-label": "Zur Übersicht" }, "‹"),
        h("div.titel", h("b", MODI[modus].name), h("span", `Akt ${k.akt} · Szene ${k.szene} · ${ph.name}`)),
        verfuegbar() && h("button.auto-knopf", {
          class: "auto-knopf" + (autoVorlesen ? " an" : ""), "aria-pressed": autoVorlesen ? "true" : "false",
          title: "Stichworte automatisch vorlesen",
          onclick() {
            autoVorlesen = !autoVorlesen; lsSet("autoVorlesen", autoVorlesen); interagiert = true; entsperren();
            if (autoVorlesen && !gedreht) vorlesen(true); else abbrechen();
            zeichnenKopf();
          },
        }, autoVorlesen ? "🔊 Auto" : "🔈 Auto"),
        h("span.zaehler", `${i + 1} / ${queue.length}`)),
      h("div.fortschritt", { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": queue.length, "aria-valuenow": i + 1 },
        h("span", { style: { width: `${((i + 1) / queue.length) * 100}%` } })),
      ...(gedreht ? [] : [hilfeWahl]),
      buehne, aktionen);
  }

  function zeichnenKopf() {
    const b = seite.querySelector(".auto-knopf");
    if (!b) return;
    b.classList.toggle("an", autoVorlesen);
    b.setAttribute("aria-pressed", autoVorlesen ? "true" : "false");
    b.textContent = autoVorlesen ? "🔊 Auto" : "🔈 Auto";
  }

  function abbrechen() {
    ablauf++;
    clearTimeout(pauseTimer);
    stop();
    seite.querySelector(".sprech-pause")?.remove();
  }

  async function vorlesen(auto = false) {
    if (!verfuegbar() || i >= queue.length || gedreht) return;
    abbrechen();
    const meinAblauf = ablauf;
    const k = queue[i];
    if (!audio) audio = await stimmenFuerStueck(app.stueck).catch(() => null);
    const sw = k.stichwort;
    const text = sw ? (lsGet("vorlesen", "satz") === "ganz" ? sw.ganz : sw.text) : (k.kopf ?? `Szene ${k.szene}`);
    const stimme = audio?.zuteilung.get(sw?.sprecherIds?.[0]) ?? {};
    seite.querySelector(".vorlesen")?.classList.add("laeuft");
    const fertig = await sprich(text, stimme);
    seite.querySelector(".vorlesen")?.classList.remove("laeuft");
    if (!auto || !fertig || meinAblauf !== ablauf || gedreht) return;
    // Pause zum Sprechen, Länge nach eigener Replik
    const ms = sprechPause(k.text, lsGet("pauseFaktor", 1));
    const balken = h("div.sprech-pause", { role: "status" },
      h("span", "Dein Einsatz …"), h("i", { style: { animationDuration: `${ms}ms` } }));
    seite.querySelector(".kartenseite.vorne .inhalt")?.append(balken);
    if (lsGet("pauseModus", "auto") === "auto") {
      pauseTimer = setTimeout(() => { if (meinAblauf === ablauf && !gedreht) drehen(); }, ms);
    }
  }

  function drehen() {
    abbrechen();
    gedreht = !gedreht;
    const karte = seite.querySelector(".karte");
    if (karte && !reducedMotion) {
      karte.classList.toggle("gedreht", gedreht);
      setTimeout(() => zeichnen(), 420);
    } else {
      zeichnen();
    }
    seite.querySelector(".buehne")?.scrollIntoView?.({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
  }

  function gehe(d) {
    const neu = Math.min(Math.max(i + d, 0), queue.length);
    if (neu === i) return;
    abbrechen();
    i = neu;
    gedreht = false;
    zeichnen(d);
    if (autoVorlesen && interagiert) setTimeout(() => vorlesen(true), reducedMotion ? 0 : 300);
  }

  async function bewerte(wert) {
    const k = queue[i];
    const eintrag = bewerten(fortschritt.get(k.id), k, wert, { heute, phase: ph, hilfe });
    fortschritt.set(k.id, eintrag);
    ergebnis[wert]++;
    // Fach 1 = gleiche Sitzung: "Nicht gewusst" kommt in dieser Runde nochmals (nicht chronologisch)
    if (modus !== "chrono" && eintrag.fach === 1 && (wiederholt.get(k.id) ?? 0) < MAX_WIEDERHOLUNG) {
      wiederholt.set(k.id, (wiederholt.get(k.id) ?? 0) + 1);
      queue.splice(Math.min(i + 1 + WIEDERHOLEN_NACH, queue.length), 0, k);
    }
    try {
      await bewertungSpeichern(rolle, eintrag, heute, { karte: k.id, modus, zeit: Date.now() });
    } catch { /* Speicher gesperrt: Sitzung läuft trotzdem weiter */ }
    gehe(1);
  }

  function wischen(el) {
    let x0 = null, y0 = null;
    el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { e.preventDefault(); gehe(dx < 0 ? 1 : -1); }
    });
  }

  const taste = (e) => {
    if (!document.body.contains(seite)) return document.removeEventListener("keydown", taste);
    if (e.target.closest?.("input, textarea, select")) return;
    if (e.key === " " || e.key === "Enter") {
      if (e.target.closest?.("button, a")) return; // Knöpfe selbst auslösen lassen
      e.preventDefault(); drehen();
    }
    else if (e.key === "ArrowRight") gehe(1);
    else if (e.key === "ArrowLeft") gehe(-1);
    else if (e.key === "v" && !gedreht) { interagiert = true; vorlesen(autoVorlesen); }
    else if (gedreht && ["1", "2", "3"].includes(e.key)) bewerte(AMPEL[Number(e.key) - 1].wert);
  };
  document.addEventListener("keydown", taste);

  zeichnen();
}
