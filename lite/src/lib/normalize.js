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
  if (/UCIN|NEONAT/.test(text)) return "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES";
  if (/UCIP|UTIP|UCI\s+PED|INTENSIVO.*PEDIATR/.test(text)) return "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS";
  if (/UCIA|UCI\s+ADUL|TERAPIA\s+INTENSIVA\s+ADUL|INTENSIVO.*ADUL/.test(text)) return "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS";
  if (/MEDICINA INTERNA|MED\s+INT|\bMI\b/.test(text)) return "MEDICINA INTERNA";
  if (/PEDIATR/.test(text)) return "PEDIATRIA";
  if (/CIRUG|TRAUMA|TOCO|\bCX\b|\bTX\b/.test(text)) return "CIRUGIA Y TRAUMATOLOGIA";
  if (/GINE|OBST|\bGYO\b|\bGO\b/.test(text)) return "GINECOLOGIA Y OBSTETRICIA";
  if (/CUNERO|\bCUN\b|ESCOLAR/.test(text)) return "CUNEROS";
  if (/URGEN|\bURG\b|OBSERVACION/.test(text)) return "URGENCIAS";
  if (/HEMOD|\bHEMO\b|\bHD\b/.test(text)) return "HEMODIALISIS";
  if (/ONCO/.test(text)) return "ONCOLOGIA";
  if (/AMBUL|CONSULTA\s+EXTERNA/.test(text)) return "AMBULATORIO";
  return text;
}

