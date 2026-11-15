import { h, leeren } from "../dom.js";
import { rollenListe } from "../roles.js";

export function zeigeRollenwahl(root, app) {
  const aktuell = app.rolle;
  const gruppen = rollenListe(app.stueck);
  leeren(root).append(h("section.seite",
    h("header.kopfzeile",
      aktuell && h("a.zurueck", { href: "#/", "aria-label": "Zurück" }, "‹"),
      h("h1", aktuell ? "Rolle wechseln" : "Welche Rolle spielst du?")),
    h("p.unter", aktuell
      ? "Dein Fortschritt wird pro Rolle gespeichert. Ein Wechsel löscht nichts."
      : "Tippe auf deine Rolle. Du kannst sie später in den Einstellungen wechseln."),
    gruppen.map((g) => h("section.gruppe",
      h("h2", g.titel),
      h("ul.rollen", g.rollen.map((r) => h("li",
        h("button.rolle", {
          class: "rolle" + (r.id === aktuell ? " aktiv" : ""),
          "aria-pressed": r.id === aktuell ? "true" : "false",
          onclick() { app.rolle = r.id; app.gehe("#/"); },
        },
        h("span.name", r.name),
        r.beschreibung && h("span.beschr", r.beschreibung),
        h("span.anzahl", `${r.einsaetze} ${r.einsaetze === 1 ? "Einsatz" : "Einsätze"}`)))))))
  ));
}
