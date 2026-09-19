import { useEffect, useState, useRef, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowRight,
  Plus,
  Smartphone,
  Cloud,
  ChevronLeft,
  LoaderCircle,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { BrandMark } from "./Brand";
import {
  registry,
  initializeProfiles,
  createProfile,
  openProfile,
  renameProfile,
  deleteProfile,
  sessionProfileId,
} from "./profiles";
import { loginWithGoogle, handleAuthRedirectResult } from "./auth";
import {
  listCloudProfiles,
  recoverCloudProfile,
  type CloudProfile,
} from "./firebase";

function RenameProfileModal({
  profileName,
  busy,
  onClose,
  onSave,
}: {
  profileName: string;
  busy: boolean;
  onClose: () => void;
  onSave: (newName: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(profileName);

  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog sheet-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        maxWidth: "400px",
        width: "90%",
        padding: "24px",
      }}
    >
      <div className="sheet-grabber" aria-hidden="true" />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600 }}>
          Renombrar cartera
        </h3>
        <button
          type="button"
          className="icon-btn"
          aria-label="Cerrar"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed) {
            await onSave(trimmed);
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            fontSize: "14px",
          }}
        >
          Nuevo nombre:
          <input
            type="text"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </label>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="primary"
            disabled={busy || !name.trim()}
          >
            <Check size={16} /> Guardar
          </button>
        </div>
      </form>
    </dialog>
  );
}

function DeleteProfileModal({
  profileName,
  busy,
  onClose,
  onConfirm,
}: {
  profileName: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog sheet-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        maxWidth: "420px",
        width: "90%",
        padding: "24px",
      }}
    >
      <div className="sheet-grabber" aria-hidden="true" />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "12px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "1.2rem",
            fontWeight: 600,
            color: "#f87171",
          }}
        >
          ¿Eliminar «{profileName}»?
        </h3>
        <button
          type="button"
          className="icon-btn"
          aria-label="Cerrar"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <p
        style={{
          margin: 0,
          color: "var(--muted, #94a3b8)",
          fontSize: "0.95rem",
          lineHeight: 1.5,
        }}
      >
        Se eliminarán permanentemente todas las cuentas, deudas y movimientos
        asociados a esta cartera en este equipo.
      </p>
      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "flex-end",
          marginTop: "20px",
        }}
      >
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="danger-btn"
          disabled={busy}
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            color: "#f87171",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            minHeight: "44px",
            padding: "0 18px",
            borderRadius: "10px",
            fontWeight: 600,
            cursor: "pointer",
          }}
          onClick={onConfirm}
        >
          <Trash2 size={16} /> Eliminar cartera
        </button>
      </div>
    </dialog>
  );
}

