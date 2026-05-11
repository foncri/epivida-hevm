(() => {
  "use strict";

  const MIN_NORMAL = 4.5;
  const MIN_LARGE = 3.1;
  const DARK_TEXT = "#081633";
  const DARK_MUTED = "#526078";
  const LIGHT_TEXT = "#ffffff";
  const LIGHT_MUTED = "#eaf2ff";
  const TEXT_SELECTOR = [
    "h1", "h2", "h3", "h4", "h5", "h6", "div",
    "p", "span", "strong", "small", "label", "legend",
    "li", "td", "th", "button", "a", "b", "em", "dt", "dd"
  ].join(",");
  const LIGHT_SURFACE_SELECTOR = [
    ".iaas-metric", ".round-card", ".device-card", ".device-draft",
    ".import-help", ".import-recommendation", ".import-file-picker", ".import-progress",
    ".round-nav-board", ".round-save-bar", ".sheets-notice", ".check-selector",
    ".compliance-box", ".button-group-field", ".bed-board-picker", ".package-draft",
    ".empty-chart", ".timeline-row"
  ].join(",");
  const DARK_PANEL_SELECTOR = [
    ".iaas-panel", ".patient-follow-card", ".iaas-follow-card", ".monitor-census-block",
    ".census-table-panel", ".import-panel", ".iaas-hero", ".round-header", ".follow-hero",
    ".report-hero", ".census-hero-panel", ".command-dashboard", ".command-panel"
  ].join(",");
  const LIGHT_CONTROL_SELECTOR = [
    ".monitor-census-switch button:not(.active)",
    ".monitor-census-switch button[aria-selected='false']",
    ".iaas-mobile-section-tabs button:not(.active)",
    ".iaas-mobile-section-tabs button[aria-selected='false']",
    ".monitor-census-block [class*='progress']",
    ".monitor-census-block [class*='counter']",
    ".monitor-census-block [class*='pager']",
    ".monitor-census-block [class*='pagination']",
    ".census-table-panel [class*='progress']",
    ".census-table-panel [class*='counter']",
    ".census-table-panel [class*='pager']",
    ".census-table-panel [class*='pagination']",
    ".iaas-table .badge",
    ".iaas-table .chip",
    ".iaas-table [class*='pill']",
    ".iaas-table [class*='tag']",
    ".iaas-table [class*='status']",
    ".iaas-table [class*='estado']"
  ].join(",");

  const colorCache = new Map();
  let scheduled = false;

  function parseColor(value) {
    if (!value || value === "transparent" || value === "currentcolor") return null;
    const cached = colorCache.get(value);
    if (cached) return cached;

    let color = null;
    const hex = value.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
      const raw = hex[1];
      const full = raw.length <= 4
        ? raw.split("").map(ch => ch + ch).join("")
        : raw;
      color = {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
        a: full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
      };
    } else {
      const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
      if (rgb) {
        const parts = rgb[1].split(/\s*,\s*|\s+/).filter(Boolean).map(part => part.replace("/", ""));
        color = {
          r: Number(parts[0]),
          g: Number(parts[1]),
          b: Number(parts[2]),
          a: parts[3] === undefined ? 1 : Number(parts[3])
        };
      }
    }

    if (!color || !Number.isFinite(color.r) || !Number.isFinite(color.g) || !Number.isFinite(color.b)) return null;
    color.a = Number.isFinite(color.a) ? color.a : 1;
    colorCache.set(value, color);
    return color;
  }

  function colorsFromImage(value) {
    if (!value || value === "none") return [];
    const matches = value.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi) || [];
    return matches.map(parseColor).filter(color => color && color.a > 0.15);
  }

  function averageColor(colors) {
    if (!colors.length) return null;
    const total = colors.reduce((sum, color) => sum + color.a, 0) || colors.length;
    return colors.reduce((acc, color) => {
      acc.r += color.r * color.a / total;
      acc.g += color.g * color.a / total;
      acc.b += color.b * color.a / total;
      return acc;
    }, { r: 0, g: 0, b: 0, a: 1 });
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
    let node = element;
    while (node && node.nodeType === 1) {
      const style = getComputedStyle(node);
      const imageColor = averageColor(colorsFromImage(style.backgroundImage));
      if (imageColor) return imageColor;

      const bg = parseColor(style.backgroundColor);
      if (bg && bg.a > 0.65) return bg;

      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  function visible(element, style) {
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function hasReadableText(element) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "IMG", "INPUT", "SELECT", "TEXTAREA"].includes(element.tagName)) return false;
    return Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
  }

  function thresholdFor(style) {
    const size = Number.parseFloat(style.fontSize) || 13;
    const weight = Number.parseInt(style.fontWeight, 10) || 400;
    return size >= 18 || (size >= 14 && weight >= 700) ? MIN_LARGE : MIN_NORMAL;
  }

  function targetColor(element, background) {
    const onLight = luminance(background) > 0.54;
    const subtle = ["P", "SMALL", "LI", "DD", "EM"].includes(element.tagName);
    return onLight
      ? (subtle ? DARK_MUTED : DARK_TEXT)
      : (subtle ? LIGHT_MUTED : LIGHT_TEXT);
  }

  function isInsideLightSurface(element) {
    return Boolean(element.closest(LIGHT_SURFACE_SELECTOR));
  }

  function forcedColor(element) {
    if (element.closest(".iaas-sidebar")) return LIGHT_TEXT;

    if (element.closest(LIGHT_CONTROL_SELECTOR)) return DARK_TEXT;

    if (element.closest("input, select, textarea")) return DARK_TEXT;

    if (element.closest(".iaas-topbar-actions, .command-actions")) {
      const action = element.closest(".iaas-button, .sync, .badge, button, a");
      if (action) return LIGHT_TEXT;
    }

    if (element.closest(DARK_PANEL_SELECTOR) && !isInsideLightSurface(element)) {
      if (element.closest("button:not(.primary):not(.danger), a:not(.primary):not(.danger), .iaas-button:not(.primary):not(.danger)")) return LIGHT_TEXT;
      if (element.matches("h1,h2,h3,h4,h5,h6,p,small,strong,span,label,legend,div,td,th")) return LIGHT_TEXT;
      if (element.closest(".field")) return LIGHT_TEXT;
    }

    return "";
  }

  function applyColor(element, color) {
    element.style.setProperty("color", color, "important");
    element.style.setProperty("-webkit-text-fill-color", color, "important");
    element.dataset.epividaContrastFixed = "true";
  }

  function fixElement(element) {
    const style = getComputedStyle(element);
    if (!visible(element, style) || !hasReadableText(element)) return;

    const forced = forcedColor(element);
    if (forced) {
      applyColor(element, forced);
      return;
    }

    const fill = parseColor(style.webkitTextFillColor);
    const foreground = fill || parseColor(style.color);
    if (!foreground || foreground.a < 0.65) return;

    const background = effectiveBackground(element);
    if (contrast(foreground, background) >= thresholdFor(style)) return;

    applyColor(element, targetColor(element, background));
  }

  function scan() {
    scheduled = false;
    const root = document.querySelector(".command-shell") || document.querySelector("#app") || document.body;
    if (!root) return;
    root.querySelectorAll(TEXT_SELECTOR).forEach(fixElement);
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => setTimeout(scan, 40));
  }

  window.addEventListener("hashchange", () => setTimeout(scheduleScan, 120));
  window.addEventListener("resize", scheduleScan);
  document.addEventListener("input", scheduleScan, true);
  document.addEventListener("change", scheduleScan, true);

  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "aria-expanded", "aria-selected"]
  });

  scheduleScan();
  setTimeout(scheduleScan, 700);
  setTimeout(scheduleScan, 1800);
})();
