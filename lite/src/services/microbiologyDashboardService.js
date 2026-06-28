import { normalizeDate, nowIso, todayIso } from "../lib/date.js";
import { listAntimicrobialsByStatus } from "./antimicrobialService.js";
import { listCulturesByStatus } from "./cultureService.js";
import { microbiologyClinicalAlerts } from "./microbiologyAlertService.js";

const MICRO_LIMIT = 40;
const CULTURE_RESULT_STATUSES = ["positivo", "resultado", "negativo"];
const ACTIVE_ANTIMICROBIAL_STATUSES = ["activo", "ajustado", "profilaxis"];

export async function loadMicrobiologyDashboard(options = {}) {
  const limit = Math.min(100, Math.max(1, Number(options.limit) || MICRO_LIMIT));
  const today = normalizeDate(options.today) || todayIso();
  const [requested, pending, resultCulturesByStatus, antimicrobialsByStatus] = await Promise.all([
    listCulturesByStatus("solicitado", { limit }),
    listCulturesByStatus("pendiente", { limit }),
    Promise.all(CULTURE_RESULT_STATUSES.map(status => listCulturesByStatus(status, { limit }))),
    Promise.all(ACTIVE_ANTIMICROBIAL_STATUSES.map(status => listAntimicrobialsByStatus(status, { limit })))
  ]);
  const pendingCultures = uniqueById([...requested, ...pending], row => row.cultureId || row.id);
  const resultCultures = uniqueById(resultCulturesByStatus.flat(), row => row.cultureId || row.id);
  const activeAntimicrobials = uniqueById(antimicrobialsByStatus.flat(), row => row.antimicrobialId || row.id);
  return {
    updatedAt: nowIso(),
    limit,
    pendingCultures,
    resultCultures,
    positiveCultures: resultCultures.filter(isPositiveCulture),
    activeAntimicrobials,
    clinicalAlerts: microbiologyClinicalAlerts({
      cultures: [...pendingCultures, ...resultCultures],
      antimicrobials: activeAntimicrobials,
      today,
      limit: 12
    })
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
