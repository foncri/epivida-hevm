import { todayIso } from "../lib/date.js";
import { getDocData } from "./firestoreService.js";

export async function todaySnapshot() {
  try {
    return await getDocData(`daily_snapshots/${todayIso()}`);
  } catch {
    return null;
  }
}
