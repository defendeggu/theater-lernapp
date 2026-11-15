import { h, leeren, kontrastFarbe } from "../dom.js";
import { kartenFuer } from "../cards.js";
import { fortschrittFuer, rolleLaden } from "../store.js";
import { statistik, anteilSitzt, serie, tagKey } from "../leitner.js";

const anz = (n, eins, mehr) => `${n} ${n === 1 ? eins : mehr}`;

function balken(s) {
  const teile = [
    ["neu", s.neu, "neu"],
    ["f12", s.faecher[0] + s.faecher[1], "Fach 1–2"],
    ["f34", s.faecher[2] + s.faecher[3], "Fach 3–4"],
    ["f5", s.faecher[4], "Fach 5"],
  ];
  return h("div.balken", { role: "img", "aria-label": teile.map(([, n, t]) => `${n} ${t}`).join(", ") },
    teile.filter(([, n]) => n > 0).map(([k, n]) => h(`span.${k}`, { style: { flexGrow: n } })));
}

export async function zeigeStatistik(root, app) {
  const f = app.rolleFigur();
  const karten = kartenFuer(app.stueck, f.id);
  const heute = tagKey();
  let fortschritt = new Map(), meta = { tage: {} };
  try { [fortschritt, meta] = await Promise.all([fortschrittFuer(f.id), rolleLaden(f.id)]); } catch { /* leer */ }
  const st = statistik(karten, fortschritt, heute);
  const g = st.gesamt;
  const tage = Object.keys(meta.tage ?? {}).length;
  const bewertungen = Object.values(meta.tage ?? {}).reduce((a, b) => a + b, 0);

  leeren(root).append(h("section.seite.statistik",
    h("header.kopfzeile", h("a.zurueck", { href: "#/", "aria-label": "Zurück" }, "‹"), h("h1", "Statistik")),
    h("p.unter", `${f.name} · ${anz(g.gesamt, "Karte", "Karten")}`),
    h("dl.zahlen",
      h("div", h("dt", "sitzen (Fach 3–5)"), h("dd", `${Math.round(anteilSitzt(g) * 100)}%`)),
      h("div", h("dt", "heute fällig"), h("dd", String(g.faellig))),
      h("div", h("dt", "noch neu"), h("dd", String(g.neu))),
      h("div", h("dt", "Serie"), h("dd", anz(serie(meta.tage, heute), "Tag", "Tage"))),
      h("div", h("dt", "Lerntage"), h("dd", String(tage))),
      h("div", h("dt", "Bewertungen"), h("dd", String(bewertungen)))),
    h("div.legende",
      h("span.neu", "neu"), h("span.f12", "Fach 1–2"), h("span.f34", "Fach 3–4"), h("span.f5", "Fach 5")),
    h("h2", "Fächer"),
    h("div.faecher", g.faecher.map((n, i) => h("div", h("b", String(n)), h("span", `Fach ${i + 1}`)))),
    [...st.proAkt].map(([akt, s]) => h("section.akt-stat",
      h("h2", h("span.akt-titel", { style: { "--akt": s.farbe, "--akt-text": kontrastFarbe(s.farbe) } }, `Akt ${akt}`),
        h("span.prozent", `${Math.round(anteilSitzt(s) * 100)}% sitzen`)),
      balken(s),
      h("ul.szenen-stat", [...st.proSzene].filter(([, x]) => x.akt === akt).map(([sz, x]) => h("li",
        h("a", { href: `#/lernen?modus=zufall&bereich=${encodeURIComponent("szene:" + sz)}` },
          h("span.sz", h("b", sz), " ", x.ort), h("span.n", anz(x.gesamt, "Karte", "Karten"))),
        balken(x)))))),
  ));
}
