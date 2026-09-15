import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
  type Auth,
} from "firebase/auth";
import { getFirebaseApp } from "./firebase";

let authInstance: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  authInstance = getAuth(app);
  return authInstance;
}

export async function loginWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error("Google Firebase no está inicializado.");
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err: any) {
    if (
      err?.code === "auth/configuration-not-found" ||
      err?.code === "auth/operation-not-allowed"
    ) {
      throw new Error(
        "Debes habilitar Google en la consola de Firebase: Authentication → Método de acceso → Google → Habilitar."
      );
    }
    if (err?.code === "auth/popup-closed-by-user") {
      throw new Error("Inicio de sesión cancelado (ventana cerrada).");
    }
    if (err?.code === "auth/popup-blocked") {
      throw new Error("El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes.");
    }
    throw err;
  }
}

export async function logoutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  return auth ? auth.currentUser : null;
}
