(() => {
  "use strict";

  if (window.__epividaIaasCedulasLoader20260521) return;
  window.__epividaIaasCedulasLoader20260521 = true;

  const SYSTEM_SOURCE = "./iaas-system.js?v=2026-06-04-sheets40301";
  const FOLLOWUP_LOADER = "./iaas-system-followup-loader-2026-05-20.js?v=2026-05-20-followup01";
  const ENABLE_LEGACY_CEDULA_PATCHES = window.EPIVIDA_ENABLE_LEGACY_CEDULA_PATCHES === true;
  const CEDULA_OPS_GZIP_BASE64 = "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";

  function hasFollowupPatch(source) {
    return source.includes("OPD_DISCHARGE_TYPES")
      && source.includes("renderIaasOpdPanel")
      && source.includes("OTRO F")
      && source.includes("Otro cultivo")
      && source.includes("summarizeCustomStudies");
  }

  function hasCedulasPatch(source) {
    return source.includes("PREVENTIVE_CEDULA_SPECS")
      && source.includes("preventiveCedulaSheetPayloads")
      && source.includes("preventiveMonthlySheetPayloads")
      && source.includes("SUMA TOTAL")
      && source.includes("compactKey");
  }

  function applyOps(source, ops, label) {
    const normalized = String(source || "").replace(/\r\n/g, "\n");
    if (label === "seguimiento IAAS" && hasFollowupPatch(normalized)) return normalized;
    if (label === "cedulas preventivas" && hasCedulasPatch(normalized)) return normalized;
    const lines = normalized.split("\n");
    for (let i = ops.length - 1; i >= 0; i -= 1) {
      const op = ops[i];
      lines.splice(op.start, op.deleteCount, ...(op.insert || []));
    }
    const patched = lines.join("\n");
    if (label === "seguimiento IAAS" && !hasFollowupPatch(patched)) throw new Error("No se pudo aplicar seguimiento IAAS.");
    if (label === "cedulas preventivas" && !hasCedulasPatch(patched)) throw new Error("No se pudo aplicar cedulas preventivas.");
    return patched;
  }

  function extractFollowupOps(loaderSource) {
    const match = String(loaderSource || "").match(/const OPS = (\[.*?\]);\s*function loadSource/s);
    if (!match) throw new Error("No se encontraron operaciones previas de seguimiento IAAS.");
    return JSON.parse(match[1]);
  }

  async function fetchText(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo cargar ${url}: ${response.status}`);
    return response.text();
  }

  async function inflateBase64Gzip(value) {
    if (!window.DecompressionStream) throw new Error("Chrome no tiene disponible DecompressionStream.");
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  }

  window.__epividaCedulasReady = (async () => {
    let source = "";
    try {
      if (!ENABLE_LEGACY_CEDULA_PATCHES) {
        source = await fetchText(SYSTEM_SOURCE);
        (0, eval)(source + "\n//# sourceURL=iaas-system.base-through-preloaders-2026-06-04.js");
        return;
      }
      const [followupLoaderSource, systemSource, cedulaOpsJson] = await Promise.all([
        fetchText(FOLLOWUP_LOADER),
        fetchText(SYSTEM_SOURCE),
        inflateBase64Gzip(CEDULA_OPS_GZIP_BASE64)
      ]);
      source = systemSource;
      const followupOps = extractFollowupOps(followupLoaderSource);
      const cedulaOps = JSON.parse(cedulaOpsJson);
      const patchedFollowup = applyOps(systemSource, followupOps, "seguimiento IAAS");
      const patchedCedulas = applyOps(patchedFollowup, cedulaOps, "cedulas preventivas");
      (0, eval)(patchedCedulas + "\n//# sourceURL=iaas-system.cedulas-patched-2026-05-21.js");
    } catch (error) {
      console.warn("No se pudo aplicar el cargador de cedulas preventivas; se usa el sistema base.", error);
      if (source) (0, eval)(source + "\n//# sourceURL=iaas-system.cedulas-fallback-2026-05-21.js");
      else throw error;
    }
  })();
})();
