// Badge-Vitrine und Prüfung auf neue Badges (mit Funken-Animation in Aktfarbe).
import { h, leeren } from "../dom.js";
import { kartenFuer } from "../cards.js";
import { fortschrittFuer, rolleLaden, rolleAktualisieren } from "../store.js";
import { badgeKontext, berechneBadges, neueBadges } from "../badges.js";
import { tagKey } from "../leitner.js";

const AKT_FARBEN = ["#E8B10E", "#E9731C", "#C62828"];
const datum = (t) => new Date(t + "T12:00").toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });

export async function badgesLaden(app) {
  const rolle = app.rolle;
  const [fortschritt, meta] = await Promise.all([fortschrittFuer(rolle), rolleLaden(rolle)]);
  const karten = kartenFuer(app.stueck, rolle);
  return { meta, liste: berechneBadges(badgeKontext({ stueck: app.stueck, karten, fortschritt, meta, heute: tagKey() })) };
}

/** Prüft auf neu erreichte Badges, speichert das Datum und zeigt eine Animation. */
export async function pruefeBadges(app) {
  try {
    const { liste } = await badgesLaden(app);
    const neu = neueBadges(liste);
    if (!neu.length) return [];
    const heute = tagKey();
    await rolleAktualisieren(app.rolle, (r) => {
      r.badges = { ...(r.badges ?? {}) };
      for (const id of neu) r.badges[id] ??= heute;
    });
    for (const id of neu) feiern(liste.find((b) => b.id === id));
    return neu;
  } catch {
    return [];
  }
}

let warteschlange = Promise.resolve();
function feiern(b) {
  warteschlange = warteschlange.then(() => new Promise((fertig) => {
    const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const farbe = b.akt ? AKT_FARBEN[b.akt - 1] : AKT_FARBEN[1];
    const funken = ruhig ? [] : Array.from({ length: 28 }, (_, i) => {
      const winkel = (i / 28) * Math.PI * 2;
      const weite = 70 + (i % 5) * 18;
      return h("i.funke", { style: {
        "--x": `${Math.cos(winkel) * weite}px`, "--y": `${Math.sin(winkel) * weite}px`,
        background: AKT_FARBEN[i % 3], animationDelay: `${(i % 4) * 40}ms`,
      } });
    });
    const el = h("div.badge-toast", { role: "status", "aria-live": "polite", style: { "--farbe": farbe },
      onclick() { schliessen(); } },
      h("div.funken-wolke", { "aria-hidden": "true" }, funken),
      h("div.badge-symbol", b.symbol),
      h("p.klein", "Neues Badge!"),
      h("b", b.name),
      h("p.klein", b.text));
    document.body.append(el);
    const t = setTimeout(schliessen, ruhig ? 3500 : 3000);
    function schliessen() { clearTimeout(t); el.classList.add("weg"); setTimeout(() => { el.remove(); fertig(); }, 250); }
  }));
}

export async function zeigeBadges(root, app) {
  const f = app.rolleFigur();
  let liste = [];
  try { ({ liste } = await badgesLaden(app)); } catch { /* leer */ }
  const erreicht = liste.filter((b) => b.erreicht).sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
  const offen = liste.filter((b) => !b.erreicht);

  const karte = (b) => h("li", { class: "badge" + (b.erreicht ? " erreicht" : "") },
    h("div.badge-symbol", { "aria-hidden": "true" }, b.symbol),
    h("div",
      h("b", b.name),
      h("p.klein", b.text),
      b.erreicht
        ? h("p.klein.datum", b.datum ? `Erreicht am ${datum(b.datum)}` : "Erreicht")
        : (b.ziel > 1 || b.prozent) && h("div.badge-fortschritt",
          h("span", { style: { width: `${Math.min(100, (b.ist / (b.ziel || 1)) * 100)}%` } }),
          h("small", b.prozent ? `${b.ist} %` : `${b.ist} / ${b.ziel}`))));

  leeren(root).append(h("section.seite.badges",
    h("header.kopfzeile", h("a.zurueck", { href: "#/", "aria-label": "Zurück" }, "‹"), h("h1", "Badges")),
    h("p.unter", `${f.name}: ${erreicht.length} von ${liste.length} erreicht.`),
    erreicht.length > 0 && h("h2", "Erreicht"),
    erreicht.length > 0 && h("ul.badge-liste", erreicht.map(karte)),
    offen.length > 0 && h("h2", "Noch offen"),
    offen.length > 0 && h("ul.badge-liste", offen.map(karte)),
  ));
}
