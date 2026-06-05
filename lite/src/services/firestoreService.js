import { firebaseFirestoreRuntime } from "../lib/firebase.js";
import { stripUndefined } from "../lib/validators.js";

const readPromises = new Map();

function readOnce(key, loader) {
  if (!readPromises.has(key)) {
    readPromises.set(key, loader().finally(() => {
      readPromises.delete(key);
    }));
  }
  return readPromises.get(key);
}

function readKey(type, path, detail = "") {
  return `${type}:${path}:${detail}`;
}

export async function dbRuntime() {
  const runtime = await firebaseFirestoreRuntime();
  if (!runtime) throw new Error("Firestore no configurado.");
  return runtime;
}

export async function getDocData(path) {
  return readOnce(readKey("doc", path), async () => {
    const { fsMod, db } = await dbRuntime();
    const snap = await fsMod.getDoc(fsMod.doc(db, path));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  });
}

export async function listCollection(path, constraints = []) {
  const loader = async () => {
    const { fsMod, db } = await dbRuntime();
    const ref = fsMod.collection(db, path);
    const queryRef = constraints.length ? fsMod.query(ref, ...constraints) : ref;
    const snap = await fsMod.getDocs(queryRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };
  if (constraints.length) return loader();
  return readOnce(readKey("collection", path, String(constraints.length)), loader);
}

export async function listCollectionWhere(path, clauses = [], options = {}) {
  const key = readKey("where", path, JSON.stringify({ clauses, orderBy: options.orderBy || [], limit: options.limit || 0 }));
  return readOnce(key, async () => {
    const { fsMod, db } = await dbRuntime();
    const ref = fsMod.collection(db, path);
    const constraints = clauses.map(([field, operator, value]) => fsMod.where(field, operator, value));
    (options.orderBy || []).forEach(([field, direction = "asc"]) => {
      constraints.push(fsMod.orderBy(field, direction));
    });
    if (options.limit) constraints.push(fsMod.limit(options.limit));
    const queryRef = constraints.length ? fsMod.query(ref, ...constraints) : ref;
    const snap = await fsMod.getDocs(queryRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });
}

export async function setDocMerge(path, data) {
  const { fsMod, db } = await dbRuntime();
  await fsMod.setDoc(fsMod.doc(db, path), stripUndefined(data), { merge: true });
}

export async function addDocData(path, data) {
  const { fsMod, db } = await dbRuntime();
  const ref = await fsMod.addDoc(fsMod.collection(db, path), stripUndefined(data));
  return ref.id;
}

export async function whereEquals(field, value) {
  const { fsMod } = await dbRuntime();
  return fsMod.where(field, "==", value);
}

export async function orderBy(field, direction = "asc") {
  const { fsMod } = await dbRuntime();
  return fsMod.orderBy(field, direction);
}

export async function limitTo(count) {
  const { fsMod } = await dbRuntime();
  return fsMod.limit(count);
}
