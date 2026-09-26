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
  // Una ventana de escritorio angosta NO es una PWA instalada: ahí el popup
  // funciona bien y evita el viaje de ida y vuelta de la redirección.
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true;
  return Boolean(isMobileUA || isStandalone);
}

// La cartera que esperaba vincularse cuando empezó la redirección. Sobrevive al
// viaje a Google porque la pestaña es la misma.
export const PENDING_LINK_KEY = "clara-pending-google-link";

export const REDIRECT_STARTED = "clara/redirect-started";
export class RedirectStartedError extends Error {
  code = REDIRECT_STARTED;
  constructor() {
    super("Te estamos llevando a Google. Vuelve a esta pantalla al terminar.");
    this.name = "RedirectStartedError";
  }
}
export const isRedirectStarted = (error: unknown) =>
  (error as { code?: string } | null)?.code === REDIRECT_STARTED;

// getRedirectResult solo entrega el resultado una vez por carga de página, y
// tanto la portada como la app lo consultan. Se memoiza para que ambos lean lo
// mismo y ninguno se quede con null.
let redirectResult: Promise<User | null> | null = null;
export function handleAuthRedirectResult(): Promise<User | null> {
  if (!redirectResult) {
    const auth = getFirebaseAuth();
    redirectResult = !auth
      ? Promise.resolve(null)
      : getRedirectResult(auth)
          .then((result) => result?.user ?? null)
          .catch((err) => {
            console.warn(
              "No se pudo obtener el resultado de redirección de Google:",
              err,
            );
            return null;
          });
  }
  return redirectResult;
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
    await signInWithRedirect(auth, provider);
    // La ventana ya navega hacia Google: esta llamada no puede devolver un
    // usuario. Quien la invoca debe dejar constancia de lo que estaba haciendo
    // y retomarlo con handleAuthRedirectResult al volver.
    throw new RedirectStartedError();
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

export function subscribeToAuth(
  callback: (user: User | null) => void,
): () => void {
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
