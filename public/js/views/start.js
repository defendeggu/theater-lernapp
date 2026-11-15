import { h, leeren, kontrastFarbe } from "../dom.js";
import { kartenFuer } from "../cards.js";
import { szenenDerRolle } from "../roles.js";
import { lsGet } from "../store.js";
import { VERSION } from "../version.js";
import { fortschrittFuer, rolleLaden } from "../store.js";
import { faelligeKarten, schwacheKarten, statistik, anteilSitzt, phase, serie, tagKey } from "../leitner.js";

const datum = (key) => new Date(key + "T12:00").toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" });

export function countdownText(ph) {
  if (ph.tageBisTextfest > 0) return `Noch ${ph.tageBisTextfest} Tage bis zum Textfest (${datum(ph.textfest)})`;
  if (ph.tageBisPremiere > 0) return `Noch ${ph.tageBisPremiere} Tage bis zur Premiere (${datum(ph.premiere)})`;
  return "Die Vorstellungen laufen – toi toi toi!";
}

export async function zeigeStart(root, app) {
  const f = app.rolleFigur();
  const karten = kartenFuer(app.stueck, f.id);
  const heute = tagKey();
  const ph = phase(heute, app.termine());
  let fortschritt = new Map();
  let meta = { tage: {} };
  try { [fortschritt, meta] = await Promise.all([fortschrittFuer(f.id), rolleLaden(f.id)]); } catch { /* ohne Speicher */ }

  const nFaellig = faelligeKarten(karten, fortschritt, heute, { neuProTag: lsGet("neuProTag", 20) }).length;
  const nSchwach = schwacheKarten(karten, fortschritt, heute).length;
  const stat = statistik(karten, fortschritt, heute);
  const tageSerie = serie(meta.tage, heute);
  const heuteGelernt = meta.tage?.[heute] ?? 0;

  const pos = lsGet(`pos.${f.id}`);
  const posIndex = pos ? karten.findIndex((k) => k.id === pos) : -1;
  const szenen = szenenDerRolle(app.stueck, f.id);

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

    h("section.phase", { "aria-label": "Lernphase" },
      h("p.phase-name", h("b", `Phase: ${ph.name}`), tageSerie > 0 && h("span.serie", `🔥 ${tageSerie} ${tageSerie === 1 ? "Tag" : "Tage"} in Folge`)),
      h("p.countdown", countdownText(ph)),
      h("p.klein", ph.tipp)),

    h("div.akt-ringe", [...stat.proAkt].map(([akt, s]) => {
      const p = Math.round(anteilSitzt(s) * 100);
      return h("a.akt-ring", { href: "#/statistik", style: { "--akt": s.farbe, "--p": p }, "aria-label": `Akt ${akt}: ${p} Prozent sitzen` },
        h("span.ring", h("b", `${p}%`)), h("span", `Akt ${akt}`));
    })),

    h("a.knopf.primaer.gross", { href: "#/lernen?modus=faellig" },
      h("span", nFaellig ? `Heute lernen (${nFaellig})` : "Heute ist nichts fällig"),
      h("small", heuteGelernt ? `Heute schon ${heuteGelernt} Karten bewertet` : "Fällige und neue Karten aus der Lernkartei")),

    h("div.kacheln",
      h("a.kachel", { href: posIndex > 0 ? `#/lernen?karte=${encodeURIComponent(pos)}` : "#/lernen" },
        h("b", "Chronologisch"), h("span", posIndex > 0 ? `Weiter bei Szene ${karten[posIndex].szene}` : `${karten.length} Karten`)),
      h("a.kachel", { href: "#/zufall" }, h("b", "Zufall"), h("span", "Stück, Akt oder Szene")),
      h("a.kachel", { href: "#/lernen?modus=schwach", "aria-disabled": nSchwach ? null : "true" },
        h("b", "Schwache Karten"), h("span", nSchwach ? `${nSchwach} in Fach 1–2` : "keine")),
      h("a.kachel", { href: "#/hoerprobe" }, h("b", "Hörprobe"), h("span", "Szenen anhören, mitsprechen")),
      h("a.kachel", { href: "#/statistik" }, h("b", "Statistik"),
        h("span", `${stat.gesamt.gesamt - stat.gesamt.neu} von ${stat.gesamt.gesamt} gelernt`))),

    h("h2", "Chronologisch ab Szene"),
    h("p.unter", "Nur Szenen, in denen du sprichst."),
    [...proAkt].map(([akt, a]) => h("section.akt-block",
      h("h3.akt-titel", { style: { "--akt": a.farbe, "--akt-text": kontrastFarbe(a.farbe) } }, `Akt ${akt}`),
      h("div.szenen", a.szenen.map((s) => h("a.szene-chip", {
        href: `#/lernen?ab=${s.id}`, style: { "--akt": a.farbe }, "aria-label": `Szene ${s.id}, ${s.ort}`,
      }, h("b", s.id), h("span", s.ort)))))),
    h("footer.fusszeile",
      h("a", { href: "#/einstellungen" }, `Version ${VERSION}`),
      ` · Textstand ${new Date(app.stueck.stand).toLocaleDateString("de-CH")}`),
  ));
}
