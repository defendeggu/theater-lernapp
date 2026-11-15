import { h, leeren } from "../dom.js";
import { lsGet, lsSet } from "../store.js";

function auswahl(name, titel, optionen, wert, onchange) {
  return h("fieldset.auswahl", h("legend", titel),
    h("div.segmente", optionen.map(([v, t]) => h("label",
      h("input", { type: "radio", name, value: v, checked: v === wert, onchange: () => onchange(v) }),
      h("span", t)))));
}

export function zeigeEinstellungen(root, app) {
  const f = app.rolleFigur();
  leeren(root).append(h("section.seite.einstellungen",
    h("header.kopfzeile", h("a.zurueck", { href: "#/", "aria-label": "Zurück" }, "‹"), h("h1", "Einstellungen")),

    h("section.block",
      h("h2", "Rolle"),
      h("p", "Du spielst: ", h("b", f.name)),
      h("a.knopf", { href: "#/rolle" }, "Rolle wechseln"),
      h("p.klein", "Der Fortschritt wird pro Rolle gespeichert. Ein Wechsel löscht nichts.")),

    h("section.block",
      h("h2", "Darstellung"),
      auswahl("schrift", "Schriftgrösse", [["klein", "Klein"], ["normal", "Normal"], ["gross", "Gross"], ["riesig", "Sehr gross"]],
        lsGet("schrift", "normal"), (v) => { lsSet("schrift", v); app.schrift(); }),
      auswahl("thema", "Farben", [["auto", "Wie iPhone"], ["light", "Hell"], ["dark", "Dunkel"]],
        lsGet("thema", "auto"), (v) => { lsSet("thema", v); app.schrift(); })),

    h("section.block",
      h("h2", "Passwort"),
      h("p.klein", "Die App merkt sich einen daraus abgeleiteten Schlüssel, nicht das Passwort selbst."),
      h("button.knopf.warnung", {
        async onclick() {
          if (confirm("Passwort auf diesem Gerät vergessen? Du musst es danach neu eingeben. Dein Lernstand bleibt.")) {
            await app.passwortZuruecksetzen();
          }
        },
      }, "Passwort zurücksetzen")),

    h("p.klein.stand", `Datenstand: ${new Date(app.stueck.stand).toLocaleDateString("de-CH")}`),
  ));
}
