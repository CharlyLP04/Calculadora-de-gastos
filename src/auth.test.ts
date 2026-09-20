import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  redirectCalls: 0,
  redirectUser: { uid: "ana", email: "ana@example.test" } as {
    uid: string;
    email: string | null;
  } | null,
  redirectFails: false,
}));
vi.mock("firebase/app", () => ({
  getApps: () => [{}],
  initializeApp: () => ({}),
}));
// auth.ts solo necesita la app de Firebase. Sin este mock, cada resetModules
// reevaluaría ./firebase -> ./data y abriría una base Dexie de verdad.
vi.mock("./firebase", () => ({ getFirebaseApp: () => ({}) }));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: null }),
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
  signInWithPopup: async () => ({ user: mock.redirectUser }),
  signInWithRedirect: async () => {},
  getRedirectResult: async () => {
    mock.redirectCalls++;
    if (mock.redirectFails) throw new Error("sin resultado");
    return mock.redirectUser ? { user: mock.redirectUser } : null;
  },
  signOut: async () => {},
  onAuthStateChanged: () => () => {},
}));

function stubBrowser(userAgent: string, standalone: boolean) {
  vi.stubGlobal("navigator", { userAgent, standalone: false });
  vi.stubGlobal("window", {
    navigator: { standalone: false },
    matchMedia: (queryText: string) => ({
      matches: standalone && queryText.includes("display-mode: standalone"),
    }),
  });
}

beforeEach(() => {
  mock.redirectCalls = 0;
  mock.redirectFails = false;
  mock.redirectUser = { uid: "ana", email: "ana@example.test" };
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Acceso con Google", () => {
  it("usa redirección en móvil y en la PWA instalada, no en una ventana angosta", async () => {
    const { isMobileOrStandalone } = await import("./auth");
    stubBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", false);
    expect(isMobileOrStandalone()).toBe(true);
    stubBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", true);
    expect(isMobileOrStandalone()).toBe(true);
    // Una ventana de escritorio angosta no debe forzar la redirección.
    stubBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", false);
    expect(isMobileOrStandalone()).toBe(false);
  });

  it("avisa que empezó una redirección en vez de fallar con un tiempo de espera", async () => {
    const { loginWithGoogle, isRedirectStarted } = await import("./auth");
    stubBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile", false);
    const error = await loginWithGoogle().catch((e) => e);
    expect(isRedirectStarted(error)).toBe(true);
    expect(isRedirectStarted(new Error("otra cosa"))).toBe(false);
    expect(isRedirectStarted(null)).toBe(false);
  });

  it("entrega el mismo resultado de redirección a todos los que lo consultan", async () => {
    const { handleAuthRedirectResult } = await import("./auth");
    stubBrowser("Mozilla/5.0 (iPhone)", true);
    const [gate, app] = await Promise.all([
      handleAuthRedirectResult(),
      handleAuthRedirectResult(),
    ]);
    // La portada y la app consultan las dos; getRedirectResult solo responde
    // una vez por carga de página, así que el resultado se memoiza.
    expect(mock.redirectCalls).toBe(1);
    expect(gate?.uid).toBe("ana");
    expect(app?.uid).toBe("ana");
    expect(await handleAuthRedirectResult()).toBe(gate);
    expect(mock.redirectCalls).toBe(1);
  });

  it("devuelve null y no revienta si la redirección falló", async () => {
    mock.redirectFails = true;
    const { handleAuthRedirectResult } = await import("./auth");
    stubBrowser("Mozilla/5.0 (iPhone)", true);
    expect(await handleAuthRedirectResult()).toBeNull();
  });
});
