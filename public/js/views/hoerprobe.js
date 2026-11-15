// Hörprobe: eine ganze Szene läuft ab, alle anderen Rollen sprechen mit ihren Stimmen.
// Bei der eigenen Rolle: anhalten (bis Tippen), Text nach einer Pause einblenden, oder mitlesen.
import { h, leeren, kontrastFarbe } from "../dom.js";
import { szenenDerRolle } from "../roles.js";
import { lsGet, lsSet, rolleAktualisieren } from "../store.js";
import { stimmenFuerStueck, sprich, stop, entsperren, verfuegbar, wachHalten } from "../speech.js";
import { sprechPause } from "../voices.js";
import { pruefeBadges } from "./badges.js";

export const EIGEN_MODI = [
  ["anhalten", "Anhalten", "Wartet, bis du «Weiter» tippst"],
  ["einblenden", "Einblenden", "Zeigt deinen Text nach einer Pause"],
  ["vorlesen", "Mitlesen", "Liest deinen Text ebenfalls vor"],
];

function szenenWahl(root, app) {
  const f = app.rolleFigur();
  const eigene = new Set(szenenDerRolle(app.stueck, f.id).map((s) => s.id));
  const alle = lsGet("hoerprobe.alle", false);
  leeren(root).append(h("section.seite",
    h("header.kopfzeile", h("a.zurueck", { href: "#/", "aria-label": "Zurück" }, "‹"), h("h1", "Hörprobe")),
    h("p.unter", "Eine ganze Szene zum Zuhören. Bei deinem Einsatz hält die App an – sprich deinen Text."),
    !verfuegbar() && h("p.hinweis-box", "Dieser Browser kann keine Sprachausgabe. Auf dem iPhone in Safari öffnen."),
    h("label.schalter", h("input", {
      type: "checkbox", checked: alle,
      onchange(ev) { lsSet("hoerprobe.alle", ev.target.checked); szenenWahl(root, app); },
    }), h("span", "Auch Szenen ohne meine Rolle zeigen")),
    app.stueck.akte.map((a) => {
      const szenen = a.szenen.filter((s) => alle || eigene.has(s.id));
      if (!szenen.length) return null;
      return h("section.akt-block",
        h("h3.akt-titel", { style: { "--akt": a.farbe, "--akt-text": kontrastFarbe(a.farbe) } }, `Akt ${a.nr}`),
        h("div.szenen", szenen.map((s) => h("a.szene-chip", {
          class: "szene-chip" + (eigene.has(s.id) ? "" : " fremd"),
          href: `#/hoerprobe?szene=${s.id}`, style: { "--akt": a.farbe }, "aria-label": `Szene ${s.id}, ${s.ort}`,
        }, h("b", s.id), h("span", s.ort)))));
    }),
  ));
}

