import { h, leeren, kontrastFarbe } from "../dom.js";
import { kartenFuer } from "../cards.js";
import { bereichFilter } from "../leitner.js";

export function zeigeZufall(root, app) {
  const karten = kartenFuer(app.stueck, app.rolle);
  const akte = new Map();
  for (const k of karten) {
    if (!akte.has(k.akt)) akte.set(k.akt, { farbe: k.farbe, szenen: new Map() });
    akte.get(k.akt).szenen.set(k.szene, k.ort);
  }
  const link = (bereich) => `#/lernen?modus=zufall&bereich=${encodeURIComponent(bereich)}`;
  const n = (bereich) => bereichFilter(karten, bereich).length;

  leeren(root).append(h("section.seite",
    h("header.kopfzeile", h("a.zurueck", { href: "#/", "aria-label": "Zurück" }, "‹"), h("h1", "Zufall")),
    h("p.unter", "Deine Karten gemischt. Wähle, woraus gemischt wird."),
    h("a.knopf.primaer.gross", { href: link("stueck") }, h("span", "Ganzes Stück"), h("small", `${karten.length} ${karten.length === 1 ? "Karte" : "Karten"}`)),
    [...akte].map(([akt, a]) => h("section.akt-block",
      h("a.knopf.gross.akt-knopf", {
        href: link(`akt:${akt}`), style: { "--akt": a.farbe, "--akt-text": kontrastFarbe(a.farbe) },
      }, h("span", `Akt ${akt}`), h("small", `${n(`akt:${akt}`)} ${n(`akt:${akt}`) === 1 ? "Karte" : "Karten"}`)),
      h("div.szenen", [...a.szenen].map(([sz, ort]) => h("a.szene-chip", {
        href: link(`szene:${sz}`), style: { "--akt": a.farbe }, "aria-label": `Szene ${sz}, ${ort}`,
      }, h("b", sz), h("span", `${n(`szene:${sz}`)} ${n(`szene:${sz}`) === 1 ? "Karte" : "Karten"}`)))))),
  ));
}
