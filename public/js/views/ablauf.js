// Ablauf: alle Szenen in Aktfarben mit Ort, Personen und Kurzfassung; eigene Szenen markiert.
import { h, leeren, kontrastFarbe } from "../dom.js";
import { szenenListe } from "../quiz.js";
import { lsGet, lsSet } from "../store.js";

export function zeigeAblauf(root, app) {
  const rolle = app.rolle;
  const f = app.rolleFigur();
  const figs = new Map(app.stueck.figuren.map((x) => [x.id, x.kurz ?? x.name]));
  const szenen = szenenListe(app.stueck);
  const nurMeine = lsGet("ablauf.nurMeine", false);
  const meine = szenen.filter((s) => s.sprecher.includes(rolle)).length;

  const akte = new Map();
  for (const s of szenen) {
    if (nurMeine && !s.sprecher.includes(rolle)) continue;
    if (!akte.has(s.akt)) akte.set(s.akt, { farbe: s.farbe, szenen: [] });
    akte.get(s.akt).szenen.push(s);
  }

  leeren(root).append(h("section.seite.ablauf",
    h("header.kopfzeile", h("a.zurueck", { href: "#/", "aria-label": "Zurück" }, "‹"), h("h1", "Ablauf des Stücks")),
    h("p.unter", `${szenen.length} Szenen · du (${f.kurz}) bist in ${meine} dabei.`),
    h("div.knopfreihe",
      h("a.knopf", { href: "#/weg" }, "Mein Weg"),
      h("a.knopf.primaer", { href: "#/quiz" }, "Ablauf-Quiz")),
    h("label.schalter", h("input", {
      type: "checkbox", checked: nurMeine,
      onchange(ev) { lsSet("ablauf.nurMeine", ev.target.checked); zeigeAblauf(root, app); },
    }), h("span", "Nur meine Szenen")),
    [...akte].map(([akt, a]) => h("section.akt-block",
      h("h2.akt-titel", { style: { "--akt": a.farbe, "--akt-text": kontrastFarbe(a.farbe) } }, `Akt ${akt}`),
      h("ol.ablauf-liste", a.szenen.map((s) => {
        const dabei = s.sprecher.includes(rolle);
        return h("li", { class: "ablauf-szene" + (dabei ? " dabei" : ""), style: { "--akt": a.farbe } },
          h("div.ablauf-kopf",
            h("b", `Szene ${s.id}`), h("span.ort", s.ort),
            dabei && h("span.du", { title: "Du sprichst in dieser Szene" }, "du")),
          s.kurzfassung && h("p", s.kurzfassung),
          h("p.klein", "Es sprechen: ", s.sprecher.map((id) => figs.get(id) ?? id).join(", ")),
          dabei && h("a.link-klein", { href: `#/lernen?ab=${s.id}` }, "Diese Szene lernen ›"));
      })))),
  ));
}
