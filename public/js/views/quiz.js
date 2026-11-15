// Ablauf-Quiz: gemischte Fragen oder Szenen-Reihenfolge pro Akt. Ergebnisse pro Rolle gespeichert.
import { h, leeren, kontrastFarbe } from "../dom.js";
import { erzeugeQuiz, frageReihenfolge, pruefen, richtigePositionen } from "../quiz.js";
import { rolleLaden, rolleAktualisieren } from "../store.js";
import { pruefeBadges } from "./badges.js";

async function auswahl(root, app) {
  let meta = { quiz: [] };
  try { meta = await rolleLaden(app.rolle); } catch { /* leer */ }
  const letzte = (meta.quiz ?? []).slice(-5).reverse();
  const akte = app.stueck.akte;
  leeren(root).append(h("section.seite.quiz",
    h("header.kopfzeile", h("a.zurueck", { href: "#/ablauf", "aria-label": "Zurück" }, "‹"), h("h1", "Ablauf-Quiz")),
    h("p.unter", "Kennst du den Ablauf des Stücks? Wo spielt was, wer ist dabei, was kommt danach?"),
    h("a.knopf.primaer.gross", { href: "#/quiz?art=mix" }, h("span", "Gemischtes Quiz"), h("small", "10 Fragen")),
    h("h2", "Szenen in die richtige Reihenfolge"),
    h("div.knopfreihe", akte.map((a) => h("a.knopf.akt-knopf", {
      href: `#/quiz?art=reihenfolge&akt=${a.nr}`,
      style: { "--akt": a.farbe, "--akt-text": kontrastFarbe(a.farbe) },
    }, h("span", `Akt ${a.nr}`), h("small", `${a.szenen.length} Szenen`)))),
    letzte.length > 0 && h("section.block",
      h("h2", "Deine letzten Resultate"),
      h("ul.resultate", letzte.map((q) => h("li",
        h("span", q.art === "reihenfolge" ? `Reihenfolge Akt ${q.akt}` : "Gemischtes Quiz"),
        h("b", `${q.richtig} / ${q.gesamt}`),
        h("span.klein", new Date(q.zeit).toLocaleDateString("de-CH")))))),
  ));
}

