import { h, leeren, kontrastFarbe } from "../dom.js";
import { kartenFuer, indexAbSzene } from "../cards.js";
import { szenenDerRolle } from "../roles.js";
import { lsGet } from "../store.js";

export function zeigeStart(root, app) {
  const f = app.rolleFigur();
  const karten = kartenFuer(app.stueck, f.id);
  const pos = lsGet(`pos.${f.id}`);
  const posIndex = pos ? karten.findIndex((k) => k.id === pos) : -1;
  const szenen = szenenDerRolle(app.stueck, f.id);

  const weiter = posIndex > 0
    ? h("a.knopf.primaer.gross", { href: `#/lernen?karte=${encodeURIComponent(pos)}` },
      h("span", "Weiterlernen"),
      h("small", `Szene ${karten[posIndex].szene} · Karte ${posIndex + 1} von ${karten.length}`))
    : h("a.knopf.primaer.gross", { href: "#/lernen" },
      h("span", "Von vorne lernen"), h("small", `${karten.length} Karten`));

  const proAkt = new Map();
  for (const s of szenen) {
    if (!proAkt.has(s.akt)) proAkt.set(s.akt, { farbe: s.farbe, szenen: [] });
    proAkt.get(s.akt).szenen.push(s);
  }

  leeren(root).append(h("section.seite.start",
    h("header.kopfzeile",
      h("div",
        h("p.dachzeile", app.stueck.titel),
        h("h1", "Du spielst: ", h("span.rollenname", f.name))),
      h("a.icon", { href: "#/einstellungen", "aria-label": "Einstellungen", title: "Einstellungen" }, "⚙")),
    weiter,
    h("h2", "Chronologisch ab Szene"),
    h("p.unter", "Nur Szenen, in denen du sprichst."),
    [...proAkt].map(([akt, a]) => h("section.akt-block",
      h("h3.akt-titel", { style: { "--akt": a.farbe, "--akt-text": kontrastFarbe(a.farbe) } }, `Akt ${akt}`),
      h("div.szenen", a.szenen.map((s) => h("a.szene-chip", {
        href: `#/lernen?ab=${s.id}`,
        style: { "--akt": a.farbe },
        "aria-label": `Szene ${s.id}, ${s.ort}, ${karten.length - indexAbSzene(karten, s.id)} Karten bis zum Schluss`,
      }, h("b", s.id), h("span", s.ort)))))),
  ));
}
