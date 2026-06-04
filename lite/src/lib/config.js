export const FIREBASE_VERSION = "10.12.4";

const REQUIRED_FIREBASE_KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId"
];

function rawFirebaseConfig() {
  return window.EPIVIDA_LITE_FIREBASE_CONFIG || window.EPIVIDA_FIREBASE_CONFIG || null;
}

function cleanConfig(config) {
  if (!config || typeof config !== "object") return null;
  return Object.fromEntries(REQUIRED_FIREBASE_KEYS.map(key => [key, String(config[key] || "").trim()]));
}

function missingConfigKeys(config) {
  if (!config) return REQUIRED_FIREBASE_KEYS;
  return REQUIRED_FIREBASE_KEYS.filter(key => {
    const value = String(config[key] || "").trim();
    return !value || value.includes("REEMPLAZAR") || value.includes("...");
  });
}

export function firebaseConfig() {
  const config = cleanConfig(rawFirebaseConfig());
  return missingConfigKeys(config).length ? null : config;
}

export function firebaseConfigStatus() {
  const raw = rawFirebaseConfig();
  const config = cleanConfig(raw);
  const missing = missingConfigKeys(config);
  return {
    configured: Boolean(raw),
    ready: missing.length === 0,
    projectId: config?.projectId || "",
    authDomain: config?.authDomain || "",
    missing
  };
}

export function appConfig() {
  const localTest = ["localhost", "127.0.0.1"].includes(location.hostname)
    && new URLSearchParams(location.search).get("epividaTest") === "1";
  return {
    requireAuth: window.EPIVIDA_LITE_REQUIRE_AUTH !== false,
    bootstrapEmails: (window.EPIVIDA_LITE_BOOTSTRAP_EMAILS || []).map(email => String(email).toLowerCase()),
    testMode: window.__EPIVIDA_LITE_TEST_MODE__ === true || localTest
  };
}

export function todayMexico() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}
