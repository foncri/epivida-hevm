(() => {
  "use strict";

  const VERSION = "2026-05-11-contrast10";
  const MIN_NORMAL = 4.5;
  const MIN_LARGE = 3.05;
  const DARK_TEXT = "#081633";
  const DARK_MUTED = "#526078";
  const LIGHT_TEXT = "#ffffff";
  const LIGHT_MUTED = "#eaf2ff";
  const TEXT_SELECTOR = [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "strong", "small",
    "label", "legend", "li", "td", "th", "button", "a", "b", "em", "dt", "dd", "div"
  ].join(",");
  const FORM_SELECTOR = "input, select, textarea";
  const LIGHT_SURFACE_SELECTOR = [
    ".import-file-picker",
    ".monitor-filter-count",
    ".notice.warn",
    ".notice.ok",
    ".monitor-census-switch button:not(.active)",
    ".monitor-census-switch button[aria-selected='false']",
    ".iaas-mobile-section-tabs button:not(.active)",
    ".iaas-mobile-section-tabs button[aria-selected='false']",
    ".service-filter button:not(.active)",
    "[role='tab'][aria-selected='false']"
  ].join(",");

  const colorCache = new Map();
  let scheduled = false;
  let lastFixedCount = 0;

  function parseColor(value) {
    if (!value || value === "transparent" || value === "currentcolor") return null;
    const cached = colorCache.get(value);
    if (cached) return cached;

    let color = null;
    const hex = String(value).match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
      const raw = hex[1];
      const full = raw.length <= 4 ? raw.split("").map(ch => ch + ch).join("") : raw;
      color = {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
        a: full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
      };
    } else {
      const rgb = String(value).match(/^rgba?\(([^)]+)\)$/i);
      if (rgb) {
        const parts = rgb[1]
          .trim()
          .split(/\s*,\s*|\s+/)
          .filter(Boolean)
          .map(part => part.replace("/", ""));
        color = {
          r: Number(parts[0]),
          g: Number(parts[1]),
          b: Number(parts[2]),
          a: parts[3] === undefined ? 1 : Number(parts[3])
        };
      }
    }

    if (!color || !Number.isFinite(color.r) || !Number.isFinite(color.g) || !Number.isFinite(color.b)) return null;
    color.r = Math.max(0, Math.min(255, color.r));
    color.g = Math.max(0, Math.min(255, color.g));
    color.b = Math.max(0, Math.min(255, color.b));
    color.a = Number.isFinite(color.a) ? Math.max(0, Math.min(1, color.a)) : 1;
    colorCache.set(value, color);
    return color;
  }

  function colorsFromImage(value) {
    if (!value || value === "none") return [];
    const matches = String(value).match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi) || [];
    return matches.map(parseColor).filter(color => color && color.a > 0.02);
  }

  function averageColor(colors) {
    if (!colors.length) return null;
    const total = colors.reduce((sum, color) => sum + Math.max(color.a, 0.12), 0) || colors.length;
    const avg = colors.reduce((acc, color) => {
      const weight = Math.max(color.a, 0.12) / total;
      acc.r += color.r * weight;
      acc.g += color.g * weight;
      acc.b += color.b * weight;
      acc.a += color.a / colors.length;
      return acc;
    }, { r: 0, g: 0, b: 0, a: 0 });
    avg.a = Math.max(0.35, Math.min(1, avg.a));
    return avg;
  }

  function blend(top, bottom) {
    const alpha = Math.max(0, Math.min(1, top.a ?? 1));
    const inv = 1 - alpha;
    return {
      r: top.r * alpha + bottom.r * inv,
      g: top.g * alpha + bottom.g * inv,
      b: top.b * alpha + bottom.b * inv,
      a: 1
    };
  }

  function channel(value) {
    const n = value / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  }

  function luminance(color) {
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  }

  function contrast(a, b) {
    const light = Math.max(luminance(a), luminance(b));
    const dark = Math.min(luminance(a), luminance(b));
    return (light + 0.05) / (dark + 0.05);
  }

  function effectiveBackground(element) {
    const layers = [];
    let node = element;

    while (node && node.nodeType === 1) {
      const style = getComputedStyle(node);
      const imageColor = averageColor(colorsFromImage(style.backgroundImage));
      const bgColor = parseColor(style.backgroundColor);

      if (imageColor) layers.push(imageColor);
      if (bgColor && bgColor.a > 0.02) layers.push(bgColor);

      node = node.parentElement;
    }

    let result = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      result = blend(layers[i], result);
    }
    return result;
  }

  function isVisible(element, style) {
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function hasReadableText(element) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "IMG", "CANVAS", "INPUT", "SELECT", "TEXTAREA"].includes(element.tagName)) return false;
    const ownText = Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
    if (ownText) return true;
    return ["BUTTON", "A", "TD", "TH"].includes(element.tagName) && Boolean((element.innerText || element.textContent || "").trim());
  }

  function thresholdFor(style) {
    const size = Number.parseFloat(style.fontSize) || 13;
    const weight = Number.parseInt(style.fontWeight, 10) || 400;
    return size >= 18 || (size >= 14 && weight >= 700) ? MIN_LARGE : MIN_NORMAL;
  }

  function readableColor(element, background) {
    if (element.closest(LIGHT_SURFACE_SELECTOR) || element.closest(FORM_SELECTOR)) return DARK_TEXT;
    const onLight = luminance(background) > 0.53;
    const subtle = ["P", "SMALL", "LI", "DD", "EM"].includes(element.tagName);
    return onLight ? (subtle ? DARK_MUTED : DARK_TEXT) : (subtle ? LIGHT_MUTED : LIGHT_TEXT);
  }

  function colorToObject(color) {
    return parseColor(color) || parseColor("#000000");
  }

  function applyColor(element, color) {
    const current = element.style.getPropertyValue("color").trim();
    const currentFill = element.style.getPropertyValue("-webkit-text-fill-color").trim();
    if (current === color && currentFill === color) return false;
    element.style.setProperty("color", color, "important");
    element.style.setProperty("-webkit-text-fill-color", color, "important");
    element.dataset.epividaContrastFixed = VERSION;
    return true;
  }

  function auditElement(element) {
    const style = getComputedStyle(element);
    if (!isVisible(element, style) || !hasReadableText(element)) return false;

    const background = effectiveBackground(element);
    const forced = element.closest(LIGHT_SURFACE_SELECTOR) || element.closest(FORM_SELECTOR);
    const fill = parseColor(style.webkitTextFillColor);
    const foreground = fill || parseColor(style.color);
    const target = readableColor(element, background);

    if (forced) return applyColor(element, target);
    if (!foreground || foreground.a < 0.55) return applyColor(element, target);

    if (contrast(foreground, background) >= thresholdFor(style)) return false;

    const darkContrast = contrast(colorToObject(DARK_TEXT), background);
    const lightContrast = contrast(colorToObject(LIGHT_TEXT), background);
    const best = darkContrast >= lightContrast ? target : LIGHT_TEXT;
    return applyColor(element, best);
  }

  function hasLowContrast(element) {
    const style = getComputedStyle(element);
    if (!isVisible(element, style) || !hasReadableText(element)) return false;
    const background = effectiveBackground(element);
    const foreground = parseColor(style.webkitTextFillColor) || parseColor(style.color);
    if (!foreground || foreground.a < 0.55) return true;
    return contrast(foreground, background) < thresholdFor(style);
  }

  function describeLowContrast(element) {
    const text = (element.innerText || element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70);
    const cls = String(element.className || "").replace(/\s+/g, ".").slice(0, 90);
    return `${element.tagName.toLowerCase()}${cls ? "." + cls : ""}:${text}`;
  }

  function scan() {
    scheduled = false;
    const root = document.querySelector(".command-shell") || document.querySelector(".iaas-shell") || document.querySelector("#app") || document.body;
    if (!root) return;

    let fixed = 0;
    const elements = Array.from(root.querySelectorAll(TEXT_SELECTOR));
    elements.forEach(element => {
      if (auditElement(element)) fixed += 1;
    });

    let low = 0;
    const examples = [];
    elements.forEach(element => {
      if (!hasLowContrast(element)) return;
      low += 1;
      if (examples.length < 10) examples.push(describeLowContrast(element));
    });

    lastFixedCount = fixed;
    document.documentElement.dataset.epividaContrastRepair = VERSION;
    document.documentElement.dataset.epividaContrastFixedCount = String(lastFixedCount);
    document.documentElement.dataset.epividaContrastLowCount = String(low);
    document.documentElement.dataset.epividaContrastLowExamples = examples.join(" | ").slice(0, 700);
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => setTimeout(scan, 50));
  }

  window.EPIVIDA_CONTRAST_REPAIR = { version: VERSION, scan, scheduleScan };
  window.addEventListener("hashchange", () => setTimeout(scheduleScan, 120));
  window.addEventListener("resize", scheduleScan);
  window.addEventListener("scroll", scheduleScan, true);
  document.addEventListener("input", scheduleScan, true);
  document.addEventListener("change", scheduleScan, true);
  document.addEventListener("click", () => setTimeout(scheduleScan, 80), true);

  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "aria-expanded", "aria-selected", "data-state"]
  });

  scheduleScan();
  setTimeout(scheduleScan, 400);
  setTimeout(scheduleScan, 1000);
  setTimeout(scheduleScan, 2200);
})();
