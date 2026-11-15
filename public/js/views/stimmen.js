// Einstellungen → Stimmen: Zuteilung pro Figur, Probe, Stimme/Tonhöhe von Hand, Tempo, Vorlese-Optionen.
import { h, leeren } from "../dom.js";
import { lsGet, lsSet, lsDel } from "../store.js";
import { stimmenFuerStueck, sprich, entsperren, verfuegbar, stop } from "../speech.js";
import { rollenListe } from "../roles.js";

const ANLEITUNG = "iPhone: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch → "
  + "eine Frauen- und eine Männerstimme laden (am besten «Erweitert»). Danach die App neu öffnen.";

function auswahl(name, titel, optionen, wert, onchange) {
  return h("fieldset.auswahl", h("legend", titel),
    h("div.segmente", optionen.map(([v, t]) => h("label",
      h("input", { type: "radio", name, value: v, checked: v === wert, onchange: () => onchange(v) }),
      h("span", t)))));
}

export async function zeigeStimmen(root, app) {
  leeren(root).append(h("div.laden", { role: "status" }, h("div.spinner"), h("p", "Stimmen werden geladen …")));
  const neuZeichnen = () => zeigeStimmen(root, app);
  const kopf = h("header.kopfzeile", h("a.zurueck", { href: "#/einstellungen", "aria-label": "Zurück" }, "‹"), h("h1", "Stimmen"));

  if (!verfuegbar()) {
    leeren(root).append(h("section.seite", kopf,
      h("p.hinweis-box", "Dieser Browser kann keine Sprachausgabe. Öffne die App auf dem iPhone in Safari.")));
    return;
  }

  const { zuteilung, stimmen, fehlt, keineDeutsche } = await stimmenFuerStueck(app.stueck);
  const manuell = lsGet("stimmen.manuell", {});
  const overrides = lsGet("stimmen.geschlecht", {});
  const figs = rollenListe(app.stueck).flatMap((g) => g.rollen);
  const fig = new Map(app.stueck.figuren.map((f) => [f.id, f]));
  const unbekannt = stimmen.filter((s) => !overrides[s.id] && !s.geschlecht);
  const markiert = stimmen.filter((s) => overrides[s.id]);
  const tempo = lsGet("tempo", 1);
  const g = (x) => (x === "w" ? "Frau" : x === "m" ? "Mann" : "?");

  const hinweise = [];
  if (keineDeutsche) hinweise.push("Auf diesem Gerät ist keine deutsche Stimme installiert. " + ANLEITUNG);
  for (const x of fehlt) {
    hinweise.push(`Es fehlt eine ${x === "w" ? "Frauenstimme" : "Männerstimme"}. Die ${x === "w" ? "Frauen" : "Männer"} sprechen deshalb mit einer verstellten Stimme. ${ANLEITUNG}`);
  }

  const setManuell = (id, aenderung) => {
    const m = { ...manuell, [id]: { ...(manuell[id] ?? {}), ...aenderung } };
    for (const k of Object.keys(m[id])) if (m[id][k] === null) delete m[id][k];
    if (!Object.keys(m[id]).length) delete m[id];
    lsSet("stimmen.manuell", m);
  };

  const probe = (f) => {
    entsperren();
    stimmenFuerStueck(app.stueck).then((a) => sprich(`Grüezi, ich bin ${f.kurz}.`, a.zuteilung.get(f.id)));
  };

  leeren(root).append(h("section.seite.stimmen",
    kopf,
    hinweise.map((t) => h("p.hinweis-box", t)),

    h("section.block",
      h("h2", "Vorlesen beim Lernen"),
      auswahl("autoVorlesen", "Stichwort automatisch vorlesen", [["false", "Aus"], ["true", "Ein"]],
        String(lsGet("autoVorlesen", false)), (v) => lsSet("autoVorlesen", v === "true")),
      auswahl("vorlesen", "Was wird vorgelesen?", [["satz", "Letzter Satz"], ["ganz", "Ganze Replik davor"]],
        lsGet("vorlesen", "satz"), (v) => lsSet("vorlesen", v)),
      auswahl("pauseModus", "Nach dem Vorlesen", [["auto", "Pause, dann umdrehen"], ["tippen", "Warten, bis ich tippe"]],
        lsGet("pauseModus", "auto"), (v) => lsSet("pauseModus", v)),
      auswahl("pauseFaktor", "Länge der Pause zum Sprechen", [["0.7", "Kurz"], ["1", "Normal"], ["1.5", "Lang"], ["2", "Sehr lang"]],
        String(lsGet("pauseFaktor", 1)), (v) => lsSet("pauseFaktor", Number(v))),
      h("label.regler", h("span", "Sprechtempo für alle: ", h("b.tempo-wert", `${Math.round(tempo * 100)} %`)),
        h("input", {
          type: "range", min: "0.6", max: "1.4", step: "0.05", value: String(tempo),
          oninput(ev) { lsSet("tempo", Number(ev.target.value)); root.querySelector(".tempo-wert").textContent = `${Math.round(ev.target.value * 100)} %`; },
          onchange() { entsperren(); probe(fig.get(app.rolle)); },
        }))),

    h("section.block",
      h("h2", "Stimme pro Figur"),
      h("p.klein", `${stimmen.length} deutsche ${stimmen.length === 1 ? "Stimme" : "Stimmen"} gefunden. Tippe ▶︎ zum Anhören.`),
      h("ul.figur-stimmen", figs.map((r) => {
        const f = fig.get(r.id);
        const z = zuteilung.get(r.id);
        const m = manuell[r.id] ?? {};
        return h("li",
          h("div.figur-kopf",
            h("div", h("b", f.name), h("span.klein", ` · ${g(f.geschlecht)}, ${f.alter}`)),
            h("button.knopf.rund.klein-rund", { "aria-label": `Probe ${f.kurz}`, onclick: () => probe(f) }, "▶︎")),
          h("p.klein", z.stimmenName ? `${z.stimmenName}${z.ersatz ? " (verstellt)" : ""} · Tonhöhe ${z.pitch}` : `Systemstimme · Tonhöhe ${z.pitch}`),
          h("div.figur-wahl",
            h("select", {
              "aria-label": `Stimme für ${f.kurz}`,
              onchange(ev) { setManuell(r.id, { stimme: ev.target.value || null }); neuZeichnen(); },
            },
            h("option", { value: "", selected: !m.stimme }, "Automatisch"),
            stimmen.map((s) => h("option", { value: s.id, selected: m.stimme === s.id }, `${s.name} (${g(s.geschlecht)}, ${s.lang})`))),
            h("input", {
              type: "range", min: "0.5", max: "2", step: "0.05", value: String(z.pitch), "aria-label": `Tonhöhe ${f.kurz}`,
              onchange(ev) { setManuell(r.id, { pitch: Number(ev.target.value) }); neuZeichnen(); },
            }),
            (m.stimme || m.pitch !== undefined) && h("button.link", {
              onclick() { setManuell(r.id, { stimme: null, pitch: null }); neuZeichnen(); },
            }, "zurücksetzen")));
      }))),

    (unbekannt.length || markiert.length) ? h("section.block",
      h("h2", "Stimmen zuordnen"),
      h("p.klein", "Bei diesen Stimmen weiss die App nicht, ob es eine Frauen- oder Männerstimme ist."),
      h("ul.unbekannte", [...unbekannt, ...markiert].map((s) => h("li",
        h("span", s.name, h("span.klein", ` ${s.lang}`)),
        h("div.segmente.klein-segmente", [["", "?"], ["w", "Frau"], ["m", "Mann"]].map(([v, t]) => h("label",
          h("input", {
            type: "radio", name: "g-" + s.id, value: v, checked: (overrides[s.id] ?? "") === v,
            onchange() {
              const o = { ...overrides };
              if (v) o[s.id] = v; else delete o[s.id];
              lsSet("stimmen.geschlecht", o);
              neuZeichnen();
            },
          }), h("span", t)))))))) : null,

    h("section.block",
      h("button.knopf.warnung", {
        onclick() {
          if (!confirm("Alle Stimmen-Einstellungen zurücksetzen?")) return;
          ["stimmen.manuell", "stimmen.geschlecht", "tempo", "autoVorlesen", "vorlesen", "pauseModus", "pauseFaktor"].forEach(lsDel);
          stop();
          neuZeichnen();
        },
      }, "Alles zurücksetzen"),
      h("p.klein", "Gesperrter Bildschirm: iOS hält die Sprachausgabe an, wenn das iPhone gesperrt wird. Während der Hörprobe hält die App den Bildschirm wach."),
      h("p.klein", ANLEITUNG)),
  ));
}
