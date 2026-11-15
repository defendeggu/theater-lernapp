// Service Worker registrieren und bei einer neuen Version einen Hinweis zeigen.
import { h } from "./dom.js";

let neuLaden = false;

function hinweis(reg) {
  if (document.querySelector(".update-hinweis")) return;
  const el = h("div.update-hinweis", { role: "status" },
    h("span", "Eine neue Version der App ist bereit."),
    h("button.knopf.primaer", {
      onclick() {
        neuLaden = true;
        reg.waiting?.postMessage({ typ: "SKIP_WAITING" });
        el.remove();
      },
    }, "Aktualisieren"));
  document.body.append(el);
}

export function swRegistrieren() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (neuLaden) location.reload(); });
  navigator.serviceWorker.register("sw.js").then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) hinweis(reg);
    reg.addEventListener("updatefound", () => {
      const neu = reg.installing;
      neu?.addEventListener("statechange", () => {
        if (neu.state === "installed" && navigator.serviceWorker.controller) hinweis(reg);
      });
    });
    // beim Zurückkehren in die App nach Updates schauen
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => { /* ohne Offline-Modus weiter */ });
}
