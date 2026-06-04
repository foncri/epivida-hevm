import { el, link } from "./dom.js";

export function modulePage(title, description, content = [], actions = []) {
  return el("div", { class: "stack" }, [
    el("header", { class: "module-head" }, [
      el("div", {}, [el("h1", {}, [title]), description ? el("p", {}, [description]) : ""]),
      actions.length ? el("div", { class: "toolbar" }, actions) : ""
    ]),
    ...content
  ]);
}

export function moduleError(title, error) {
  return modulePage(title, "No se pudo cargar este modulo.", [
    el("section", { class: "empty-state" }, [
      el("h1", {}, ["Error de modulo"]),
      el("p", {}, [error?.message || String(error || "Error desconocido")]),
      link("#/inicio", "Volver a inicio", { class: "button ghost" })
    ])
  ]);
}

export function emptyModule(title, message) {
  return modulePage(title, message, [
    el("section", { class: "empty-state" }, [
      el("h1", {}, [title]),
      el("p", {}, [message])
    ])
  ]);
}

export function stats(items = []) {
  return el("section", { class: "stat-grid" }, items.map(([value, label, tone]) =>
    el("article", { class: `stat ${tone || ""}` }, [el("strong", {}, [value]), el("span", {}, [label])])
  ));
}
