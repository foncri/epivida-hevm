export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value === false || value === null || value === undefined) return;
    if (key === "class") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (key in node && key !== "list") node[key] = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  });
  append(node, children);
  return node;
}

export function append(node, children = []) {
  const list = Array.isArray(children) ? children : [children];
  list.flat(Infinity).forEach(child => {
    if (child === null || child === undefined || child === false || child === "") return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}

export function frameScheduler(callback) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    const schedule = globalThis.requestAnimationFrame || (fn => globalThis.setTimeout(fn, 16));
    schedule(() => {
      queued = false;
      callback();
    });
  };
}

export function button(label, onClick, attrs = {}) {
  return el("button", { type: "button", onclick: onClick, ...attrs }, [label]);
}

export function link(href, label, attrs = {}) {
  return el("a", { href, ...attrs }, [label]);
}

export function statusDot(tone = "idle") {
  return el("span", { class: `dot ${tone}`, "aria-hidden": "true" });
}

export function field(label, input) {
  return el("label", { class: "field" }, [el("span", {}, [label]), input]);
}

export function textInput(attrs = {}) {
  return el("input", { type: "text", ...attrs });
}

export function dateInput(attrs = {}) {
  return el("input", { type: "date", ...attrs });
}

export function numberInput(attrs = {}) {
  return el("input", { type: "number", inputMode: "numeric", ...attrs });
}

export function textareaInput(attrs = {}) {
  return el("textarea", attrs);
}

export function checkboxInput(attrs = {}) {
  return el("input", { type: "checkbox", ...attrs });
}

export function selectInput(options = [], attrs = {}) {
  const { value: currentValue, ...selectAttrs } = attrs;
  const node = el("select", selectAttrs, options.map(item => {
    const value = Array.isArray(item) ? item[0] : item;
    const label = Array.isArray(item) ? item[1] : item;
    return el("option", { value }, [label]);
  }));
  if (currentValue !== undefined) node.value = currentValue;
  return node;
}

export function badge(label, tone = "") {
  return el("span", { class: `badge ${tone}` }, [label]);
}

export function notice(message, tone = "") {
  return el("p", { class: `notice ${tone}` }, [message]);
}

export function table(headers = [], rows = [], options = {}) {
  const large = options.large || rows.length > 100;
  return el("div", { class: `table-wrap${large ? " large-table" : ""}` }, [
    el("table", {}, [
      el("thead", {}, [el("tr", {}, headers.map(header => el("th", {}, [header])))]),
      el("tbody", {}, rows.length ? rows : [el("tr", {}, [el("td", { colspan: headers.length || 1, class: "muted" }, ["Sin registros."])])])
    ])
  ]);
}

export function pagedTable(headers = [], rows = [], renderRow, options = {}) {
  const pageSize = options.pageSize || 50;
  const threshold = options.threshold || 100;
  if (rows.length <= threshold) return table(headers, rows.map(renderRow));

  let page = 0;
  const root = el("div", { class: "paged-table" });

  function render() {
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    page = Math.min(page, totalPages - 1);
    const start = page * pageSize;
    const end = Math.min(start + pageSize, rows.length);
    root.replaceChildren(
      el("div", { class: "paged-table-controls" }, [
        el("span", { class: "muted" }, [`${start + 1}-${end} de ${rows.length}`]),
        button("Anterior", () => {
          page = Math.max(0, page - 1);
          render();
        }, { class: "small ghost", disabled: page === 0 }),
        button("Siguiente", () => {
          page = Math.min(totalPages - 1, page + 1);
          render();
        }, { class: "small ghost", disabled: page >= totalPages - 1 })
      ]),
      table(headers, rows.slice(start, end).map(renderRow), { large: true })
    );
  }

  render();
  return root;
}
