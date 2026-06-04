const ROUTE_ROLES = {
  login: ["admin_epidemiologia", "epidemiologia", "enfermeria", "lectura"],
  inicio: ["admin_epidemiologia", "epidemiologia", "lectura"],
  censo: ["admin_epidemiologia", "epidemiologia", "lectura"],
  expediente: ["admin_epidemiologia", "epidemiologia", "enfermeria"],
  "monitoreo-epidemiologico": ["admin_epidemiologia", "epidemiologia", "lectura"],
  "ronda-paquetes": ["admin_epidemiologia", "epidemiologia", "enfermeria"],
  "epi-iaas": ["admin_epidemiologia", "epidemiologia"],
  dispositivos: ["admin_epidemiologia", "epidemiologia", "enfermeria"],
  reportes: ["admin_epidemiologia", "epidemiologia", "lectura"],
  admin: ["admin_epidemiologia"]
};

const LEGACY_ROLE_MAP = {
  admin: "admin_epidemiologia",
  epidemiologia: "epidemiologia",
  enfermeria: "enfermeria",
  lectura: "lectura"
};

const ROUTE_ALIASES = {
  dashboard: "inicio",
  "censo-hospitalario": "censo",
  "importar-censo": "admin",
  pacientes: "expediente",
  ronda: "ronda-paquetes",
  "reporte-diario": "reportes",
  "seguimiento-iaas": "epi-iaas"
};

export function normalizeRole(role) {
  const clean = String(role || "").trim();
  return LEGACY_ROLE_MAP[clean] || clean || "lectura";
}

function canonicalRouteKey(route) {
  return ROUTE_ALIASES[route] || route;
}

export function canAccessRoute(route, role) {
  const normalized = normalizeRole(role);
  return (ROUTE_ROLES[canonicalRouteKey(route)] || []).includes(normalized);
}

export function canWrite(module, role) {
  const normalized = normalizeRole(role);
  const canonicalModule = canonicalRouteKey(module);
  if (normalized === "admin_epidemiologia") return true;
  if (canonicalModule === "ronda-paquetes" || canonicalModule === "dispositivos") return ["epidemiologia", "enfermeria"].includes(normalized);
  if (["censo", "monitoreo-epidemiologico", "epi-iaas"].includes(canonicalModule)) return normalized === "epidemiologia";
  return false;
}

export function activeProfile(profile) {
  return Boolean(profile && profile.active !== false);
}
