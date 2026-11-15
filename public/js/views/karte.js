// Kartenansicht «Chronologisch»: Vorderseite Stichwort → von Hand umdrehen →
// Rückseite eigener Text + Selbstbewertung (Ampel).
import { h, leeren, kontrastFarbe } from "../dom.js";
import { kartenFuer, indexAbSzene, textStuecke } from "../cards.js";
import { bewertungSetzen, bewertungenFuer, lsGet, lsSet } from "../store.js";

export const AMPEL = [
  { wert: "rot", text: "Nöd gwüsst", symbol: "●", hilfe: "Zurück an den Anfang" },
  { wert: "gelb", text: "Fast", symbol: "●", hilfe: "Bleibt, nochmals üben" },
  { wert: "gruen", text: "Sass", symbol: "●", hilfe: "Sitzt" },
];
const AMPEL_TEXT = Object.fromEntries(AMPEL.map((a) => [a.wert, a.text]));

const mitAbsaetzen = (text) => text.split("\n\n").flatMap((t, i) => (i ? [h("br"), h("br"), t] : [t]));

function stichwortText(sw) {
  const vor = sw.text.slice(0, sw.fettAb);
  const fett = sw.text.slice(sw.fettAb);
  return h("p.stichwort-text", mitAbsaetzen(vor), h("strong", mitAbsaetzen(fett)));
}

function eigenerText(k) {
  const absaetze = [[]];
  for (const s of textStuecke(k.text, k.regie)) {
    if (s.typ === "absatz") absaetze.push([]);
    else if (s.typ === "regie") absaetze[absaetze.length - 1].push(h("span.regie", `(${s.text}) `));
    else absaetze[absaetze.length - 1].push(s.text);
  }
  return h("div.eigener-text", absaetze.filter((a) => a.length).map((a) => h("p", a)));
}

