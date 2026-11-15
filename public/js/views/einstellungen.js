import { h, leeren } from "../dom.js";
import { lsGet, lsSet, lsDel, exportieren, importieren, rolleZuruecksetzen, allesZuruecksetzen } from "../store.js";
import { STANDARD_TERMINE, phase, tagKey } from "../leitner.js";
import { rollenListe } from "../roles.js";
import { VERSION } from "../version.js";

function auswahl(name, titel, optionen, wert, onchange) {
  return h("fieldset.auswahl", h("legend", titel),
    h("div.segmente", optionen.map(([v, t]) => h("label",
      h("input", { type: "radio", name, value: v, checked: v === wert, onchange: () => onchange(v) }),
      h("span", t)))));
}

async function teilen(json, dateiname) {
  const text = JSON.stringify(json, null, 1);
  const datei = new File([text], dateiname, { type: "application/json" });
  if (navigator.canShare?.({ files: [datei] })) {
    try { await navigator.share({ files: [datei], title: "Lernstand sichern" }); return "geteilt"; }
    catch (e) { if (e.name === "AbortError") return "abgebrochen"; }
  }
  const a = h("a", { href: URL.createObjectURL(datei), download: dateiname });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return "heruntergeladen";
}

export function zeigeEinstellungen(root, app) {
  const f = app.rolleFigur();
  const termine = app.termine();
  const meldung = h("p.meldung.ok", { role: "status", "aria-live": "polite" });
  const zeige = (t, fehler = false) => { meldung.textContent = t; meldung.classList.toggle("fehler", fehler); };

  const datumFeld = (key, titel) => h("label.datum", h("span", titel),
    h("input", {
      type: "date", value: termine[key],
      onchange(ev) {
        if (!ev.target.value) return;
        lsSet(key, ev.target.value);
        zeige(`${titel} gespeichert. Phase jetzt: ${phase(tagKey(), app.termine()).name}.`);
      },
    }));

  const dateiWahl = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  let importNurRolle = null;
  dateiWahl.addEventListener("change", async () => {
    const datei = dateiWahl.files[0];
    dateiWahl.value = "";
    if (!datei) return;
    try {
      const r = await importieren(JSON.parse(await datei.text()), importNurRolle);
      zeige(`Importiert: ${r.rollen} ${r.rollen === 1 ? "Rolle" : "Rollen"}, ${r.karten} Karten aktualisiert.`);
    } catch (e) {
      zeige("Import fehlgeschlagen: " + e.message, true);
    }
  });
  const exportKnopf = (nur) => async () => {
    try {
      const json = await exportieren(nur);
      const n = Object.keys(json.rollen).length;
      if (!n) return zeige("Noch kein Lernstand vorhanden.", true);
      const name = `lernstand-${nur ?? "alle-rollen"}-${tagKey()}.json`;
      const r = await teilen(json, name);
      if (r !== "abgebrochen") zeige(`Lernstand ${r === "geteilt" ? "geteilt" : "gespeichert"} (${name}).`);
    } catch (e) { zeige("Export fehlgeschlagen: " + e.message, true); }
  };
  const rollenNamen = new Map(rollenListe(app.stueck).flatMap((g) => g.rollen.map((r) => [r.id, r.name])));

  leeren(root).append(h("section.seite.einstellungen",
    h("header.kopfzeile", h("a.zurueck", { href: "#/", "aria-label": "Zurück" }, "‹"), h("h1", "Einstellungen")),
    meldung,

    h("section.block",
      h("h2", "Rolle"),
      h("p", "Du spielst: ", h("b", f.name)),
      h("a.knopf", { href: "#/rolle" }, "Rolle wechseln"),
      h("p.klein", "Der Fortschritt wird pro Rolle gespeichert. Ein Wechsel löscht nichts.")),

    h("section.block",
      h("h2", "Termine"),
      h("p.klein", "Die Lernphasen richten sich nach dem Textfest: ab dann ohne Textbuch an die Probe."),
      datumFeld("textfest", "Textfest (Text auswendig)"),
      datumFeld("premiere", "Premiere"),
      h("button.link", {
        onclick() {
          lsSet("textfest", STANDARD_TERMINE.textfest); lsSet("premiere", STANDARD_TERMINE.premiere);
          zeigeEinstellungen(root, app);
        },
      }, "Standard wiederherstellen (1.12.2027 / 30.4.2028)")),

    h("section.block",
      h("h2", "Lernen"),
      auswahl("neuProTag", "Neue Karten pro Tag (bei «Heute lernen»)",
        [["5", "5"], ["10", "10"], ["20", "20"], ["40", "40"], ["999", "alle"]],
        String(lsGet("neuProTag", 20)), (v) => lsSet("neuProTag", Number(v)))),

    h("section.block",
      h("h2", "Stimmen und Vorlesen"),
      h("p.klein", "Welche Figur mit welcher Stimme spricht, Sprechtempo, automatisches Vorlesen."),
      h("a.knopf", { href: "#/stimmen" }, "Stimmen einstellen")),

    h("section.block",
      h("h2", "Darstellung"),
      auswahl("schrift", "Schriftgrösse", [["klein", "Klein"], ["normal", "Normal"], ["gross", "Gross"], ["riesig", "Sehr gross"]],
        lsGet("schrift", "normal"), (v) => { lsSet("schrift", v); app.schrift(); }),
      auswahl("thema", "Farben", [["auto", "Wie iPhone"], ["light", "Hell"], ["dark", "Dunkel"]],
        lsGet("thema", "auto"), (v) => { lsSet("thema", v); app.schrift(); })),

    h("section.block",
      h("h2", "Lernstand sichern"),
      h("p.klein", "Safari kann Daten löschen, wenn die App lange nicht benutzt wird. Sichere deinen Lernstand ab und zu, z.B. in «Dateien» oder per Mail an dich. Die Datei enthält keinen Stücktext."),
      h("div.knopfreihe",
        h("button.knopf", { onclick: exportKnopf(f.id) }, `Nur ${f.kurz} sichern`),
        h("button.knopf", { onclick: exportKnopf(null) }, "Alle Rollen sichern")),
      h("div.knopfreihe",
        h("button.knopf", { onclick() { importNurRolle = f.id; dateiWahl.click(); } }, `Für ${f.kurz} laden`),
        h("button.knopf", { onclick() { importNurRolle = null; dateiWahl.click(); } }, "Alle Rollen laden")),
      h("p.klein", "Beim Laden wird zusammengeführt: pro Karte gilt der neuere Stand."),
      dateiWahl),

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

    h("section.block",
      h("h2", "Zurücksetzen"),
      h("button.knopf.warnung", {
        async onclick() {
          if (confirm(`Lernstand von ${rollenNamen.get(f.id) ?? f.name} wirklich löschen? Das lässt sich nicht rückgängig machen.`)) {
            await rolleZuruecksetzen(f.id);
            lsSet(`pos.${f.id}`, null);
            zeige(`Lernstand von ${f.kurz} gelöscht.`);
          }
        },
      }, `Lernstand von ${f.kurz} löschen`),
      h("button.knopf.warnung", {
        async onclick() {
          if (!confirm("Lernstand ALLER Rollen auf diesem Gerät löschen? Badges, Serien und Quiz-Resultate gehen verloren. Das lässt sich nicht rückgängig machen.")) return;
          await allesZuruecksetzen();
          try { Object.keys(localStorage).filter((k) => k.startsWith("tl.pos.")).forEach((k) => lsDel(k.slice(3))); } catch { /* egal */ }
          zeige("Lernstand aller Rollen gelöscht.");
        },
      }, "Alles zurücksetzen (alle Rollen)")),

    h("p.klein.stand", `Version ${VERSION} · Textstand ${new Date(app.stueck.stand).toLocaleDateString("de-CH")} · `,
      h("a", { href: "https://github.com/defendeggu/theater-lernapp/blob/main/CHANGELOG.md", target: "_blank", rel: "noopener" }, "Was ist neu?")),
  ));
}
