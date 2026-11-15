// Kleine DOM-Hilfe: h("div.klasse", {attr}, ...kinder). Text wird immer als Text gesetzt (kein innerHTML).

export function h(tag, attrs, ...kinder) {
  const [name, ...klassen] = tag.split(".");
  const el = document.createElement(name || "div");
  if (klassen.length) el.className = klassen.join(" ");
  if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) {
    kinder.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") {
      for (const [p, w] of Object.entries(v)) {
        if (p.startsWith("--")) el.style.setProperty(p, w); // CSS-Variablen gehen nur so
        else el.style[p] = w;
      }
    }
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kinder.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Leert ein Element. Gibt { append } zurück, das null/undefined/false überspringt
 *  (das native append würde sie als Text "false"/"undefined" einfügen). */
export function leeren(el) {
  while (el.firstChild) el.firstChild.remove();
  return {
    el,
    append(...kinder) {
      for (const c of kinder.flat(Infinity)) {
        if (c === null || c === undefined || c === false) continue;
        el.append(c instanceof Node ? c : document.createTextNode(String(c)));
      }
      return el;
    },
  };
}

/** Textfarbe für eine Hintergrundfarbe (dunkel auf Gelb/Orange, hell auf Rot). */
export function kontrastFarbe(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.2 ? "#1f1300" : "#ffffff";
}
