import { nowIso } from "../lib/date.js";
import { listAntimicrobialsByStatus } from "./antimicrobialService.js";
import { listCulturesByStatus } from "./cultureService.js";

const MICRO_LIMIT = 40;

export async function loadMicrobiologyDashboard(options = {}) {
  const limit = Math.min(100, Math.max(1, Number(options.limit) || MICRO_LIMIT));
  const [requested, pending, positive, resulted, activeAntimicrobials] = await Promise.all([
    listCulturesByStatus("solicitado", { limit }),
    listCulturesByStatus("pendiente", { limit }),
    listCulturesByStatus("positivo", { limit }),
    listCulturesByStatus("resultado", { limit }),
    listAntimicrobialsByStatus("activo", { limit })
  ]);
  const pendingCultures = uniqueById([...requested, ...pending], row => row.cultureId || row.id);
  const resultCultures = uniqueById([...positive, ...resulted], row => row.cultureId || row.id);
  return {
    updatedAt: nowIso(),
    limit,
    pendingCultures,
    resultCultures,
    positiveCultures: resultCultures.filter(isPositiveCulture),
    activeAntimicrobials
  };
}

function uniqueById(rows = [], keyFor) {
  const map = new Map();
  rows.forEach(row => {
    const key = keyFor(row);
    if (key) map.set(key, { ...map.get(key), ...row });
  });
  return [...map.values()];
}

function isPositiveCulture(row = {}) {
  const status = String(row.status || "").toLowerCase();
  const organism = String(row.organism || "").trim().toLowerCase();
  return status === "positivo" || (status === "resultado" && organism && organism !== "pendiente" && organism !== "negativo");
}
