import {
  initializeApp,
  getApps,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  getDocFromServer,
  query,
  limit,
  runTransaction,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  db,
  Database,
  defaults,
  validEntries,
  isSyncBlocked,
  getSyncGeneration,
  type Entry,
  type Prefs,
} from "./data";
import { activeProfile, cloudScope, registry, type Profile } from "./profiles";
let firebaseApp: FirebaseApp | null = null;
const DEFAULT_FIREBASE_CONFIG: FirebaseOptions = {
  apiKey: "AIzaSyAPNCEM2U0FzP_L4jl1x5EdbJAJvi4oPVE",
  authDomain: "mis-finanzas-af0aa.firebaseapp.com",
  projectId: "mis-finanzas-af0aa",
  storageBucket: "mis-finanzas-af0aa.firebasestorage.app",
  messagingSenderId: "44820766100",
  appId: "1:44820766100:web:6ef7836f766b2f78518381",
  measurementId: "G-459TG230FE",
};

function getEnvConfig(): FirebaseOptions | null {
  if (import.meta.env.VITE_FIREBASE_CONFIG) {
    try {
      return JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
    } catch {
      // Ignorar error de parsing
    }
  }

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (apiKey && projectId) {
    return {
      apiKey,
      authDomain:
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
        `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket:
        import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
        `${projectId}.appspot.com`,
      messagingSenderId:
        import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
    };
  }

  return null;
}

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp)
    firebaseApp =
      getApps()[0] || initializeApp(getEnvConfig() || DEFAULT_FIREBASE_CONFIG);
  return firebaseApp;
}
export const initFirebase = () => getFirestore(getFirebaseApp());
const clean = (value: Entry) =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));

async function requireScope() {
  if (isSyncBlocked())
    throw new Error("Sincronización pausada mientras se vacía el perfil.");
  const profile = await activeProfile();
  const scope = cloudScope(profile, getAuth(getFirebaseApp()).currentUser?.uid);
  if (!scope || !profile)
    throw new Error(
      "Conecta la cuenta Google vinculada a este perfil para sincronizar.",
    );
  return { ...scope, profile };
}
export async function syncWithFirestore(_prefs?: Prefs): Promise<number> {
  const generation = getSyncGeneration();
  const startedAt = new Date().toISOString();
  const { uid, profileId, profile } = await requireScope();
  const firestore = initFirebase();
  const root = doc(firestore, "clara_users", uid, "profiles", profileId);
  const entriesCol = collection(root, "entries");
  const assertCurrent = async () => {
    if (generation !== getSyncGeneration())
      throw new Error("La operación anterior se canceló al vaciar el perfil.");
    const scope = await requireScope();
    if (scope.uid !== uid || scope.profileId !== profileId)
      throw new Error("La sincronización se pausó.");
  };
  // Server reads and transactions fail offline: never label cached data as synced.
  const remoteSnapshot = await getDocsFromServer(entriesCol);
  await assertCurrent();
  const localEntries = await db.entries.toArray();
  const localMap = new Map(localEntries.map((e) => [e.id, e]));
  const ids = [
    ...new Set([...localMap.keys(), ...remoteSnapshot.docs.map((d) => d.id)]),
  ];
  let changes = 0;
  for (let offset = 0; offset < ids.length; offset += 100) {
    await assertCurrent();
    const chunk = ids.slice(offset, offset + 100);
    const result = await runTransaction(firestore, async (transaction) => {
      await assertCurrent();
      const snapshots = await Promise.all(
        chunk.map((id) => transaction.get(doc(entriesCol, id))),
      );
      const downloads: Entry[] = [];
      let uploads = 0;
      for (const snapshot of snapshots) {
        const local = localMap.get(snapshot.id);
        const remote = snapshot.exists()
          ? (snapshot.data() as Entry)
          : undefined;
        if (remote && (!validEntries([remote]) || remote.id !== snapshot.id))
          throw new Error(
            "Hay un registro no válido en la nube. Tus datos locales están intactos.",
          );
        if (local && (!remote || local.updated > remote.updated)) {
          transaction.set(snapshot.ref, clean(local));
          uploads++;
        } else if (remote && (!local || remote.updated > local.updated))
          downloads.push(remote);
      }
      return { downloads, uploads };
    });
    await assertCurrent();
    await db.transaction("rw", db.entries, async () => {
      for (const entry of result.downloads) {
        const current = await db.entries.get(entry.id);
        if (!current || entry.updated > current.updated)
          await db.entries.put(entry);
      }
    });
    changes += result.downloads.length + result.uploads;
  }
  await assertCurrent();
  const localPrefs = (await db.prefs.get("main")) || defaults;
  const prefsRef = doc(root, "preferences", "main");
  const remotePrefs = await runTransaction(firestore, async (transaction) => {
    await assertCurrent();
    const [meta, snapshot] = await Promise.all([
      transaction.get(root),
      transaction.get(prefsRef),
    ]);
    const remote = snapshot.exists() ? snapshot.data() : undefined;
    if (remote && !validCloudPreferences(remote))
      throw new Error("Las preferencias de la nube no son válidas.");
    if (!meta.exists())
      transaction.set(root, { name: profile.name, created: profile.created });
    if (!remote || (localPrefs.prefsUpdated || 0) > remote.updated) {
      transaction.set(prefsRef, {
        budget: localPrefs.budget,
        customCategories:
          localPrefs.customCategories || defaults.customCategories,
        updated: localPrefs.prefsUpdated || 0,
      });
      return undefined;
    }
    return remote;
  });
  await assertCurrent();
  await db.transaction("rw", db.prefs, async () => {
    const current = (await db.prefs.get("main")) || defaults;
    if (remotePrefs && remotePrefs.updated > (current.prefsUpdated || 0)) {
      await db.prefs.put({
        ...current,
        budget: remotePrefs.budget,
        customCategories: remotePrefs.customCategories,
        prefsUpdated: remotePrefs.updated,
      });
    }
    await db.prefs.update("main", { lastSync: startedAt });
  });
  return changes;
}
export function validCloudPreferences(
  value: any,
): value is { budget: number; customCategories: string[]; updated: number } {
  return (
    value &&
    Number.isFinite(value.budget) &&
    value.budget >= 0 &&
    value.budget <= 1e12 &&
    Number.isFinite(value.updated) &&
    value.updated >= 0 &&
    Array.isArray(value.customCategories) &&
    value.customCategories.length <= 100 &&
    value.customCategories.every(
      (c: unknown) => typeof c === "string" && c.length > 0 && c.length <= 80,
    )
  );
}
export interface CloudProfile {
  id: string;
  uid: string;
  name: string;
  created: number;
  legacy?: boolean;
}
export async function listCloudProfiles(): Promise<CloudProfile[]> {
  const uid = getAuth(getFirebaseApp()).currentUser?.uid;
  if (!uid) throw new Error("Inicia sesión con Google.");
  const firestore = initFirebase();
  const snapshots = await getDocsFromServer(
    collection(firestore, "clara_users", uid, "profiles"),
  );
  const profiles = snapshots.docs
    .filter((d) => typeof d.data().name === "string")
    .map((d) => ({
      id: d.id,
      name: d.data().name as string,
      created: Number(d.data().created) || Date.now(),
    }));
  const legacy = await getDocsFromServer(
    query(collection(firestore, "clara_users", uid, "entries"), limit(1)),
  );
  const legacyPrefs = await getDocFromServer(
    doc(firestore, "clara_users", uid),
  );
  const recoveredLegacy = profiles.some((p) => p.id === "legacy-google");
  if ((!legacy.empty || legacyPrefs.exists()) && !recoveredLegacy)
    profiles.push({
      id: "legacy-google",
      name: "Datos anteriores de Google",
      created: 0,
    });
  if (getAuth(getFirebaseApp()).currentUser?.uid !== uid)
    throw new Error("La cuenta cambió. Vuelve a recuperar tus perfiles.");
  return profiles.map((p) => ({
    ...p,
    uid,
    legacy: p.id === "legacy-google" && !recoveredLegacy,
  }));
}
export async function recoverCloudProfile(
  cloud: CloudProfile,
): Promise<Profile> {
  const user = getAuth(getFirebaseApp()).currentUser;
  if (!user) throw new Error("Inicia sesión con Google.");
  if (user.uid !== cloud.uid)
    throw new Error("La cuenta cambió. Vuelve a recuperar tus perfiles.");
  const existing = await registry.profiles
    .where("googleUid")
    .equals(user.uid)
    .filter((p) => p.cloudId === cloud.id)
    .first();
  if (existing) {
    await registry.profiles.update(existing.id, { cloudEnabled: true });
    return existing;
  }
  const profile: Profile = {
    id: crypto.randomUUID(),
    name: cloud.name.slice(0, 40),
    created: cloud.created || Date.now(),
    googleUid: user.uid,
    googleEmail: user.email || "Cuenta Google",
    cloudId: cloud.id,
    cloudEnabled: true,
  };
  if (cloud.legacy) {
    // Explicit recovery into a NEW database. Never merge unknown old local data.
    const snapshot = await getDocsFromServer(
      collection(initFirebase(), "clara_users", user.uid, "entries"),
    );
    const entries = snapshot.docs.map((d) => d.data());
    const legacyPrefs = await getDocFromServer(
      doc(initFirebase(), "clara_users", user.uid),
    );
    if (!validEntries(entries))
      throw new Error("El respaldo anterior contiene datos no válidos.");
    if (getAuth(getFirebaseApp()).currentUser?.uid !== user.uid)
      throw new Error("La cuenta cambió. Vuelve a intentarlo.");
    const target = new Database(profile.id);
    try {
      await target.entries.bulkPut(entries);
      const previous = legacyPrefs.data();
      const prefs = {
        budget: previous?.budget ?? 0,
        customCategories:
          previous?.customCategories || defaults.customCategories,
        updated: Date.now(),
      };
      if (validCloudPreferences(prefs))
        await target.prefs.put({
          ...defaults,
          budget: prefs.budget,
          customCategories: prefs.customCategories,
          prefsUpdated: prefs.updated,
        });
    } finally {
      target.close();
    }
  }
  await registry.profiles.add(profile);
  return profile;
}

let pendingSync: Promise<number> | undefined;
export const waitForSyncIdle = async () => {
  await pendingSync?.catch(() => {});
};

export async function syncData(prefs?: Prefs): Promise<number> {
  if (isSyncBlocked()) throw new Error("La sincronización está pausada.");
  if (pendingSync) return pendingSync;
  pendingSync = syncWithFirestore(prefs);
  try {
    return await pendingSync;
  } finally {
    pendingSync = undefined;
  }
}
