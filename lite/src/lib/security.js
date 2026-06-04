const ROUTE_ROLES = {
  login: ["admin_epidemiologia", "epidemiologia", "enfermeria", "lectura"],
  inicio: ["admin_epidemiologia", "epidemiologia", "lectura"],
  censo: ["admin_epidemiologia", "epidemiologia", "lectura"],
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

export function normalizeRole(role) {
  const clean = String(role || "").trim();
  return LEGACY_ROLE_MAP[clean] || clean || "lectura";
}

export function canAccessRoute(route, role) {
  const normalized = normalizeRole(role);
  return (ROUTE_ROLES[route] || []).includes(normalized);
}

export function canWrite(module, role) {
  const normalized = normalizeRole(role);
  if (normalized === "admin_epidemiologia") return true;
  if (module === "ronda-paquetes" || module === "dispositivos") return ["epidemiologia", "enfermeria"].includes(normalized);
  if (["censo", "monitoreo-epidemiologico", "epi-iaas"].includes(module)) return normalized === "epidemiologia";
  return false;
}

export function activeProfile(profile) {
  return Boolean(profile && profile.active !== false);
}