export async function zeigeHoerprobe(root, app, params) {
  const szeneId = params.get("szene");
  if (!szeneId) return szenenWahl(root, app);

  const rolle = app.rolle;
  const f = app.rolleFigur();
  const akt = app.stueck.akte.find((a) => a.szenen.some((s) => s.id === szeneId));
  const sz = akt?.szenen.find((s) => s.id === szeneId);
  if (!sz) return szenenWahl(root, app);
  const zeilen = sz.repliken.filter((r) => r.text);
  const figs = new Map(app.stueck.figuren.map((x) => [x.id, x]));
  const name = (r) => r.sammel ?? r.sprecher.map((id) => figs.get(id)?.kurz ?? id).join(", ");
  const eigen = (r) => r.sprecher.includes(rolle);

  const eigeneSzenen = szenenDerRolle(app.stueck, rolle).map((s) => s.id);
  const alleSzenen = app.stueck.akte.flatMap((a) => a.szenen.map((s) => s.id));
  const liste = lsGet("hoerprobe.alle", false) ? alleSzenen : eigeneSzenen;
  const naechste = liste[liste.indexOf(szeneId) + 1] ?? null;

  let modus = lsGet("hoerprobe.eigen", "anhalten");
  let pos = 0;
  let spielt = false;
  let lauf = 0;
  let weiter = null; // resolve-Funktion, wenn auf Tippen gewartet wird
  const gezeigt = new Set();
  let audio = null;

  const seite = h("section.hoerprobe-seite", { style: { "--akt": akt.farbe, "--akt-text": kontrastFarbe(akt.farbe) } });
  leeren(root).append(seite);

  const liste_el = h("ol.skript", zeilen.map((r, n) => h("li", {
    class: "zeile" + (eigen(r) ? " eigen" : ""), "data-n": n,
    onclick() { if (!spielt) { pos = n; markieren(); } },
  },
  h("b.wer", eigen(r) ? `${name(r)} (du)` : name(r)),
  h("span.was", eigen(r) ? "· · · dein Text · · ·" : r.text))));

  const status = h("p.status", { role: "status", "aria-live": "polite" });
  const playKnopf = h("button.knopf.primaer.gross.play", { onclick: umschalten }, "▶︎ Abspielen");
  const weiterKnopf = h("button.knopf.gross.weiter-knopf", { hidden: true, onclick() { weiter?.(); } }, "Weiter ›");

  const modusWahl = h("div.segmente.klein-segmente", { role: "radiogroup", "aria-label": "Bei deinem Text" },
    EIGEN_MODI.map(([id, titel, hilfe]) => h("label", { title: hilfe },
      h("input", { type: "radio", name: "eigen", value: id, checked: id === modus,
        onchange() { modus = id; lsSet("hoerprobe.eigen", id); } }),
      h("span", titel))));

  seite.append(
    h("header.kartenkopf",
      h("a.zurueck", { href: "#/hoerprobe", "aria-label": "Zur Szenenwahl" }, "‹"),
      h("div.titel", h("b", `Hörprobe · Szene ${sz.id}`), h("span", `${sz.ort} · du spielst ${f.kurz}`)),
      h("a.icon", { href: "#/stimmen", "aria-label": "Stimmen einstellen", title: "Stimmen" }, "🎙")),
    h("div.band.hoer-band", h("span", `Akt ${akt.nr} · Szene ${sz.id}`), h("span", `${zeilen.length} Repliken`)),
    h("fieldset.auswahl", h("legend", "Bei deinem Text"), modusWahl),
    status,
    liste_el,
    h("footer.aktionen.hoer-aktionen",
      h("button.knopf.rund", { "aria-label": "Vorherige Replik", onclick() { springe(-1); } }, "⏮"),
      playKnopf, weiterKnopf,
      h("button.knopf.rund", { "aria-label": "Nächste Replik", onclick() { springe(1); } }, "⏭")),
  );

  function markieren() {
    liste_el.querySelectorAll(".zeile").forEach((li) => {
      const n = Number(li.dataset.n);
      li.classList.toggle("aktuell", n === pos);
      li.classList.toggle("vorbei", n < pos);
      if (gezeigt.has(n)) {
        li.classList.add("gezeigt");
        li.querySelector(".was").textContent = zeilen[n].text;
      }
    });
    liste_el.querySelector(".aktuell")?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }

  function anhalten() {
    lauf++;
    spielt = false;
    stop();
    weiter?.(false);
    weiter = null;
    weiterKnopf.hidden = true;
    playKnopf.hidden = false;
    playKnopf.textContent = pos > 0 && pos < zeilen.length ? "▶︎ Fortsetzen" : "▶︎ Abspielen";
    status.textContent = "";
    wachHalten(false);
  }

  function springe(d) {
    const warSpielend = spielt;
    anhalten();
    pos = Math.min(Math.max(pos + d, 0), zeilen.length - 1);
    markieren();
    if (warSpielend) abspielen();
  }

  function umschalten() {
    entsperren();
    if (spielt) anhalten(); else abspielen();
  }

  const warte = (ms, meinLauf) => new Promise((r) => setTimeout(() => r(meinLauf === lauf), ms));
  const aufTippen = () => new Promise((r) => { weiter = (x = true) => { weiter = null; r(x); }; });

  async function abspielen() {
    if (!audio) {
      status.textContent = "Stimmen werden geladen …";
      audio = await stimmenFuerStueck(app.stueck).catch(() => null);
    }
    if (pos >= zeilen.length) pos = 0;
    spielt = true;
    const meinLauf = ++lauf;
    playKnopf.textContent = "⏸ Pause";
    wachHalten(true);
    while (pos < zeilen.length && meinLauf === lauf) {
      markieren();
      const r = zeilen[pos];
      if (eigen(r) && modus !== "vorlesen") {
        if (modus === "anhalten") {
          status.textContent = "Dein Einsatz – sprich deinen Text, dann «Weiter».";
          playKnopf.hidden = true;
          weiterKnopf.hidden = false;
          const ok = await aufTippen();
          weiterKnopf.hidden = true;
          playKnopf.hidden = false;
          if (!ok || meinLauf !== lauf) return;
        } else {
          const ms = sprechPause(r.text, lsGet("pauseFaktor", 1));
          status.textContent = `Dein Einsatz … (${Math.round(ms / 1000)} s)`;
          if (!(await warte(ms, meinLauf))) return;
        }
        gezeigt.add(pos);
        markieren();
        status.textContent = "";
        if (!(await warte(modus === "anhalten" ? 300 : 1200, meinLauf))) return;
      } else {
        status.textContent = "";
        gezeigt.add(pos);
        markieren();
        const stimme = audio?.zuteilung.get(r.sprecher[0]) ?? {};
        const ok = await sprich(r.text, stimme);
        if (!ok && meinLauf !== lauf) return;
        if (!(await warte(250, meinLauf))) return;
      }
      pos++;
    }
    if (meinLauf !== lauf) return;
    spielt = false;
    wachHalten(false);
    try { await rolleAktualisieren(rolle, (x) => { x.hoerproben = (x.hoerproben ?? 0) + 1; }); } catch { /* egal */ }
    pruefeBadges(app);
    status.textContent = "";
    leeren(seite.querySelector(".hoer-aktionen")).append(
      h("a.knopf", { href: "#/hoerprobe" }, "Szenen"),
      naechste
        ? h("a.knopf.primaer.gross", { href: `#/hoerprobe?szene=${naechste}` }, `Weiter mit Szene ${naechste} ›`)
        : h("a.knopf.primaer.gross", { href: "#/" }, "Fertig"));
    seite.querySelector(".hoer-aktionen").before(h("p.fertig-hinweis", "✦ Szene fertig gehört ✦"));
  }

  markieren();
}
