import { todayIso, normalizeDate } from "../../lib/date.js";

export async function render({ app, route }) {
  const parsed = parseRoundRoute(route.parts);
  if (parsed.patientId) {
    const { renderPatientRound } = await import("./patientRound.js");
    return renderPatientRound(app, parsed);
  }
  const { renderRoundPage } = await import("./roundPage.js");
  return renderRoundPage(app, parsed);
}

function parseRoundRoute(parts = []) {
  const route = parts[0] || "ronda-paquetes";
  const first = normalizeDate(parts[1]);
  if (route === "ronda") {
    return { date: first || todayIso(), patientId: parts[2] === "paciente" ? parts[3] : "" };
  }
  if (parts[1] === "paciente") return { date: todayIso(), patientId: parts[2] || "" };
  return { date: first || todayIso(), patientId: parts[2] === "paciente" ? parts[3] : "" };
}
