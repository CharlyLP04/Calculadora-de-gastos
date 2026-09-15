import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db, type Entry, type Prefs } from "./data";

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let unsubscribeSnapshot: Unsubscribe | null = null;

const DEFAULT_FIREBASE_CONFIG: FirebaseOptions = {
  apiKey: "AIzaSyAPNCEM2U0FzP_L4jl1x5EdbJAJvi4oPVE",
  authDomain: "mis-finanzas-af0aa.firebaseapp.com",
  projectId: "mis-finanzas-af0aa",
  storageBucket: "mis-finanzas-af0aa.firebasestorage.app",
  messagingSenderId: "44820766100",
  appId: "1:44820766100:web:6ef7836f766b2f78518381",
  measurementId: "G-459TG230FE",
};

export function resolveSyncKey(prefs?: Prefs, targetUid?: string | null): string | null {
  if (targetUid && targetUid.trim() && targetUid !== "guest") {
    return targetUid.trim();
  }

  const app = getFirebaseApp(prefs ? getStoredFirebaseConfig(prefs) : null);
  if (app) {
    try {
      const user = getAuth(app).currentUser;
      if (user?.uid) return user.uid;
    } catch {}
  }

  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("clara_current_uid");
    if (stored && stored !== "guest" && stored !== "null") {
      return stored;
    }
  }

  if (prefs?.syncToken?.trim()) return prefs.syncToken.trim();
  return null;
}

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
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
    };
  }

  return null;
}

export function getStoredFirebaseConfig(prefs?: Prefs): FirebaseOptions {
  if (prefs?.firebaseConfig) {
    try {
      return typeof prefs.firebaseConfig === "string"
        ? JSON.parse(prefs.firebaseConfig)
        : (prefs.firebaseConfig as FirebaseOptions);
    } catch {
      // Formato inválido
    }
  }

  const local = localStorage.getItem("clara_firebase_config");
  if (local) {
    try {
      return JSON.parse(local);
    } catch {
      // Formato inválido
    }
  }

  return getEnvConfig() || DEFAULT_FIREBASE_CONFIG;
}

export function getFirebaseApp(config?: FirebaseOptions | null): FirebaseApp | null {
  if (firebaseApp) return firebaseApp;
  const resolvedConfig = config || getStoredFirebaseConfig();
  if (!resolvedConfig || !resolvedConfig.apiKey || !resolvedConfig.projectId) {
    return null;
  }
  try {
    if (!getApps().length) {
      firebaseApp = initializeApp(resolvedConfig);
    } else {
      firebaseApp = getApps()[0];
    }
    return firebaseApp;
  } catch (error) {
    console.error("Error al inicializar Firebase App:", error);
    return null;
  }
}

export function initFirebase(config?: FirebaseOptions | null): Firestore | null {
  const app = getFirebaseApp(config);
  if (!app) return null;

  try {
    if (!firestoreDb) {
      firestoreDb = getFirestore(app);
    }
    return firestoreDb;
  } catch (error) {
    console.error("Error al inicializar Firebase Firestore:", error);
    return null;
  }
}

export function isFirebaseConfigured(prefs?: Prefs): boolean {
  return !!getStoredFirebaseConfig(prefs);
}