export async function zeigeKarten(root, app, params) {
  const rolle = app.rolle;
  const f = app.rolleFigur();
  const karten = kartenFuer(app.stueck, rolle);
  let bewertungen = new Map();
  try { bewertungen = await bewertungenFuer(rolle); } catch { /* ohne IndexedDB weiter */ }

  let i = 0;
  if (params.get("karte")) i = Math.max(0, karten.findIndex((k) => k.id === params.get("karte")));
  else if (params.get("ab")) i = indexAbSzene(karten, params.get("ab"));
  let gedreht = false;

  const seite = h("section.karten-seite");
  leeren(root).append(seite);

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function ende() {
    lsSet(`pos.${rolle}`, null);
    leeren(seite).append(h("div.seite.mitte.fertig",
      h("div.funken", { "aria-hidden": "true" }, "✦ ✦ ✦"),
      h("h1", "Geschafft!"),
      h("p", `Du bist alle ${karten.length} Karten von ${f.kurz} bis zum Schluss durchgegangen.`),
      h("a.knopf.primaer.gross", { href: "#/" }, "Zur Übersicht"),
      h("button.knopf", { onclick() { i = 0; zeichnen(); } }, "Nochmals von vorne")));
  }

  function zeichnen(richtung = 0) {
    if (i >= karten.length) return ende();
    const k = karten[i];
    lsSet(`pos.${rolle}`, k.id);
    const vorher = bewertungen.get(k.id);
    const vorherGilt = vorher && vorher.hash === k.hash;
    const aktText = kontrastFarbe(k.farbe);
    seite.style.setProperty("--akt", k.farbe);
    seite.style.setProperty("--akt-text", aktText);

    const gemeinsam = k.gemeinsamMit.length
      ? h("p.hinweis.gemeinsam", `Gemeinsam mit ${k.gemeinsamMit.join(", ")}${k.sammel ? ` («${k.sammel}»)` : ""}`)
      : null;
    const teil = k.teil ? h("span.teil", `Teil ${k.teil.nr} von ${k.teil.von}`) : (
      karten[i - 1]?.replikId === k.replikId ? h("span.teil", "Ganze Replik") : null);

    const vorne = h("div.kartenseite.vorne", { "aria-hidden": gedreht ? "true" : "false" },
      h("div.band", h("span", `Akt ${k.akt} · Szene ${k.szene} · ${k.ort}`), teil),
      h("div.inhalt",
        k.kopf && h("p.szenenkopf", k.kopf),
        k.stichwort
          ? [h("p.label", k.stichwort.eigen ? "Du davor:" : "Stichwort von"),
             h("p.sprecher", k.stichwort.eigen ? (k.teil ? "dein vorheriger Abschnitt" : `${f.kurz} (du)`) : `${k.stichwort.sprecher}:`),
             stichwortText(k.stichwort)]
          : h("p.label", "Du beginnst die Szene."),
        gemeinsam,
        vorherGilt && h("p.zuletzt", { "data-wert": vorher.wert }, `Zuletzt: ${AMPEL_TEXT[vorher.wert]}`),
        h("p.tipp", "Sprich deinen Text – dann umdrehen.")));

    const hinten = h("div.kartenseite.hinten", { "aria-hidden": gedreht ? "false" : "true" },
      h("div.band", h("span", `${f.kurz} · Szene ${k.szene}`), teil?.cloneNode(true)),
      h("div.inhalt",
        h("p.label", "Dein Text"),
        gemeinsam?.cloneNode(true),
        eigenerText(k),
        h("p.tipp", "Wie gut konntest du es?")));

    const karte = h("div.karte", {
      class: "karte" + (gedreht ? " gedreht" : ""),
      role: "button", tabindex: "0",
      "aria-label": gedreht ? "Karte zeigt deinen Text. Tippen zum Zurückdrehen." : "Karte zeigt das Stichwort. Tippen zum Umdrehen.",
      onclick: drehen,
    }, vorne, hinten);

    const buehne = h("div.buehne", karte);
    if (richtung && !reducedMotion) buehne.classList.add(richtung > 0 ? "rein-rechts" : "rein-links");
    wischen(buehne);

    const fortschritt = h("div.fortschritt", { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": karten.length, "aria-valuenow": i + 1 },
      h("span", { style: { width: `${((i + 1) / karten.length) * 100}%` } }));

    const aktionen = gedreht
      ? h("footer.aktionen.ampel",
          h("div.ampel-reihe", AMPEL.map((a, n) => h("button.knopf.ampel-knopf", {
            class: `knopf ampel-knopf ${a.wert}`, "data-wert": a.wert, title: `${a.hilfe} (Taste ${n + 1})`,
            onclick(ev) { ev.stopPropagation(); bewerten(a.wert); },
          }, h("span.punkt", { "aria-hidden": "true" }, a.symbol), h("span", a.text)))),
          h("button.link", { onclick: drehen }, "↺ Stichwort nochmals ansehen"))
      : h("footer.aktionen",
          h("button.knopf.rund", { onclick: () => gehe(-1), disabled: i === 0, "aria-label": "Vorherige Karte" }, "‹"),
          h("button.knopf.primaer.gross.umdrehen", { onclick: drehen }, "Umdrehen"),
          h("button.knopf.rund", { onclick: () => gehe(1), "aria-label": "Nächste Karte" }, "›"));

    leeren(seite).append(
      h("header.kartenkopf",
        h("a.zurueck", { href: "#/", "aria-label": "Zur Übersicht" }, "‹"),
        h("div.titel", h("b", `Akt ${k.akt} · Szene ${k.szene}`), h("span", k.ort)),
        h("span.zaehler", `${i + 1} / ${karten.length}`)),
      fortschritt, buehne, aktionen);
  }

  function drehen() {
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
    const neu = Math.min(Math.max(i + d, 0), karten.length);
    if (neu === i) return;
    i = neu;
    gedreht = false;
    zeichnen(d);
  }

  async function bewerten(wert) {
    const k = karten[i];
    bewertungen.set(k.id, { wert, hash: k.hash, zeit: Date.now() });
    try { await bewertungSetzen(rolle, k.id, wert, k.hash); } catch { /* Speicher voll/gesperrt */ }
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
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        e.preventDefault();
        gehe(dx < 0 ? 1 : -1);
      }
    });
  }

  const taste = (e) => {
    if (!document.body.contains(seite)) return document.removeEventListener("keydown", taste);
    if (e.target.closest?.("input, textarea, select")) return;
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); drehen(); }
    else if (e.key === "ArrowRight") gehe(1);
    else if (e.key === "ArrowLeft") gehe(-1);
    else if (gedreht && ["1", "2", "3"].includes(e.key)) bewerten(AMPEL[Number(e.key) - 1].wert);
  };
  document.addEventListener("keydown", taste);

  zeichnen();
}