export async function zeigeQuiz(root, app, params) {
  const art = params.get("art");
  if (!art) return auswahl(root, app);
  const akt = Number(params.get("akt"));
  const fragen = art === "reihenfolge"
    ? [frageReihenfolge(app.stueck, akt)].filter(Boolean)
    : erzeugeQuiz(app.stueck, app.rolle, { anzahl: 10 });
  if (!fragen.length) return auswahl(root, app);

  let i = 0;
  let punkte = 0;
  const falsch = [];
  const seite = h("section.seite.quiz");
  leeren(root).append(seite);

  function zeichne() {
    const f = fragen[i];
    let gewaehlt = [];
    let beantwortet = false;
    const feedback = h("div.feedback", { role: "status", "aria-live": "polite" });
    const optionenEl = h("div", { class: f.typ === "reihenfolge" ? "reihen-optionen" : "optionen" });
    const reihe = h("ol.reihe-gewaehlt");
    const pruefKnopf = h("button.knopf.primaer.gross", { onclick: auswerten, disabled: true }, "Prüfen");
    const weiterKnopf = h("button.knopf.primaer.gross", { hidden: true, onclick: weiter },
      i + 1 < fragen.length ? "Nächste Frage ›" : "Resultat ›");

    function setze() {
      pruefKnopf.disabled = f.typ === "reihenfolge" ? gewaehlt.length !== f.optionen.length : !gewaehlt.length;
      optionenEl.querySelectorAll("button").forEach((b) => {
        const an = gewaehlt.includes(b.dataset.id);
        b.classList.toggle("gewaehlt", an);
        b.setAttribute("aria-pressed", an ? "true" : "false");
        if (f.typ === "reihenfolge") {
          b.disabled = an || beantwortet;
          const nr = gewaehlt.indexOf(b.dataset.id);
          b.querySelector(".nr").textContent = nr >= 0 ? String(nr + 1) : "";
        }
      });
      if (f.typ === "reihenfolge") {
        leeren(reihe).append(...gewaehlt.map((id) => h("li", f.optionen.find((o) => o.id === id).text)));
      }
    }

    for (const o of f.optionen) {
      optionenEl.append(h("button.option", {
        "data-id": o.id, "aria-pressed": "false",
        onclick() {
          if (beantwortet) return;
          if (f.typ === "reihenfolge") gewaehlt.push(o.id);
          else if (f.mehrfach) gewaehlt = gewaehlt.includes(o.id) ? gewaehlt.filter((x) => x !== o.id) : [...gewaehlt, o.id];
          else gewaehlt = [o.id];
          setze();
          if (!f.mehrfach && f.typ !== "reihenfolge") auswerten();
        },
      }, f.typ === "reihenfolge" && h("span.nr"), h("span", o.text)));
    }

    function auswerten() {
      if (beantwortet) return;
      beantwortet = true;
      const ok = pruefen(f, gewaehlt);
      if (ok) punkte++; else falsch.push(f);
      optionenEl.querySelectorAll("button").forEach((b) => {
        b.disabled = true;
        if (f.typ !== "reihenfolge") {
          if (f.richtig.includes(b.dataset.id)) b.classList.add("richtig");
          else if (gewaehlt.includes(b.dataset.id)) b.classList.add("falsch");
        }
      });
      const teil = f.typ === "reihenfolge" && !ok ? ` (${richtigePositionen(f, gewaehlt)} von ${f.richtig.length} am richtigen Platz)` : "";
      feedback.className = "feedback " + (ok ? "ok" : "nein");
      leeren(feedback).append(
        h("b", ok ? "Richtig!" : "Leider nicht." + teil),
        h("p", f.typ === "reihenfolge" ? "Richtige Reihenfolge:" : f.aufloesung),
        f.typ === "reihenfolge" && h("ol.aufloesung", f.aufloesung.split("\n").map((z) => h("li", z))));
      pruefKnopf.hidden = true;
      weiterKnopf.hidden = false;
      weiterKnopf.focus();
    }

    leeren(seite).append(
      h("header.kartenkopf",
        h("a.zurueck", { href: "#/quiz", "aria-label": "Quiz beenden" }, "‹"),
        h("div.titel", h("b", art === "reihenfolge" ? `Reihenfolge Akt ${akt}` : "Ablauf-Quiz"),
          h("span", fragen.length > 1 ? `Frage ${i + 1} von ${fragen.length}` : "Tippe die Szenen der Reihe nach an")),
        h("span.zaehler", `${punkte} ✓`)),
      h("h2.frage", f.frage),
      f.kontext && h("p.kontext", f.kontext),
      f.typ === "reihenfolge" && reihe,
      optionenEl,
      f.typ === "reihenfolge" && h("button.link", { onclick() { if (!beantwortet) { gewaehlt = []; setze(); } } }, "Neu anfangen"),
      feedback,
      h("div.quiz-aktionen", (f.mehrfach || f.typ === "reihenfolge") && pruefKnopf, weiterKnopf));
    setze();
  }

  function weiter() {
    i++;
    if (i < fragen.length) return zeichne();
    ende();
  }

  async function ende() {
    const gesamt = fragen.length;
    try {
      await rolleAktualisieren(app.rolle, (r) => {
        r.quiz = [...(r.quiz ?? []), { zeit: Date.now(), art, akt: akt || null, richtig: punkte, gesamt }].slice(-100);
      });
    } catch { /* egal */ }
    const prozent = Math.round((punkte / gesamt) * 100);
    leeren(seite).append(h("div.seite.mitte.fertig",
      h("div.funken", { "aria-hidden": "true" }, prozent === 100 ? "✦ ✦ ✦" : "✦"),
      h("h1", prozent === 100 ? "Perfekt!" : `${punkte} von ${gesamt} richtig`),
      h("p", prozent === 100 ? "Du kennst den Ablauf." : "Schau dir den Ablauf nochmals an und versuch es wieder."),
      falsch.length > 0 && art !== "reihenfolge" && h("ul.falsch-liste", falsch.map((f) => h("li", h("b", f.frage), h("br"), f.aufloesung))),
      h("a.knopf.primaer.gross", { href: `#/quiz?art=${art}${akt ? "&akt=" + akt : ""}&n=${Date.now()}` }, "Nochmals"),
      h("a.knopf", { href: "#/ablauf" }, "Zum Ablauf")));
    pruefeBadges(app);
  }

  zeichne();
}