export async function syncWithFirestore(prefs?: Prefs): Promise<number> {
  const syncKey = resolveSyncKey(prefs);
  if (!syncKey) {
    // No user authenticated or valid sync token; do not sync
    return 0;
  }

  const firestore = firestoreDb || initFirebase(getStoredFirebaseConfig(prefs));
  if (!firestore) {
    throw new Error("Google Firebase no está configurado todavía.");
  }

  const entriesCol = collection(firestore, "clara_users", syncKey, "entries");

  // Sync user preferences (budget, categories) with user document in Firestore
  try {
    const userDocRef = doc(firestore, "clara_users", syncKey);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const cloudData = userDocSnap.data();
      if (cloudData) {
        const updatePayload: Partial<Prefs> = {};
        if (typeof cloudData.budget === "number") updatePayload.budget = cloudData.budget;
        if (Array.isArray(cloudData.customCategories)) updatePayload.customCategories = cloudData.customCategories;
        if (Object.keys(updatePayload).length > 0) {
          await db.prefs.update("main", updatePayload);
        }
      }
    } else if (prefs) {
      await setDoc(userDocRef, {
        budget: prefs.budget || 0,
        customCategories: prefs.customCategories || [],
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (err) {
    console.warn("No se pudieron sincronizar las preferencias de usuario:", err);
  }

  const remoteSnapshot = await getDocs(entriesCol);
  const remoteEntries = new Map<string, Entry>();
  remoteSnapshot.forEach((docSnap) => {
    const data = docSnap.data() as Entry;
    if (data && data.id) {
      remoteEntries.set(data.id, data);
    }
  });

  const localEntries = await db.entries.toArray();
  const localMap = new Map<string, Entry>();
  for (const entry of localEntries) {
    localMap.set(entry.id, entry);
  }

  const toUpload: Entry[] = [];
  const toDownload: Entry[] = [];

  for (const local of localEntries) {
    const remote = remoteEntries.get(local.id);
    if (!remote || local.updated > remote.updated) {
      toUpload.push(local);
    }
  }

  for (const [id, remote] of remoteEntries.entries()) {
    const local = localMap.get(id);
    if (!local || remote.updated > local.updated) {
      toDownload.push(remote);
    }
  }

  if (toUpload.length > 0) {
    const batchSize = 400;
    for (let i = 0; i < toUpload.length; i += batchSize) {
      const chunk = toUpload.slice(i, i + batchSize);
      const batch = writeBatch(firestore);
      for (const item of chunk) {
        const itemRef = doc(entriesCol, item.id);
        const cleanItem: Record<string, any> = {};
        for (const [key, value] of Object.entries(item)) {
          if (value !== undefined) cleanItem[key] = value;
        }
        batch.set(itemRef, cleanItem, { merge: true });
      }
      await batch.commit();
    }
  }

  if (toDownload.length > 0) {
    await db.transaction("rw", db.entries, async () => {
      for (const entry of toDownload) {
        await db.entries.put(entry);
      }
    });
  }

  await db.prefs.update("main", { lastSync: new Date().toISOString() });
  return toUpload.length + toDownload.length;
}

export function setupFirestoreRealtime(prefs?: Prefs, onUpdated?: () => void): () => void {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  const syncKey = resolveSyncKey(prefs);
  if (!syncKey) return () => {};

  const firestore = firestoreDb || initFirebase(getStoredFirebaseConfig(prefs));
  if (!firestore) return () => {};

  const entriesCol = collection(firestore, "clara_users", syncKey, "entries");

  unsubscribeSnapshot = onSnapshot(entriesCol, async (snapshot) => {
    let hasChanges = false;
    for (const change of snapshot.docChanges()) {
      if (change.type === "added" || change.type === "modified") {
        const remote = change.doc.data() as Entry;
        if (!remote || !remote.id) continue;
        const local = await db.entries.get(remote.id);
        if (!local || remote.updated > local.updated) {
          await db.entries.put(remote);
          hasChanges = true;
        }
      }
    }
    if (hasChanges && onUpdated) {
      onUpdated();
    }
  }, (err) => {
    console.warn("Firestore snapshot listener error:", err);
  });

  return () => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  };
}

export function stopFirestoreRealtime(): void {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
}

export async function clearCloudEntries(
  targetUidOrPrefs?: string | null | Prefs,
  optionalPrefs?: Prefs,
): Promise<number> {
  const targetUid = typeof targetUidOrPrefs === "string" ? targetUidOrPrefs : null;
  const prefs = typeof targetUidOrPrefs === "object" && targetUidOrPrefs !== null ? targetUidOrPrefs : optionalPrefs;

  const syncKey = resolveSyncKey(prefs, targetUid);
  if (!syncKey) {
    console.warn("clearCloudEntries: No se encontró identificador de usuario para borrar.");
    return 0;
  }

  const firestore = firestoreDb || initFirebase(getStoredFirebaseConfig(prefs));
  if (!firestore) {
    throw new Error("No se pudo conectar a Firebase Firestore.");
  }

  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  const entriesCol = collection(firestore, "clara_users", syncKey, "entries");
  const snapshot = await getDocs(entriesCol);
  const docs = snapshot.docs;
  if (!snapshot.empty) {
    const batchSize = 400;
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      const batch = writeBatch(firestore);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  }

  // Delete user prefs doc as well
  try {
    await deleteDoc(doc(firestore, "clara_users", syncKey));
  } catch (e) {
    console.warn("No se pudo borrar documento principal de usuario:", e);
  }

  return docs.length;
}
