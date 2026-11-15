// «Mein Weg durchs Stück»: nur die eigenen Szenen mit Auftritt, erstem Stichwort und Abgang.
import { h, leeren } from "../dom.js";
import { meinWeg } from "../quiz.js";

export function zeigeWeg(root, app) {
  const f = app.rolleFigur();
  const weg = meinWeg(app.stueck, app.rolle);
  const gesamt = weg.reduce((n, s) => n + s.einsaetze, 0);

  leeren(root).append(h("section.seite.weg",
    h("header.kopfzeile", h("a.zurueck", { href: "#/ablauf", "aria-label": "Zurück" }, "‹"), h("h1", "Mein Weg")),
    h("p.unter", `${f.name}: ${weg.length} Szenen, ${gesamt} Einsätze.`),
    h("ol.weg-liste", weg.map((s, i) => h("li.weg-szene", { style: { "--akt": s.farbe } },
      h("div.weg-nr", String(i + 1)),
      h("div.weg-inhalt",
        h("div.ablauf-kopf", h("b", `Akt ${s.akt} · Szene ${s.szene}`), h("span.ort", s.ort)),
        s.kurzfassung && h("p.klein", s.kurzfassung),
        h("dl.weg-daten",
          h("dt", "Auftritt"),
          h("dd", s.beginnt ? "Du beginnst die Szene." : (s.schonDa.length ? `Schon da: ${s.schonDa.join(", ")}` : "—")),
          s.erstesStichwort && h("dt", "Erstes Stichwort"),
          s.erstesStichwort && h("dd", h("b", s.erstesStichwort.sprecher === "du" ? "Du: " : `${s.erstesStichwort.sprecher}: `), s.erstesStichwort.text),
          h("dt", "Einsätze"), h("dd", String(s.einsaetze)),
          h("dt", "Dein letzter Satz"), h("dd", s.letzterSatz),
          s.abgang && h("dt", "Abgang"), s.abgang && h("dd.regie", `(${s.abgang})`)),
        h("a.link-klein", { href: `#/lernen?ab=${s.szene}` }, "Szene lernen ›"),
        " ",
        h("a.link-klein", { href: `#/hoerprobe?szene=${s.szene}` }, "Hörprobe ›"))))),
  ));
}
