export function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizedPatientName(value = "") {
  return normalizeText(value)
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeService(value = "") {
  const text = normalizeText(value);
  if (!text) return "";
  if (/UCIN|NEONAT/.test(text)) return "UCIN NEONATALES";
  if (/UCIP|PEDIATR/.test(text) && /UCI|UCIP/.test(text)) return "UCI PEDIATRICOS";
  if (/UCIA|UCI ADUL|TERAPIA INTENSIVA ADUL/.test(text)) return "UCI ADULTOS";
  if (/MEDICINA INTERNA|MI\b/.test(text)) return "MEDICINA INTERNA";
  if (/PEDIATR/.test(text)) return "PEDIATRIA";
  if (/CIRUG|TRAUMA|TOCO/.test(text)) return "CIRUGIA Y TRAUMATOLOGIA";
  if (/GINE|OBST/.test(text)) return "GINECOLOGIA Y OBSTETRICIA";
  if (/CUNERO/.test(text)) return "CUNEROS";
  if (/URGEN/.test(text)) return "URGENCIAS";
  if (/HEMOD/.test(text)) return "HEMODIALISIS";
  return text;
}

export function normalizeBed(value = "") {
  return normalizeText(value)
    .replace(/^CAMA\s+/, "")
    .replace(/\bCAMA\b/g, "")
    .replace(/\s*[-/]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSex(value = "") {
  const text = normalizeText(value);
  if (/^F|FEM/.test(text)) return "F";
  if (/^M|MASC/.test(text)) return "M";
  return "";
}

export function normalizeStatus(value = "") {
  const text = normalizeText(value);
  if (!text) return "";
  if (/CRIT/.test(text)) return "CRITICO";
  if (/MUY\s+GRAVE/.test(text)) return "MUY GRAVE";
  if (/GRAVE/.test(text)) return "GRAVE";
  if (/DELIC/.test(text)) return "DELICADO";
  if (/ESTABLE/.test(text)) return "ESTABLE";
  return text;
}

export function normalizeEpidemiologicalDiagnosis(value = "") {
  const text = normalizeText(value);
  if (!text) return "";
  if (/NO\s+IAAS/.test(text)) return "NO IAAS";
  if (/RIESGO.*IAAS|IAAS.*RIESGO/.test(text)) return "RIESGO IAAS";
  if (/VIG.*TRANSM/.test(text)) return "VIG TRANSMISIBLE";
  if (/VIG.*NO.*TRANSM/.test(text)) return "VIG NO TRANSMISIBLE";
  if (/IAAS/.test(text)) return "IAAS";
  return text;
}
