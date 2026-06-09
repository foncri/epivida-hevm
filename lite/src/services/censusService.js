import { appConfig } from "../lib/config.js";
import { todayIso } from "../lib/date.js";
import { getDocData, setDocMerge } from "./firestoreService.js";
import { listActivePatients } from "./patientService.js";

export async function currentCensus(date = todayIso()) {
  if (appConfig().testMode) {
    const patients = await listActivePatients();
    return { date, totalPatients: patients.length, importedAt: "", importedBy: "", patients };
  }
  try {
    const census = await getDocData(`census_days/${date}`);
    const patients = await listActivePatients();
    return {
      date,
      totalPatients: census?.totalPatients ?? patients.length,
      importedAt: census?.importedAt || "",
      importedBy: census?.importedBy || "",
      patients
    };
  } catch {
    const patients = await listActivePatients();
    return { date, totalPatients: patients.length, importedAt: "", importedBy: "", patients };
  }
}

export async function updateCensusSummary(date, summary) {
  await setDocMerge(`census_days/${date}`, { ...summary, date });
}