export function Credits() {
  return (
    <footer className="maker-credit">
      <img
        src={`${import.meta.env.BASE_URL}grid-mx.png`}
        alt="Grid.mx · Pensamos en código. Creamos soluciones."
        width="900"
        height="409"
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

  // Estados para gestionar perfiles (renombrar y eliminar)
  const [editingProfile, setEditingProfile] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    initializeProfiles()
      .then(() => setReady(true))
      .catch(() =>
        setError(
          "No se pudo abrir el almacenamiento. Revisa los permisos del navegador y vuelve a cargar.",
        ),
      );

    // Revisar si volvimos de una redirección de autenticación de Google en móvil
    void handleAuthRedirectResult().then(async (user) => {
      if (user) {
        try {
          const cloudProfiles = await listCloudProfiles();
          setCloud(cloudProfiles);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron recuperar las carteras de Google.",
          );
        }
      }
    });

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
            Cada cartera mantiene tus movimientos separados.
            <br />
            Privado en tu equipo. Con Google opcional.
          </p>
        </div>
        <div className="welcome-wallet" aria-hidden="true">
          <span>Todo en su lugar</span>
          <BrandMark />
          <div className="wallet-line" />
          <div className="wallet-line short" />
          <span className="wallet-local">
            <Smartphone size={14} /> Primero en tu dispositivo
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
            <ChevronLeft size={16} /> Volver a mis carteras
          </button>
        )}
        <span className="eyebrow">CLARA · FINANZAS</span>
        <h2 id="profile-heading">
          {creating
            ? "Nueva cartera"
            : cloud !== null
              ? "Carteras en Google"
              : "Tus carteras"}
        </h2>
        <p className="profile-intro">
          {creating
            ? "Asigna un nombre para tus cuentas y movimientos en este equipo."
            : cloud !== null
              ? "Selecciona una cartera guardada en tu cuenta Google para usarla aquí."
              : "Selecciona una cartera para continuar o crea una nueva."}
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
              Nombre de la cartera
              <input
                name="name"
                maxLength={40}
                placeholder="Ej. Personal, Escuela o Negocio"
                required
                autoFocus
                autoComplete="off"
              />
            </label>
            <button className="primary full" disabled={busy}>
              {busy ? "Creando…" : "Crear cartera"}
              <ArrowRight size={18} />
            </button>
            <span className="local-caption">
              <Smartphone size={14} /> Sin cuenta obligatoria. Tus datos se guardan aquí.
            </span>
          </form>
        ) : cloud !== null ? (
          <div className="profile-list">
            {cloud.length === 0 && (
              <p className="field-help">
                No hay carteras guardadas en esta cuenta Google. Crea una local
                y podrás conectarla desde Configuración.
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
                      ? "Recuperar respaldo anterior"
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
                <div className="profile-item-card" key={p.id}>
                  <button
                    type="button"
                    className="profile-choice"
                    disabled={busy}
                    onClick={() => void run(() => openProfile(p.id))}
                  >
                    <span className="profile-monogram">
                      {p.name[0]?.toLocaleUpperCase() || "C"}
                    </span>
                    <span className="profile-meta-block">
                      <strong title={p.name}>{p.name}</strong>
                      <small title={p.googleEmail || undefined}>
                        {p.googleEmail
                          ? p.googleEmail
                          : p.googleUid
                            ? "Google conectado"
                            : "Solo en este dispositivo"}
                      </small>
                    </span>
                    <ArrowRight size={18} className="profile-arrow" />
                  </button>
                  <div className="profile-actions">
                    <button
                      type="button"
                      className="profile-action-btn"
                      aria-label={`Renombrar ${p.name}`}
                      title="Renombrar cartera"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProfile({ id: p.id, name: p.name });
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="profile-action-btn danger"
                      aria-label={`Eliminar ${p.name}`}
                      title="Eliminar cartera"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingProfile({ id: p.id, name: p.name });
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="primary full"
              disabled={busy || !ready}
              onClick={() => setCreating(true)}
            >
              <Plus size={18} /> Nueva cartera
            </button>

            <div className="profile-divider">
              <span>o sincroniza con la nube</span>
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
              {busy ? "Conectando…" : "Sincronizar con Google"}
            </button>
          </>
        )}

        {!online && (
          <p className="field-help">
            Estás sin conexión. Tus carteras locales siguen disponibles.
          </p>
        )}

        {error && (
          <p className="inline-notice" role="alert">
            {error}
          </p>
        )}

        {/* Modal para renombrar cartera */}
        {editingProfile && (
          <RenameProfileModal
            profileName={editingProfile.name}
            busy={busy}
            onClose={() => setEditingProfile(null)}
            onSave={async (trimmed) => {
              await run(async () => {
                await renameProfile(editingProfile.id, trimmed);
                setEditingProfile(null);
              });
            }}
          />
        )}

        {/* Modal de confirmación para eliminar cartera */}
        {deletingProfile && (
          <DeleteProfileModal
            profileName={deletingProfile.name}
            busy={busy}
            onClose={() => setDeletingProfile(null)}
            onConfirm={async () => {
              await run(async () => {
                await deleteProfile(deletingProfile.id);
                setDeletingProfile(null);
              });
            }}
          />
        )}

        <Credits />
      </section>
    </div>
  );
}
