import { h, leeren } from "../dom.js";
import { WrongKeyError } from "../crypto.js";

export function zeigePasswort(root, { hinweis, pruefen }) {
  const feld = h("input", {
    type: "password", id: "pw", name: "password", autocomplete: "current-password",
    autocapitalize: "off", spellcheck: "false", required: true, placeholder: "Ensemble-Passwort",
  });
  const meldung = h("p.meldung", { role: "alert", "aria-live": "polite" }, hinweis ?? "");
  const knopf = h("button.knopf.primaer.gross", { type: "submit" }, "Öffnen");

  const form = h("form.passwort", {
    async onsubmit(ev) {
      ev.preventDefault();
      if (!feld.value) return;
      knopf.disabled = true;
      knopf.textContent = "Wird geöffnet …";
      meldung.textContent = "";
      try {
        await pruefen(feld.value);
      } catch (e) {
        meldung.textContent = e instanceof WrongKeyError
          ? "Das Passwort stimmt nicht. Frag die Regie nach dem Ensemble-Passwort."
          : "Fehler: " + e.message;
        knopf.disabled = false;
        knopf.textContent = "Öffnen";
        feld.select();
      }
    },
  }, h("label", { for: "pw" }, "Passwort"), feld, meldung, knopf);

  leeren(root).append(h("section.seite.mitte.willkommen",
    h("div.logo", { "aria-hidden": "true" }, h("span.f1"), h("span.f2"), h("span.f3")),
    h("h1", "S'Füür vom Schmied"),
    h("p.unter", "Text lernen für die Eibeler Volksbühne"),
    form,
    h("p.klein", "Das Passwort bekommst du von der Regie. Die App merkt es sich auf diesem Gerät."),
  ));
  feld.focus();
}