export function normalizeBed(value = "") {
  let text = normalizeText(value);
  if (!text || text.length > 36 || /[\/()]/.test(text)) return "";
  text = text
    .replace(/^CAMA\s*[:#-]?\s*/, "")
    .replace(/^CAM\s*[:#-]?\s*/, "")
    .replace(/^CAMILLA\s*[:#-]?\s*/, "")
    .replace(/\bCAMA\b/g, "")
    .replace(/\b(SERVICIO|HABITACION|UBICACION|CUBICULO)\b/g, "")
    .replace(/\bAISLAD[OA]\b/g, "AIS")
    .replace(/\bOBSERVACIONES?\b/g, "OBS")
    .replace(/\bCUNEROS?\b/g, "CUN")
    .replace(/\bCUNERO\b/g, "CUN")
    .replace(/\bESCOLARES?\b/g, "ESC")
    .replace(/\bALOJAMIENTO\b/g, "ALOJ")
    .replace(/\bUCIP\b/g, "UTIP")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  text = text
    .replace(/^(\d+)\.0$/, "$1")
    .replace(/^(AIS|OBS|CUN|ESC|UX|URX|HEM|ALOJ|UTIP|UCIN|UCIA)(\d+)/, "$1 $2")
    .replace(/^AIS\s*P$/, "AIS P");
  const aisOrObs = text.match(/^(AIS|OBS)\s*(\d+)\s*(MI|CX|TX|PED|PEDS|GYO|GO|UCIN|UCIP|UTIP|UCIA|HEM|HD|ONCO|URG)?\b/);
  if (aisOrObs) return [aisOrObs[1], aisOrObs[2], canonicalBedSuffix(aisOrObs[3] || "")].filter(Boolean).join(" ");
  if (/^CUN\s*\d+\b/.test(text)) return text.replace(/^CUN\s*(\d+)\b/, "CUN $1");
  if (/^UTIP\s*1\b|^UCIP\s*1\b/.test(text)) return "UTIP 1";
  return text
    .replace(/\s+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UTIP|UCIA|HEMO|HEM|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "")
    .replace(/(\d+)[\s-]+(CX\s*TX|CX|TX|MI|PED|PEDS|GYO|GO|UCIN|UCIP|UTIP|UCIA|HEMO|HEM|HD|ONCO|URG|AMB|CIR|TRAUMA)$/i, "$1")
    .trim();
}

export function serviceFromBed(value = "") {
  const bed = normalizeBed(value);
  const key = normalizeText(bed || value);
  if (!key) return "";
  const special = key.match(/^(AIS|OBS)\s*\d+\s+([A-Z]{2,4})\b/);
  if (special) return serviceFromBedSuffix(special[2]);
  if (/^AIS\s*P\b/.test(key)) return "URGENCIAS";
  if (/^(F|UX|URX|P|B)\s*-?\s*\d+\b|\b(CHOQUE|URGENCIA|URGENCIAS|OBSERVACION)\b/.test(key)) return "URGENCIAS";
  if (/^UCIA\b|\b(UCI\s*ADUL|TERAPIA INTENSIVA ADUL)\b/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS";
  if (/^UCIN\s*\d+\b|\bNEONAT/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES";
  if (/^(UCIP|UTIP)\s*\d+\b|\bUCI\s*PED/.test(key)) return "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS";
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
  const rawBed = bedValue || combined.bed || serviceBedValue;
  const bedService = serviceFromBed(rawBed);
  let service = normalizeService(serviceValue || combined.service) || bedService;
  let bed = normalizeBed(rawBed);
  if (/^(AIS|OBS)\s+\d+$/.test(bed)) {
    const suffix = bedSuffixForService(service || bedService);
    if (suffix) bed = `${bed} ${suffix}`;
  }
  if (/^CUN\s+\d+\b/.test(normalizeText(bed))) service = "CUNEROS";
  return { service, bed };
}

export function normalizeSector(value = "") {
  const key = normalizeText(value);
  if (!key || ["NO APLICA", "SIN DATO", "SD", "S/D"].includes(key)) return "";
  if (["MAG", "MAGISTERIO"].includes(key)) return "MAGISTERIO";
  if (["BUR", "BUROCRACIA"].includes(key)) return "BUROCRACIA";
  if (["PIM", "PENSIONADO ISSTECH MAGISTERIO", "PENSIONADO MAGISTERIO"].includes(key)) return "PENSIONADO ISSTECH MAGISTERIO";
  if (["PIB", "PGB", "PENSIONADO ISSTECH BUROCRACIA", "PENSIONADO BUROCRACIA"].includes(key)) return "PENSIONADO ISSTECH BUROCRACIA";
  if (key.includes("ISSTECH")) return key.includes("PENSIONADO") ? key : "ISSTECH";
  if (["PRIV", "PRIVADO", "PARTICULAR", "NA", "N/A"].includes(key)) return "PRIVADO";
  return key;
}

export function normalizeSex(value = "") {
  const text = normalizeText(value);
  if (text === "F" || text === "MUJER" || /^FEM/.test(text)) return "F";
  if (text === "M" || text === "HOMBRE" || /^MASC/.test(text)) return "M";
  return "";
}

export function normalizeStatus(value = "") {
  const text = normalizeText(value);
  if (!text) return "";
  if (/CRIT.*INTUB|INTUB.*CRIT/.test(text)) return "CRITICO INTUBADO";
  if (/MUY\s+GRAVE.*INTUB|INTUB.*MUY\s+GRAVE/.test(text)) return "MUY GRAVE INTUBADO";
  if (/GRAVE.*INTUB|INTUB.*GRAVE/.test(text)) return "GRAVE INTUBADO";
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

function canonicalBedSuffix(value = "") {
  const key = normalizeText(value).replace(/\s+/g, "");
  if (key === "TX" || key === "CIR") return "CX";
  if (key === "PEDS") return "PED";
  if (key === "GO") return "GYO";
  if (key === "HD") return "HEM";
  if (key === "UCIP") return "UTIP";
  return key;
}

function bedSuffixForService(service = "") {
  const key = normalizeService(service);
  if (key === "MEDICINA INTERNA") return "MI";
  if (key === "CIRUGIA Y TRAUMATOLOGIA") return "CX";
  if (key === "PEDIATRIA") return "PED";
  if (key === "CUNEROS") return "CUN";
  if (key === "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES") return "UCIN";
  if (key === "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS") return "UTIP";
  if (key === "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS") return "UCIA";
  if (key === "GINECOLOGIA Y OBSTETRICIA") return "GYO";
  if (key === "HEMODIALISIS") return "HEM";
  if (key === "ONCOLOGIA") return "ONCO";
  if (key === "URGENCIAS") return "URG";
  return "";
}

function serviceFromBedSuffix(value = "") {
  const key = canonicalBedSuffix(value);
  if (key === "MI") return "MEDICINA INTERNA";
  if (key === "CX") return "CIRUGIA Y TRAUMATOLOGIA";
  if (key === "PED") return "PEDIATRIA";
  if (key === "CUN") return "CUNEROS";
  if (key === "UCIN") return "UNIDAD DE CUIDADOS INTENSIVOS NEONATALES";
  if (key === "UTIP") return "UNIDAD DE CUIDADOS INTENSIVOS PEDIATRICOS";
  if (key === "UCIA") return "UNIDAD DE CUIDADOS INTENSIVOS ADULTOS";
  if (key === "GYO") return "GINECOLOGIA Y OBSTETRICIA";
  if (key === "HEM") return "HEMODIALISIS";
  if (key === "ONCO") return "ONCOLOGIA";
  if (key === "URG") return "URGENCIAS";
  return "";
}
