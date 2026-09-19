import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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

export function isMobileOrStandalone(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;
  const ua = navigator.userAgent || "";
  const isMobileUA = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(max-width: 640px)").matches;
  return Boolean(isMobileUA || isStandalone);
}

export async function handleAuthRedirectResult(): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result ? result.user : null;
  } catch (err) {
    console.warn("No se pudo obtener el resultado de redirección de Google:", err);
    return null;
  }
}

export async function loginWithGoogle(forceRedirect = false): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error("Google Firebase no está inicializado.");
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  // En móviles o PWA standalone, popup se bloquea o pierde conexión con el opener.
  // Usar signInWithRedirect garantiza el flujo sin trabarse.
  if (forceRedirect || isMobileOrStandalone()) {
    try {
      await signInWithRedirect(auth, provider);
      // signInWithRedirect redirige la ventana; devolvemos una promesa que espera o se resuelve si ya hay usuario
      return new Promise<User>((_, reject) => {
        setTimeout(() => reject(new Error("Redirigiendo a Google...")), 3000);
      });
    } catch (err) {
      throw err;
    }
  }

  // En navegadores de escritorio: intentar popup con watchdog timeout de 15 segundos
  // para que NUNCA se quede colgado si el usuario cierra la ventana o el navegador bloquea.
  const popupPromise = signInWithPopup(auth, provider).then((res) => res.user);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          "El inicio de sesión tardó demasiado. Si tienes ventanas emergentes bloqueadas, permite popups o usa inicio directo.",
        ),
      );
    }, 18000);
  });

  try {
    const user = await Promise.race([popupPromise, timeoutPromise]);
    return user;
  } catch (err: any) {
    if (
      err?.code === "auth/configuration-not-found" ||
      err?.code === "auth/operation-not-allowed"
    ) {
      throw new Error(
        "Debes habilitar Google en la consola de Firebase: Authentication → Método de acceso → Google → Habilitar.",
      );
    }
    if (err?.code === "auth/popup-closed-by-user") {
      throw new Error("Inicio de sesión cancelado (ventana cerrada).");
    }
    if (err?.code === "auth/popup-blocked") {
      // Si el navegador bloqueó el popup en escritorio, redirigir automáticamente
      await signInWithRedirect(auth, provider);
      throw new Error("Ventana bloqueada. Redirigiendo a Google...");
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
