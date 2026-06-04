import { nowIso } from "../lib/date.js";
import { addDocData } from "./firestoreService.js";

export async function writeAudit(app, payload) {
  const user = app?.state?.auth?.user;
  const profile = app?.state?.auth?.profile;
  return addDocData("audit_logs", {
    createdAt: nowIso(),
    userId: user?.uid || "",
    userEmail: user?.email || "",
    role: profile?.role || "",
    ...payload
  });
}
