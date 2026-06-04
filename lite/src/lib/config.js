export const FIREBASE_VERSION = "10.12.4";

export function firebaseConfig() {
  return window.EPIVIDA_LITE_FIREBASE_CONFIG || window.EPIVIDA_FIREBASE_CONFIG || null;
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
