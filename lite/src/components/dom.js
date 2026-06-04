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

export function selectInput(options = [], attrs = {}) {
  return el("select", attrs, options.map(item => {
    const value = Array.isArray(item) ? item[0] : item;
    const label = Array.isArray(item) ? item[1] : item;
    return el("option", { value }, [label]);
  }));
}

export function table(headers = [], rows = []) {
  return el("div", { class: "table-wrap" }, [
    el("table", {}, [
      el("thead", {}, [el("tr", {}, headers.map(header => el("th", {}, [header])))]),
      el("tbody", {}, rows.length ? rows : [el("tr", {}, [el("td", { colspan: headers.length || 1, class: "muted" }, ["Sin registros."])])])
    ])
  ]);
}
