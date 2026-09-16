import { useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowRight,
  Plus,
  Smartphone,
  Cloud,
  ChevronLeft,
  LoaderCircle,
} from "lucide-react";
import { BrandMark } from "./Brand";
import {
  registry,
  initializeProfiles,
  createProfile,
  openProfile,
  sessionProfileId,
} from "./profiles";
import { loginWithGoogle } from "./auth";
import {
  listCloudProfiles,
  recoverCloudProfile,
  type CloudProfile,
} from "./firebase";

export function Credits() {
  return (
    <footer className="maker-credit">
      <span>
        Desarrollado por <strong>charly_dev</strong>
      </span>
      <img
        src={`${import.meta.env.BASE_URL}grid-mx.png`}
        alt="Grid.mx · Pensamos en código. Creamos soluciones."
        width="882"
        height="386"
      />
    </footer>
  );
}
export function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
export function ProfileGate({ children }: { children: ReactNode }) {
  const profiles = useLiveQuery(
    () => registry.profiles.orderBy("created").toArray(),
    [],
  );
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cloud, setCloud] = useState<CloudProfile[] | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    initializeProfiles()
      .then(() => setReady(true))
      .catch(() =>
        setError(
          "No se pudo abrir el almacenamiento. Revisa los permisos del navegador y vuelve a cargar.",
        ),
      );
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo completar. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (ready && profiles?.some((p) => p.id === sessionProfileId))
    return children;
  return (
    <div className="profile-gate">
      <div className="ambient-orb orb-one" aria-hidden="true" />
      <div className="ambient-orb orb-two" aria-hidden="true" />
      <section className="welcome-panel">
        <a
          href="#"
          className="welcome-brand"
          onClick={(e) => {
            e.preventDefault();
            setCloud(null);
            setCreating(false);
          }}
        >
          <BrandMark />
          <span>clara</span>
        </a>
        <div className="welcome-copy">
          <span className="eyebrow">UN POCO MÁS DE CALMA</span>
          <h1>
            Tu dinero.
            <br />
            <em>Tu espacio.</em>
          </h1>
          <p>
            Cada perfil tiene su propia cartera.
            <br />
            Empieza aquí. Llévala contigo cuando quieras.
          </p>
        </div>
        <div className="welcome-wallet" aria-hidden="true">
          <span>Todo en su lugar</span>
          <BrandMark />
          <div className="wallet-line" />
          <div className="wallet-line short" />
          <span className="wallet-local">
            <Smartphone size={14} /> Primero, en tu dispositivo
          </span>
        </div>
      </section>
      <section
        className="profile-panel glass-surface"
        aria-labelledby="profile-heading"
        aria-busy={busy}
      >
        {(creating || cloud !== null) && (
          <button
            className="text-button profile-back"
            disabled={busy}
            onClick={() => {
              setCreating(false);
              setCloud(null);
              setError("");
            }}
          >
            <ChevronLeft size={16} /> Volver
          </button>
        )}
        <span className="eyebrow">TU ESPACIO PERSONAL</span>
        <h2 id="profile-heading">
          {creating
            ? "Dale un nombre."
            : cloud !== null
              ? "Tu cartera, contigo."
              : "Elige tu perfil."}
        </h2>
        <p className="profile-intro">
          {creating
            ? "Sus movimientos y ajustes se guardarán por separado en este dispositivo."
            : cloud !== null
              ? "Elige el perfil de Google que quieres guardar también en este equipo."
              : "Tus finanzas se guardan aquí. Conectar Google es opcional."}
        </p>
        {(!ready || !profiles) && !error ? (
          <p className="loading-profiles" role="status">
            <LoaderCircle className="spin" size={20} /> Preparando tu espacio…
          </p>
        ) : creating ? (
          <form
            className="create-profile-form"
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(
                new FormData(e.currentTarget).get("name") || "",
              );
              void run(async () => {
                const profile = await createProfile(name);
                await openProfile(profile.id);
              });
            }}
          >
            <label>
              Nombre del perfil
              <input
                name="name"
                maxLength={40}
                placeholder="Por ejemplo, Charly"
                required
                autoFocus
                autoComplete="off"
              />
            </label>
            <button className="primary full" disabled={busy}>
              {busy ? "Creando…" : "Crear mi espacio"}
              <ArrowRight size={18} />
            </button>
            <span className="local-caption">
              <Smartphone size={14} /> Sin cuenta, sin conexión obligatoria.
            </span>
          </form>
        ) : cloud !== null ? (
          <div className="profile-list">
            {cloud.length === 0 && (
              <p className="field-help">
                Aún no tienes perfiles guardados en esta cuenta. Crea uno local
                y conecta Google desde Configuración.
              </p>
            )}
            {cloud.map((p) => (
              <button
                className="profile-choice"
                key={p.id}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const profile = await recoverCloudProfile(p);
                    await openProfile(profile.id);
                  })
                }
              >
                <span className="profile-monogram">
                  <Cloud size={20} />
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.legacy
                      ? "Recuperar en un perfil separado"
                      : "Guardar en este dispositivo"}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="profile-list">
              {profiles?.map((p) => (
                <button
                  className="profile-choice"
                  key={p.id}
                  disabled={busy}
                  onClick={() => void run(() => openProfile(p.id))}
                >
                  <span className="profile-monogram">
                    {p.name[0].toLocaleUpperCase()}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.googleUid
                        ? "Local · Google vinculado"
                        : "Solo en este dispositivo"}
                    </small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
            <button
              className="primary full"
              disabled={busy || !ready}
              onClick={() => setCreating(true)}
            >
              <Plus size={18} /> Crear perfil local
            </button>
            <div className="profile-divider">
              <span>¿Ya usas Clara en otro equipo?</span>
            </div>
            <button
              className="google-login-btn"
              disabled={busy || !online || !ready}
              onClick={() =>
                void run(async () => {
                  await loginWithGoogle();
                  setCloud(await listCloudProfiles());
                })
              }
            >
              <GoogleMark />
              {busy ? "Conectando…" : "Recuperar de Google"}
            </button>
          </>
        )}
        {!online && (
          <p className="field-help">
            Estás sin conexión. Tus perfiles locales siguen disponibles.
          </p>
        )}
        {error && (
          <p className="inline-notice" role="alert">
            {error}
          </p>
        )}
        <Credits />
      </section>
    </div>
  );
}
