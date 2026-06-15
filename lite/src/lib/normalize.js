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
  if (/ONCO/.test(text)) return "ONCOLOGIA";
  if (/AMBUL/.test(text)) return "AMBULATORIO";
  return text;
}

export function normalizeBed(value = "") {
  return normalizeText(value)
    .replace(/^CAMA\s+/, "")
    .replace(/\bCAMA\b/g, "")
    .replace(/\b(SERVICIO|HABITACION|UBICACION|CUBICULO)\b/g, "")
    .replace(/\s+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UTIP|UCIA|HEMO|HEM|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "")
    .replace(/(\d+)[\s-]+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UTIP|UCIA|HEMO|HEM|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "$1")
    .replace(/\s*[-/]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function serviceFromBed(value = "") {
  const key = normalizeText(value);
  if (!key) return "";
  if (/^AIS\s*P\b/.test(key)) return "URGENCIAS";
  if (/^(F|UX|URX|P|B)\s*-?\s*\d+\b|\b(CHOQUE|URGENCIA|URGENCIAS|OBSERVACION)\b/.test(key)) return "URGENCIAS";
  if (/^UCIA\s*\d+\b|\b(UCI\s*ADUL|TERAPIA INTENSIVA ADUL)\b/.test(key)) return "UCI ADULTOS";
  if (/^UCIN\s*\d+\b|\bNEONAT/.test(key)) return "UCIN NEONATALES";
  if (/^(UCIP|UTIP)\s*\d+\b|\bUCI\s*PED/.test(key)) return "UCI PEDIATRICOS";
  if (/^CUN\s*\d+\b|\bCUNERO/.test(key)) return "CUNEROS";
  if (/^HEM\s*\d+\b|\b(HEMO|HEMODIALISIS|HD)\b/.test(key)) return "HEMODIALISIS";
  if (/\bONCO\b|^ONCO\s*\d+\b/.test(key)) return "ONCOLOGIA";
  if (/\bAMB\b|AMBULATORIO/.test(key)) return "AMBULATORIO";
  if (/\b(MI|MEDICINA INTERNA)\b/.test(key)) return "MEDICINA INTERNA";
  if (/\b(PED|PEDS|PEDIATRIA)\b/.test(key)) return "PEDIATRIA";
  if (/\b(CX|TX|CIR|TRAUMA|CIRUGIA)\b/.test(key)) return "CIRUGIA Y TRAUMATOLOGIA";
  if (/\b(GYO|GO|GINE|OBST)\b/.test(key)) return "GINECOLOGIA Y OBSTETRICIA";
  return "";
}

export function splitServiceBed(value = "") {
  const text = normalizeText(value);
  if (!text) return { service: "", bed: "" };
  const explicit = text.match(/^(.*?)(?:\s+\/\s+|\s+-\s+|\s{2,})(.+)$/);
  if (explicit) {
    return {
      service: normalizeService(explicit[1]),
      bed: normalizeBed(explicit[2])
    };
  }
  const service = normalizeService(text);
  const bedService = serviceFromBed(text);
  if (bedService) return { service: bedService, bed: normalizeBed(text) };
  return service && service !== text ? { service, bed: "" } : { service: "", bed: normalizeBed(text) };
}

export function normalizeImportLocation(serviceValue = "", bedValue = "", serviceBedValue = "") {
  const combined = splitServiceBed(serviceBedValue);
  const bed = normalizeBed(bedValue || combined.bed);
  const service = normalizeService(serviceValue || combined.service) || serviceFromBed(bed || serviceBedValue);
  return { service, bed };
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
