(() => {
  "use strict";

  if (window.__epividaUrgenciasAisPImportFix) return;
  window.__epividaUrgenciasAisPImportFix = true;

  const BUTTON_RE = /PEGAR\s+Y\s+VALIDAR\s+CENSO/i;

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const normalized = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  function splitLine(line, delimiter) {
    if (delimiter !== "\t") return line.split(delimiter).map(clean);
    return line.split("\t").map(clean);
  }

  function joinLine(cells, delimiter) {
    return cells.join(delimiter);
  }

  function detectDelimiter(lines) {
    if (lines.some(line => line.includes("\t"))) return "\t";
    return [",", ";", "|"]
      .map(delimiter => [delimiter, Math.max(...lines.map(line => line.split(delimiter).length))])
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  function isAisP(value) {
    return /^AIS(?:LADO)?\s*P$/.test(normalized(value));
  }

  function looksLikeBed(value) {
    const key = normalized(value);
    return isAisP(key)
      || /^(F|UX|URX|P)\s*-?\s*\d+\b/.test(key)
      || /^(CAMA|CAM|AIS|AISLADO|OBS|CAMILLA)[\s:-]*[A-Z0-9-]+/.test(key);
  }

  function looksLikeName(value) {
    const key = normalized(value);
    return key.length >= 8 && /[A-Z]{2,}\s+[A-Z]{2,}/.test(key);
  }

  function looksLikeService(value) {
    return /\b(URGENCIAS|URG|MEDICINA INTERNA|PEDIATRIA|CIRUGIA|TRAUMATOLOGIA|GINECOLOGIA|UCIA|UCIN|UCIP|HEMODIALISIS|ONCOLOGIA)\b/.test(normalized(value));
  }

  function looksLikeDate(value) {
    return /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/.test(clean(value));
  }

  function looksLikeRfc(value) {
    return /^[A-Z&]{3,5}\d{6}-?[A-Z0-9]{1,4}$/.test(normalized(value).replace(/\s+/g, ""));
  }

  function looksLikeSex(value) {
    return /^(M|F|MASCULINO|FEMENINO|HOMBRE|MUJER)$/.test(normalized(value));
  }

  function looksLikeAge(value) {
    const key = normalized(value);
    if (looksLikeDate(value)) return false;
    const match = key.match(/\b(\d{1,3})\b/);
    if (!match) return false;
    const number = Number(match[1]);
    if (!Number.isFinite(number) || number > 120) return false;
    return /\b(ANO|ANOS|A|MES|MESES|DIA|DIAS)\b/.test(key) || key === String(number);
  }

  function normalizeAisPLine(line, delimiter) {
    const cells = splitLine(line, delimiter).map(cell => isAisP(cell) ? "AIS P" : cell);
    return joinLine(cells, delimiter);
  }

  function normalizeLegacyColumnOrder(line, delimiter) {
    const cells = splitLine(line, delimiter);
    for (let index = 0; index < cells.length - 2; index += 1) {
      if (looksLikeDate(cells[index]) && looksLikeRfc(cells[index + 1]) && looksLikeAge(cells[index + 2])) {
        const rfc = cells[index + 1];
        cells[index + 1] = cells[index + 2];
        cells[index + 2] = rfc;
        break;
      }
    }
    return joinLine(cells, delimiter);
  }

  function isUnfinishedCensusLine(line, delimiter) {
    const cells = splitLine(line, delimiter).filter(Boolean);
    if (!cells.length || cells.length > 6) return false;
    return cells.some(looksLikeBed)
      && cells.some(looksLikeName)
      && !cells.some(looksLikeDate)
      && !cells.some(looksLikeRfc);
  }

  function isContinuationLine(line, delimiter) {
    const cells = splitLine(line, delimiter).filter(Boolean);
    if (cells.length < 3) return false;
    if (looksLikeService(cells[0]) || looksLikeBed(cells[0])) return false;
    return cells.some(looksLikeDate) || cells.some(looksLikeRfc) || cells.some(looksLikeSex);
  }

  function repairImportText(text) {
    const rawLines = String(text || "").replace(/\r/g, "").split("\n").filter(line => line.trim());
    if (!rawLines.length) return text;
    const delimiter = detectDelimiter(rawLines);
    const stitched = [];

    rawLines.forEach(rawLine => {
      const line = normalizeAisPLine(rawLine, delimiter);
      const previous = stitched[stitched.length - 1] || "";
      if (previous && isUnfinishedCensusLine(previous, delimiter) && isContinuationLine(line, delimiter)) {
        stitched[stitched.length - 1] = normalizeLegacyColumnOrder(`${previous} ${line}`, delimiter);
        return;
      }

      const firstCell = splitLine(line, delimiter).find(Boolean) || "";
      if (isAisP(firstCell)) stitched.push("URGENCIAS");
      stitched.push(normalizeLegacyColumnOrder(line, delimiter));
    });

    return stitched.join("\n");
  }

  function repairTextarea() {
    const textarea = document.querySelector("#import-text")
      || [...document.querySelectorAll("textarea")].find(candidate => candidate.value && /AIS(?:LADO)?\s*P/i.test(candidate.value));
    if (!textarea?.value) return;
    const repaired = repairImportText(textarea.value);
    if (repaired === textarea.value) return;
    textarea.value = repaired;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  window.addEventListener("click", event => {
    const button = event.target?.closest?.("button");
    if (!button || !BUTTON_RE.test(normalized(button.textContent || ""))) return;
    repairTextarea();
  }, true);
})();
