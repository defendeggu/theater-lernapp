// Erfundenes Demo-Stück im Format von stueck.enc (Ausgabe von tools/encrypt.mjs buildPayload).
// Alle Figuren und Sätze sind frei erfunden – NICHT aus dem Textbuch.

const lang = [
  "Es isch einisch es Dorf gsi, wo d Lüüt am Morge früeh ufgstande sind und am Obig müed is Bett. Jede hed jede kennt.",
  "D Müli am Bach hed klapperet, de Bäcker hed Brot bache und d Chind sind dur d Gasse gsprunge, bis es dunkel worde isch.",
  "Und denn, eines Tages, isch es Wäge-Rad bim Brunne verbii grollt – und nüt isch meh gsi wie vorher, gar nüt meh.",
].join("\n\n");

const r = (id, sprecher, text, extra = {}) => ({
  id, sprecher, sammel: null, text, regie: [], hash: id.replace(/\W/g, "").slice(-8), ...extra,
});

export const demo = {
  format: 1,
  stand: "2026-11-15T00:00:00.000Z",
  titel: "Demo-Stück",
  figuren: [
    { id: "erzaehler", name: "Erzähler", kurz: "Erzähler", geschlecht: "m", alter: "erwachsen", beschreibung: "", gruppe: "erzaehler", einsaetze_ca: 1 },
    { id: "ruedi", name: "Ruedi Bachmann", kurz: "Ruedi", geschlecht: "m", alter: "erwachsen", beschreibung: "Müller", gruppe: "dorf", einsaetze_ca: 6 },
    { id: "vreni", name: "Vreni Bachmann", kurz: "Vreni", geschlecht: "w", alter: "erwachsen", beschreibung: "Seine Schwester", gruppe: "dorf", einsaetze_ca: 3 },
    { id: "mona", name: "Mona", kurz: "Mona", geschlecht: "w", alter: "erwachsen", beschreibung: "Weberin", gruppe: "fahrende", einsaetze_ca: 4 },
    { id: "sepp", name: "Sepp", kurz: "Sepp", geschlecht: "m", alter: "jugendlich", beschreibung: "Sohn von Vreni", gruppe: "jugendliche", einsaetze_ca: 2 },
  ],
  akte: [
    { nr: 1, farbe: "#E8B10E", szenen: [
      { id: "1.1", ort: "Lager", ort_typ: "lager", personen: ["erzaehler", "mona", "ruedi"],
        kurzfassung: "Der Erzähler stellt das Dorf vor. Mona und Ruedi begegnen sich.",
        regie: [{ nach: null, text: "Morgenstimmung." }],
        repliken: [
          r("1.1-001", ["erzaehler"], lang, { regie: [{ pos: 0, text: "*1" }] }),
          r("1.1-002", ["mona"], "Guete Morge. Wer bisch du?"),
          r("1.1-003", ["ruedi"], "Ech be de Müller. Und du chunsch vo wiit her, gäll?", { regie: [{ pos: 0, text: "lacht" }] }),
          r("1.1-004", ["mona"], "Vo sehr wiit. Mer bliibed nume zwei Wuche."),
          r("1.1-005", ["mona"], "Und denn ziemer wiiter.", { regie: [] }),
          r("1.1-006", ["ruedi", "mona"], "Denn wämmer d Ziit guet nutze!", { sammel: "Ruedi/Mona" }),
        ] },
    ] },
    { nr: 2, farbe: "#E9731C", szenen: [
      { id: "2.1", ort: "Dorfplatz", ort_typ: "dorf", personen: ["vreni", "sepp", "ruedi"],
        kurzfassung: "Vreni schimpft mit Sepp. Ruedi vermittelt.",
        regie: [],
        repliken: [
          r("2.1-001", ["vreni"], "Sepp! Wo bisch so lang gsi?"),
          r("2.1-002", ["sepp"], "Bim Lager. Die sind nätt!"),
          r("2.1-003", ["vreni"], ""), // nur Regie
          r("2.1-004", ["ruedi"], "Lass ne doch, Vreni. Er hed recht."),
          r("2.1-005", ["vreni", "sepp", "ruedi"], "Also guet!", { sammel: "Alle" }),
        ] },
    ] },
    { nr: 3, farbe: "#C62828", szenen: [
      { id: "3.1", ort: "Dorfplatz", ort_typ: "dorf", personen: ["ruedi", "vreni"],
        kurzfassung: "Ruedi und Vreni versöhnen sich.",
        regie: [{ nach: "3.1-002", text: "DUNKEL" }],
        repliken: [
          r("3.1-001", ["ruedi"], "Es tuet mer leid, Vreni."),
          r("3.1-002", ["vreni"], "Mir au. Chumm, mer gönd hei."),
        ] },
    ] },
  ],
};
