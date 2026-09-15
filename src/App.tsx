import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrandMark } from "./Brand";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Wallet,
  LayoutDashboard,
  CalendarDays,
  Plus,
  Landmark,
  ChartNoAxesCombined,
  Settings,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Download,
  Upload,
  X,
  Check,
  Utensils,
  Fuel,
  ShoppingBag,
  Pill,
  House,
  Wifi,
  Coffee,
  Receipt,
  CreditCard,
  Trash2,
  Pencil,
  LockKeyhole,
  RefreshCw,
  Gem,
  ChevronDown,
  Info,
  Search,
  TrendingUp,
  Smartphone,
  Delete,
  LogOut,
  LogIn,
  Sparkles,
  Bell,
} from "lucide-react";
import {
  db,
  defaults,
  today,
  money,
  round,
  daysInMonth,
  categories,
  defaultCategories,
  getCategories,
  summarize,
  debtRemaining,
  saveEntry,
  removeEntry,
  seedDemo,
  syncData,
  wipeAllData,
  type Entry,
  type Prefs,
  type Kind,
} from "./data";
import { exportReport, restoreBackup } from "./reports";
import { enableLock, unlock, disableLock, hasLock } from "./security";
import { loginWithGoogle, logoutUser, subscribeToAuth } from "./auth";
import { clearCloudEntries } from "./firebase";
import type { User } from "firebase/auth";
import { CategoryDonutChart, IncomeExpenseFlow } from "./components/Charts";

type Tab = "Inicio" | "Diario" | "Fijos" | "Balances";
const icons: Record<string, typeof Wallet> = {
  Comida: Utensils,
  Gasolina: Fuel,
  Despensa: ShoppingBag,
  Farmacia: Pill,
  Vivienda: House,
  Servicios: Wifi,
  Ocio: Coffee,
  Deuda: CreditCard,
};
function CategoryIcon({ category }: { category: string }) {
  const Icon = icons[category] || Receipt;
  return <Icon size={20} strokeWidth={1.6} />;
}
function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function playIosChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

export interface IosToastData {
  title?: string;
  message: string;
  time?: string;
  type?: "info" | "success" | "warning" | "payment";
}

function IosNotificationBanner({
  toast,
  onClose,
}: {
  toast: IosToastData;
  onClose: () => void;
}) {
  const [dismissing, setDismissing] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    playIosChime();
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate?.([30, 40, 30]);
      } catch {}
    }
  }, []);

  const handleDismiss = () => {
    setDismissing(true);
    setTimeout(onClose, 250);
  };

  return (
    <div
      className={`ios-banner ${dismissing ? "is-dismissing" : ""}`}
      role="status"
      onTouchStart={(e) => {
        startY.current = e.touches[0].clientY;
      }}
      onTouchMove={(e) => {
        if (startY.current - e.touches[0].clientY > 25) {
          handleDismiss();
        }
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(".ios-banner-close")) return;
        handleDismiss();
      }}
    >
      <div className="ios-banner-header">
        <div className="ios-banner-app">
          <div className="ios-banner-icon">
            <BrandMark />
          </div>
          <span className="ios-banner-title">{toast.title || "CLARA · FINANZAS"}</span>
        </div>
        <div className="ios-banner-meta">
          <span className="ios-banner-time">{toast.time || "ahora"}</span>
          <button
            type="button"
            className="ios-banner-close"
            aria-label="Cerrar aviso"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
          >
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="ios-banner-body">
        <p className="ios-banner-message">{toast.message}</p>
      </div>
      <div className="ios-banner-handle" />
    </div>
  );
}

function LoginScreen({
  onLoginWithGoogle,
  onContinueAsGuest,
  busy,
  online,
  toast,
  onDismissToast,
}: {
  onLoginWithGoogle: () => void;
  onContinueAsGuest: () => void;
  busy: boolean;
  online: boolean;
  toast?: IosToastData | null;
  onDismissToast?: () => void;
}) {
  return (
    <div className="login-screen-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">
            <BrandMark />
          </div>
          <h1 className="login-title">clara</h1>
          <p className="login-tagline">Finanzas personales claras y privadas</p>
        </div>

        <div className="login-features">
          <div className="login-feat-item">
            <span className="login-feat-dot" />
            <span>Control de tus gastos, cuentas y metas</span>
          </div>
          <div className="login-feat-item">
            <span className="login-feat-dot" />
            <span>100% privado y offline-first en tu dispositivo</span>
          </div>
          <div className="login-feat-item">
            <span className="login-feat-dot" />
            <span>Sincronización en la nube con Google</span>
          </div>
        </div>

        <div className="login-actions">
          <button
            type="button"
            className="google-login-btn primary full"
            style={{
              width: "100%",
              justifyContent: "center",
              padding: "12px 16px",
              fontSize: "15px",
            }}
            disabled={busy || !online}
            onClick={onLoginWithGoogle}
          >
            <svg className="google-icon-svg" viewBox="0 0 24 24">
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
            Continuar con Google
          </button>

          <button
            type="button"
            className="secondary full"
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: "14px",
              marginTop: "10px",
            }}
            disabled={busy}
            onClick={onContinueAsGuest}
          >
            Continuar como invitado (Modo local)
          </button>
        </div>

        <p className="login-footnote">
          En modo invitado tus datos se guardan exclusivamente en este dispositivo.
        </p>

        {toast && (
          <IosNotificationBanner
            toast={toast}
            onClose={onDismissToast || (() => {})}
          />
        )}
      </div>
    </div>
  );
}
function DateStrip({
  month,
  date,
  entries,
  budget,
  onSelectDate,
  dateStripRef,
}: {
  month: string;
  date: string;
  entries: Entry[];
  budget: number;
  onSelectDate: (d: string) => void;
  dateStripRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const hasDragged = useRef(false);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);
  const momentumRaf = useRef<number | null>(null);

  const stopMomentum = () => {
    if (momentumRaf.current !== null) {
      cancelAnimationFrame(momentumRaf.current);
      momentumRaf.current = null;
    }
  };

  // Auto-center selected date when date or month changes
  useEffect(() => {
    const el = dateStripRef.current;
    if (!el) return;
    const selected = el.querySelector(
      `button[data-day="${date}"]`,
    ) as HTMLElement | null;
    if (selected) {
      const targetLeft =
        selected.offsetLeft -
        el.offsetLeft -
        el.clientWidth / 2 +
        selected.clientWidth / 2;
      el.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    }
  }, [date, month, dateStripRef]);

  // Convert mouse wheel vertically to horizontal scroll
  useEffect(() => {
    const el = dateStripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) || e.deltaY !== 0) {
        e.preventDefault();
        stopMomentum();
        el.scrollBy({ left: e.deltaY * 1.3, behavior: "smooth" });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [dateStripRef]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = dateStripRef.current;
    if (!el) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;

    stopMomentum();
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastTime.current = performance.now();
    velocity.current = 0;
    scrollLeftStart.current = el.scrollLeft;

    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    el.classList.add("is-dragging");
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = dateStripRef.current;
    if (!isDragging.current || !el) return;

    const now = performance.now();
    const dt = Math.max(1, now - lastTime.current);
    const dx = e.clientX - lastX.current;

    velocity.current = dx / dt;
    lastX.current = e.clientX;
    lastTime.current = now;

    const totalWalk = e.clientX - startX.current;
    if (Math.abs(totalWalk) > 5) {
      hasDragged.current = true;
    }

    el.scrollLeft = scrollLeftStart.current - totalWalk;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const el = dateStripRef.current;
    if (!el) return;

    try {
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    el.classList.remove("is-dragging");

    // Carousel inertia / momentum glide
    let v = velocity.current * 16;
    if (Math.abs(v) > 40) v = Math.sign(v) * 40;

    if (Math.abs(v) > 1.2) {
      const stepGlide = () => {
        if (!dateStripRef.current) return;
        dateStripRef.current.scrollLeft -= v;
        v *= 0.93; // carousel deceleration
        if (Math.abs(v) > 0.6) {
          momentumRaf.current = requestAnimationFrame(stepGlide);
        } else {
          momentumRaf.current = null;
        }
      };
      momentumRaf.current = requestAnimationFrame(stepGlide);
    }
  };

  const daysCount = daysInMonth(month);

  return (
    <div
      ref={dateStripRef}
      className="date-strip"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {Array.from({ length: daysCount }, (_, i) => {
        const day = month + "-" + String(i + 1).padStart(2, "0");
        const ds = summarize(entries, month, day, budget);
        const isSelected = day === date;

        return (
          <button
            type="button"
            data-day={day}
            className={isSelected ? "selected" : ""}
            key={day}
            onClick={() => {
              if (!hasDragged.current) {
                onSelectDate(day);
              }
            }}
          >
            <span>
              {new Date(day + "T12:00:00").toLocaleDateString("es-MX", {
                weekday: "short",
              })}
            </span>
            <strong>{String(i + 1).padStart(2, "0")}</strong>
            <i
              className={
                ds.dayTx.length
                  ? ds.dayExpense > ds.allowance
                    ? "red-dot"
                    : "green-dot"
                  : ""
              }
            />
          </button>
        );
      })}
    </div>
  );
}
export default function App() {
  const entries = useLiveQuery(() => db.entries.toArray(), []) || [];
  const prefs = useLiveQuery(() => db.prefs.get("main"), []) || defaults;
  const [tab, setTab] = useState<Tab>("Inicio"),
    [date, setDate] = useState(today()),
    [online, setOnline] = useState(navigator.onLine),
    [toast, setToast] = useState<IosToastData | null>(null),
    [notificationPermission, setNotificationPermission] = useState<string>(
      () =>
        typeof window !== "undefined" && "Notification" in window
          ? Notification.permission
          : "default",
    ),
    [settings, setSettings] = useState(false),
    [form, setForm] = useState<{
      kind: Kind;
      entry?: Entry;
      debt?: Entry;
    } | null>(null),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [locked, setLocked] = useState(hasLock),
    [update, setUpdate] = useState(false),
    [install, setInstall] = useState<any>(null),
    [simDebt, setSimDebt] = useState<Entry | null>(null),
    [extra, setExtra] = useState("500"),
    [currentUser, setCurrentUser] = useState<User | null>(null),
    [isGuest, setIsGuest] = useState<boolean>(
      () => localStorage.getItem("clara_guest_mode") === "true",
    ),
    [authChecking, setAuthChecking] = useState(true),
    [checkingUpdate, setCheckingUpdate] = useState(false);
  const dateStripRef = useRef<HTMLDivElement>(null);

  const handleCheckUpdate = async () => {
    if (!online) {
      notify("Estás sin conexión a internet.");
      return;
    }
    setCheckingUpdate(true);
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();

          if (reg.waiting) {
            notify("¡Nueva versión lista! Actualizando aplicación…");
            window.dispatchEvent(new Event("pwa-apply-update"));
            return;
          }

          if (reg.installing) {
            notify("Descargando actualización en segundo plano…");
            reg.installing.addEventListener("statechange", function () {
              if (this.state === "installed") {
                window.dispatchEvent(new Event("pwa-apply-update"));
              }
            });
            return;
          }
        }
      }

      try {
        await fetch(`/?_t=${Date.now()}`, { method: "HEAD", cache: "no-store" });
      } catch {}

      await new Promise((r) => setTimeout(r, 650));
      notify("✅ Tienes la versión más reciente de Clara.");
    } catch (e) {
      console.warn("Error al buscar actualizaciones:", e);
      notify("✅ Tu aplicación está al día.");
    } finally {
      setCheckingUpdate(false);
    }
  };

  useEffect(() => {
    return subscribeToAuth(async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsGuest(false);
        localStorage.setItem("clara_guest_mode", "false");
        const prevUid = localStorage.getItem("clara_current_uid");
        if (prevUid && prevUid !== "guest" && prevUid !== user.uid) {
          // Switched to a different Google account: clear local database to prevent cross-contamination
          await db.entries.clear();
          await db.prefs.put({ ...defaults, id: "main" });
        }
        localStorage.setItem("clara_current_uid", user.uid);
        void syncData(prefs).catch(() => {});
      } else {
        // User logged out
        const prevUid = localStorage.getItem("clara_current_uid");
        if (prevUid && prevUid !== "guest") {
          await db.entries.clear();
          await db.prefs.put({ ...defaults, id: "main" });
          localStorage.removeItem("clara_current_uid");
        }
      }
      setAuthChecking(false);
    });
  }, [prefs]);
  const month = date.slice(0, 7),
    live = entries.filter((e) => !e.deleted),
    s = summarize(entries, month, date, prefs.budget),
    fixed = live.filter((e) => e.kind === "fixed"),
    debts = live.filter((e) => e.kind === "debt"),
    accounts = live.filter((e) => e.kind === "account");
  const fmt = (n: number) => (prefs.hidden ? "$ ••••••" : money(n));
  const notify = (
    message: string,
    title?: string,
    type?: "info" | "success" | "warning" | "payment",
  ) => {
    setToast({
      title: title || "CLARA · FINANZAS",
      message,
      time: "ahora",
      type: type || "info",
    });
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title || "Clara · Finanzas", {
          body: message,
          icon: "/icon-192.png",
        });
      } catch {}
    }
  };
  const run = async (action: () => Promise<unknown>, message?: string) => {
    try {
      await action();
      if (message) notify(message);
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "No se pudo completar la acción.",
      );
    }
  };
  const savePrefs = async (change: Partial<Prefs>) => {
    await db.prefs.put({ ...prefs, ...change });
    if (currentUser) {
      import("./firebase")
        .then(async ({ getFirebaseApp }) => {
          const { getFirestore, doc, setDoc } = await import("firebase/firestore");
          const app = getFirebaseApp();
          if (app) {
            const firestore = getFirestore(app);
            const updatePayload: Record<string, any> = { updatedAt: new Date().toISOString() };
            if (change.budget !== undefined) updatePayload.budget = change.budget;
            if (change.customCategories !== undefined) updatePayload.customCategories = change.customCategories;
            await setDoc(doc(firestore, "clara_users", currentUser.uid), updatePayload, { merge: true }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  };
  const availableCategories = getCategories(prefs);
  const handleAddCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (
      availableCategories.some(
        (c) => c.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      notify("Esa categoría ya existe");
      return;
    }
    const updated = [...availableCategories, trimmed];
    await savePrefs({ customCategories: updated });
    notify(`Categoría “${trimmed}” agregada`);
  };
  const handleDeleteCategory = async (name: string) => {
    if (availableCategories.length <= 1) {
      notify("Debes tener al menos una categoría");
      return;
    }
    const updated = availableCategories.filter((c) => c !== name);
    await savePrefs({ customCategories: updated });
    notify(`Categoría “${name}” eliminada`);
  };
  const handleLogout = async () => {
    setBusy(true);
    try {
      await logoutUser();
      await db.entries.clear();
      await db.prefs.put({ ...defaults, id: "main" });
      localStorage.removeItem("clara_current_uid");
      localStorage.removeItem("clara_guest_mode");
      setCurrentUser(null);
      setIsGuest(false);
      setSettings(false);
      notify("Sesión cerrada correctamente.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error al cerrar sesión.");
    } finally {
      setBusy(false);
    }
  };
  const handleWipeAllData = async () => {
    if (
      !confirm(
        "⚠️ ¿Estás seguro de restablecer desde cero?\n\nEsta acción borrará permanentemente todos tus movimientos, gastos fijos, cuentas, deudas y configuraciones tanto de este equipo como de la nube.\n\nEsta acción NO se puede deshacer.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await clearCloudEntries(prefs).catch(() => {});
      await wipeAllData();
      await logoutUser().catch(() => {});
      setCurrentUser(null);
      setIsGuest(false);
      localStorage.removeItem("clara_guest_mode");
      localStorage.removeItem("clara_current_uid");
      localStorage.removeItem("clara_device_sync_id");
      setSettings(false);
      notify("Todos los datos han sido restablecidos desde cero.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Error al restablecer datos.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void db.prefs
      .get("main")
      .then((p) => {
        if (!p) return db.prefs.put(defaults);
      })
      .catch(() =>
        notify(
          "No se pudo abrir el almacenamiento local. Revisa los permisos del navegador.",
        ),
      );
    const on = () => setOnline(true),
      off = () => setOnline(false),
      up = () => setUpdate(true),
      prompt = (e: Event) => {
        e.preventDefault();
        setInstall(e);
      };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("pwa-update", up);
    window.addEventListener("beforeinstallprompt", prompt);
    const visibility = () => {
      if (document.hidden && hasLock()) setLocked(true);
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("pwa-update", up);
      window.removeEventListener("beforeinstallprompt", prompt);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const canSync = Boolean(
    currentUser &&
      online &&
      (prefs.firebaseConfig ||
        localStorage.getItem("clara_firebase_config") ||
        import.meta.env.VITE_FIREBASE_CONFIG ||
        (import.meta.env.VITE_FIREBASE_API_KEY &&
          import.meta.env.VITE_FIREBASE_PROJECT_ID)),
  );
  useEffect(() => {
    if (!online || !canSync || locked) return;
    const t = setTimeout(() => {
      void syncData(prefs).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [online, canSync, prefs, entries, locked]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
  useEffect(() => {
    if (!online || !canSync || locked) return;
    const timer = setInterval(() => {
      void syncData(prefs).catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [online, canSync, prefs, locked]);
  useEffect(() => {
    if (!online || locked || !currentUser) return;
    let cleanup: (() => void) | undefined;
    import("./firebase")
      .then(({ isFirebaseConfigured, setupFirestoreRealtime }) => {
        if (isFirebaseConfigured(prefs)) {
          cleanup = setupFirestoreRealtime(prefs);
        }
      })
      .catch(() => {});
    return () => {
      if (cleanup) cleanup();
    };
  }, [online, prefs.firebaseConfig, prefs.syncToken, locked, currentUser]);
  const changeMonth = (value: string) => {
    if (/^\d{4}-\d{2}$/.test(value)) setDate(value + "-01");
  };
  const transactions = (tab === "Diario" ? s.dayTx : s.tx)
    .filter((e) =>
      `${e.title} ${e.category} ${e.account}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.updated - a.updated);
  const deleteItem = (e: Entry) => {
    if (
      confirm(
        `¿Eliminar “${e.title}”?${e.kind === "debt" ? " Los pagos realizados se conservarán." : ""}`,
      )
    )
      void run(() => removeEntry(e), "Registro eliminado");
  };
  const renderTx = (list: Entry[]) =>
    list.length ? (
      <div className="transactions">
        {list.map((e) => (
          <div className="transaction" key={e.id}>
            <div
              className={`category-icon ${e.direction === "income" ? "income" : ""}`}
            >
              {e.direction === "income" ? (
                <ArrowDownLeft size={20} />
              ) : (
                <CategoryIcon category={e.category} />
              )}
            </div>
            <button
              className="transaction-label"
              onClick={() => setForm({ kind: "transaction", entry: e })}
            >
              <strong>{e.title}</strong>
              <span>
                {e.category} <i>·</i> {e.account || "Sin cuenta"} <i>·</i>{" "}
                {e.date.slice(8)}/{e.date.slice(5, 7)}
              </span>
            </button>
            <strong className={e.direction === "income" ? "positive" : ""}>
              {e.direction === "income" ? "+" : "−"}
              {fmt(e.amount)}
            </strong>
            <button
              className="icon-btn delete-tx"
              aria-label={`Eliminar ${e.title}`}
              onClick={() => deleteItem(e)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    ) : (
      <div className="empty">
        <Receipt size={28} />
        <h3>
          {search ? "Sin coincidencias" : "Todo empieza con un movimiento"}
        </h3>
        <p>
          {search
            ? "Prueba con otro concepto o categoría."
            : "Registra un ingreso o un gasto para ver tu actividad aquí."}
        </p>
        <button
          className="text-button"
          onClick={() => setForm({ kind: "transaction" })}
        >
          <Plus size={16} /> Registrar movimiento
        </button>
      </div>
    );
  const nav = (mobile = false) => (
    <nav
      className={mobile ? "mobile-nav" : "side-nav"}
      aria-label="Navegación principal"
    >
      {(["Inicio", "Diario", "Añadir", "Fijos", "Balances"] as const).map(
        (label) => {
          const Icon = {
            Inicio: LayoutDashboard,
            Diario: CalendarDays,
            Añadir: Plus,
            Fijos: Landmark,
            Balances: ChartNoAxesCombined,
          }[label];
          return (
            <button
              key={label}
              aria-label={label}
              aria-current={label === tab ? "page" : undefined}
              className={`${label === tab ? "active" : ""} ${label === "Añadir" ? "add-nav" : ""}`}
              onClick={() => {
                if (label === "Añadir") setForm({ kind: "transaction" });
                else {
                  setTab(label);
                  setSearch("");
                }
              }}
            >
              <Icon size={mobile ? 20 : 20} />
              <span>{label}</span>
              {!mobile && label === tab && <span className="nav-mark" />}
            </button>
          );
        },
      )}
    </nav>
  );
  if (locked)
    return (
      <div className="lock-screen">
        <div className="brand-icon">
          <BrandMark />
        </div>
        <h1>Tu dinero es personal.</h1>
        <p>Desbloquea Clara para continuar.</p>
        <button
          className="primary"
          onClick={() =>
            void run(async () => {
              await unlock();
              setLocked(false);
            })
          }
        >
          <LockKeyhole size={18} /> Desbloquear
        </button>
        {toast && (
          <IosNotificationBanner
            toast={toast}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    );
  if (authChecking) {
    return (
      <div className="login-screen-wrap">
        <div className="login-brand-icon" style={{ animation: "pulse 1.5s infinite" }}>
          <BrandMark />
        </div>
      </div>
    );
  }
  if (!currentUser && !isGuest) {
    return (
      <LoginScreen
        onLoginWithGoogle={() => {
          setBusy(true);
          void run(
            async () => {
              const user = await loginWithGoogle();
              setCurrentUser(user);
              setIsGuest(false);
              localStorage.setItem("clara_guest_mode", "false");
            },
            "Sesión iniciada con Google",
          ).finally(() => setBusy(false));
        }}
        onContinueAsGuest={() => {
          setIsGuest(true);
          localStorage.setItem("clara_guest_mode", "true");
          localStorage.setItem("clara_current_uid", "guest");
          notify("Modo local activado: tus datos se guardarán en este equipo.");
        }}
        busy={busy}
        online={online}
        toast={toast}
        onDismissToast={() => setToast(null)}
      />
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("Inicio");
          }}
        >
          <span className="brand-icon">
            <BrandMark />
          </span>
          clara
        </a>

        {nav()}
        <div className="sidebar-bottom">
          <button className="settings-link" onClick={() => setSettings(true)}>
            <Settings size={18} /> Configuración <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="text-button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "var(--muted, #94a3b8)",
              padding: "4px 8px",
              margin: "2px 0 8px 0",
              width: "100%",
              textAlign: "left",
            }}
            onClick={handleCheckUpdate}
            disabled={checkingUpdate || !online}
            title="Buscar actualizaciones de la aplicación"
          >
            <RefreshCw size={13} className={checkingUpdate ? "spin" : ""} />
            <span>{checkingUpdate ? "Buscando…" : "Buscar actualizaciones"}</span>
          </button>
          <div className="profile" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Avatar"
                className="avatar"
                style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div className="avatar">
                {currentUser
                  ? (currentUser.displayName || currentUser.email || "U")[0].toUpperCase()
                  : "C"}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {currentUser
                  ? currentUser.displayName || currentUser.email
                  : isGuest
                    ? "Modo Local (Privado)"
                    : "Mi cuenta"}
              </strong>
              <span>
                {currentUser
                  ? "Conectado a Google"
                  : "Moneda · MXN"}
              </span>
            </div>
            {currentUser ? (
              <button
                type="button"
                className="icon-btn"
                title="Cerrar sesión de Google"
                style={{ marginLeft: "auto", flexShrink: 0, color: "#ef4444" }}
                onClick={() => {
                  if (confirm("¿Cerrar sesión de Google?")) {
                    void handleLogout();
                  }
                }}
              >
                <LogOut size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="icon-btn"
                title="Iniciar sesión con Google"
                style={{ marginLeft: "auto", flexShrink: 0, color: "var(--accent, #38bdf8)" }}
                onClick={() => setSettings(true)}
              >
                <LogIn size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span className="mobile-brand">
            <BrandMark /> clara
          </span>
          <div className={`connection ${online ? "" : "offline"}`}>
            {online ? <Cloud size={14} /> : <CloudOff size={14} />}
            <span>
              {online
                ? "Guardado en tu dispositivo"
                : "Sin conexión · guardado local"}
            </span>
          </div>
          <div className="top-actions">
            <label className="month-picker">
              <CalendarDays size={16} />
              <input
                aria-label="Mes del resumen"
                type="month"
                value={month}
                onChange={(e) => changeMonth(e.target.value)}
              />
              <ChevronDown size={14} />
            </label>
            {currentUser ? (
              <button
                className="icon-btn"
                title={`Sesión de ${currentUser.email}. Toca para cerrar sesión.`}
                onClick={() => {
                  if (confirm(`¿Cerrar sesión de Google (${currentUser.email})?`)) {
                    void handleLogout();
                  }
                }}
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Avatar"
                    style={{ width: "22px", height: "22px", borderRadius: "50%", objectFit: "cover" }}
                  />
                ) : (
                  <LogOut size={18} style={{ color: "#ef4444" }} />
                )}
              </button>
            ) : (
              <button
                className="icon-btn"
                title="Iniciar sesión con Google"
                onClick={() => setSettings(true)}
              >
                <LogIn size={18} />
              </button>
            )}
            <button
              className="icon-btn"
              aria-label="Configuración"
              onClick={() => setSettings(true)}
            >
              <Settings size={20} />
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <h1>
                {tab === "Inicio"
                  ? "Tu dinero."
                  : tab === "Diario"
                    ? "Tu día."
                    : tab === "Fijos"
                      ? "Tu plan."
                      : "Tu balance."}
              </h1>
            </div>
            <button
              className="primary desktop-add"
              onClick={() => setForm({ kind: "transaction" })}
            >
              <Plus size={18} /> Nuevo movimiento
            </button>
          </div>
          {update && (
            <div className="banner">
              <Info size={18} />
              Nueva versión disponible.{" "}
              <button
                className="text-button"
                onClick={() =>
                  window.dispatchEvent(new Event("pwa-apply-update"))
                }
              >
                Actualizar ahora <ArrowRight size={14} />
              </button>
            </div>
          )}
          {tab === "Inicio" && (
            <>
              <div className="overview-grid">
                <section className="hero-card">
                  <div className="section-row">
                    <span>
                      <Wallet size={18} /> Balance del mes
                    </span>
                    <button
                      className="icon-btn"
                      aria-label={
                        prefs.hidden ? "Mostrar cifras" : "Ocultar cifras"
                      }
                      onClick={() => void savePrefs({ hidden: !prefs.hidden })}
                    >
                      {prefs.hidden ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <div className="hero-amount">
                    {fmt(s.balance)}
                    <span>MXN</span>
                  </div>

                  <div className="hero-stats">
                    <div>
                      <span>
                        <ArrowDownLeft size={15} /> Ingresos
                      </span>
                      <strong className="positive">{fmt(s.income)}</strong>
                    </div>
                    <div>
                      <span>
                        <ArrowUpRight size={15} /> Gastos
                      </span>
                      <strong>{fmt(s.expense)}</strong>
                    </div>
                    <div>
                      <span>
                        <Wallet size={15} /> Presupuesto
                      </span>
                      <button onClick={() => setSettings(true)}>
                        {fmt(prefs.budget)} <Pencil size={12} />
                      </button>
                    </div>
                  </div>
                </section>
                <section className="card daily-card">
                  <div className="section-row">
                    <h3>
                      <span className="small-icon">
                        <CalendarDays size={18} />
                      </span>
                      Para hoy
                    </h3>
                    <span className="pill">
                      {date === today()
                        ? "Hoy"
                        : date.slice(8) + "/" + date.slice(5, 7)}
                    </span>
                  </div>
                  <p className="muted">Límite variable sugerido</p>
                  <div className="daily-amount">
                    {fmt(s.allowance)}
                    <span>/ día</span>
                  </div>
                  <Progress
                    value={
                      s.allowance
                        ? (s.dayExpense / s.allowance) * 100
                        : s.dayExpense
                          ? 100
                          : 0
                    }
                  />
                  <div className="budget-caption">
                    <span>{fmt(s.dayExpense)} gastados</span>
                    <span>
                      {s.allowance
                        ? Math.round((s.dayExpense / s.allowance) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div
                    className={`daily-result ${s.allowance >= s.dayExpense ? "positive" : "negative"}`}
                  >
                    <TrendingUp size={16} />
                    {fmt(Math.abs(s.allowance - s.dayExpense))}{" "}
                    {s.allowance >= s.dayExpense
                      ? "disponibles para este día"
                      : "por encima del límite"}
                  </div>
                  {!prefs.budget && (
                    <button
                      className="text-button"
                      onClick={() => setSettings(true)}
                    >
                      Define tu presupuesto <ArrowRight size={14} />
                    </button>
                  )}
                </section>
              </div>
              <div className="detail-grid">
                <div>
                  <section className="card accounts-card">
                    <div className="section-row">
                      <h2>Tus cuentas</h2>
                      <button
                        className="text-button"
                        onClick={() => setForm({ kind: "account" })}
                      >
                        <Plus size={16} /> Cuenta
                      </button>
                    </div>
                    <div className="account-grid">
                      {accounts.length ? (
                        accounts.map((a, i) => {
                          const balance =
                            a.amount +
                            live
                              .filter(
                                (t) =>
                                  t.kind === "transaction" &&
                                  t.account === a.title,
                              )
                              .reduce(
                                (v, t) =>
                                  v +
                                  (t.direction === "income"
                                    ? t.amount
                                    : -t.amount),
                                0,
                              );
                          return (
                            <button
                              className="account"
                              key={a.id}
                              onClick={() =>
                                setForm({ kind: "account", entry: a })
                              }
                            >
                              <span className="account-top">
                                <CreditCard size={19} />
                                <span>0{i + 1}</span>
                              </span>
                              <span>{a.title}</span>
                              <strong>{fmt(balance)}</strong>
                            </button>
                          );
                        })
                      ) : (
                        <button
                          className="empty-account"
                          onClick={() => setForm({ kind: "account" })}
                        >
                          <Wallet size={24} />
                          <span>Añade tu primera cuenta</span>
                          <Plus size={18} />
                        </button>
                      )}
                    </div>
                  </section>
                  <section className="card movements-card">
                    <div className="section-row">
                      <h2>
                        Actividad reciente{" "}
                        <span className="count">{s.tx.length}</span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => setTab("Balances")}
                      >
                        Ver todos <ArrowRight size={14} />
                      </button>
                    </div>
                    {renderTx(transactions.slice(0, 4))}
                    {transactions.length > 0 && (
                      <button
                        className="register-row"
                        onClick={() => setForm({ kind: "transaction" })}
                      >
                        <Plus size={16} /> Registrar un movimiento
                      </button>
                    )}
                  </section>
                </div>
                <div>
                  <section className="card commitments">
                    <div className="section-row">
                      <h2>Este mes</h2>
                      <Landmark size={18} />
                    </div>
                    <div className="commitment-row">
                      <span className="category-icon">
                        <House size={19} />
                      </span>
                      <div>
                        <strong>Gastos fijos</strong>
                        <span>{fixed.length} compromisos mensuales</span>
                      </div>
                      <strong>{fmt(s.fixed)}</strong>
                    </div>
                    <div className="commitment-row">
                      <span className="category-icon">
                        <CreditCard size={19} />
                      </span>
                      <div>
                        <strong>Pago de deudas</strong>
                        <span>{debts.length} deudas registradas</span>
                      </div>
                      <strong>{fmt(s.debtMonthly)}</strong>
                    </div>
                    <div className="plan-total">
                      <span>Reserva diaria sugerida</span>
                      <strong>{fmt(s.committed)}</strong>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setTab("Fijos")}
                    >
                      Ver mi plan <ArrowRight size={16} />
                    </button>
                  </section>
                </div>
              </div>
              {!live.length && (
                <div className="demo-banner">
                  <div>
                    <strong>Este es tu espacio. Hagámoslo tuyo.</strong>
                    <p>
                      Registra tu primer movimiento o explora con datos de
                      ejemplo.
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() =>
                      void run(seedDemo, "Datos de ejemplo cargados")
                    }
                  >
                    Explorar un ejemplo <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
          {tab === "Diario" && (
            <>
              <section className="card calendar-card">
                <div className="section-row" style={{ marginBottom: "12px" }}>
                  <h2>Bitácora diaria</h2>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Días anteriores"
                        title="Días anteriores"
                        onClick={() =>
                          dateStripRef.current?.scrollBy({
                            left: -220,
                            behavior: "smooth",
                          })
                        }
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Días siguientes"
                        title="Días siguientes"
                        onClick={() =>
                          dateStripRef.current?.scrollBy({
                            left: 220,
                            behavior: "smooth",
                          })
                        }
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                    <input
                      type="date"
                      aria-label="Día seleccionado"
                      value={date}
                      onChange={(e) => {
                        if (e.target.value) setDate(e.target.value);
                      }}
                    />
                  </div>
                </div>
                <DateStrip
                  dateStripRef={dateStripRef}
                  month={month}
                  date={date}
                  entries={entries}
                  budget={prefs.budget}
                  onSelectDate={(d) => setDate(d)}
                />
              </section>
              <div className="stat-grid">
                <section className="card stat">
                  <span>Ingresos del día</span>
                  <strong className="positive">{fmt(s.dayIncome)}</strong>
                </section>
                <section className="card stat">
                  <span>Fijos y deudas / día</span>
                  <strong>{fmt(s.committed)}</strong>
                  <small>Reserva planificada, no un cargo</small>
                </section>
                <section className="card stat">
                  <span>Gastos registrados</span>
                  <strong>{fmt(s.dayExpense)}</strong>
                </section>
              </div>
              <section className="card">
                <div className="section-row">
                  <h2>Movimientos del día</h2>
                  <label className="search">
                    <Search size={16} />
                    <input
                      placeholder="Buscar movimiento"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                {renderTx(transactions)}
              </section>
            </>
          )}
          {tab === "Fijos" && (
            <>
              <div className="stat-grid">
                <section className="card stat">
                  <span>Compromisos del mes</span>
                  <strong>{fmt(s.fixed + s.debtMonthly)}</strong>
                </section>
                <section className="card stat">
                  <span>Reserva diaria</span>
                  <strong>{fmt(s.committed)}</strong>
                  <small>Prorrateada entre {daysInMonth(month)} días</small>
                </section>
                <section className="card stat">
                  <span>Deuda por liquidar</span>
                  <strong>
                    {fmt(debts.reduce((v, d) => v + debtRemaining(d, live), 0))}
                  </strong>
                </section>
              </div>
              <div className="section-row standalone">
                <h2>
                  Deudas en proceso{" "}
                  <span className="count">{debts.length}</span>
                </h2>
                <button
                  className="secondary"
                  onClick={() => setForm({ kind: "debt" })}
                >
                  <Plus size={16} /> Nueva deuda
                </button>
              </div>
              <div className="debt-grid">
                {debts.map((d) => {
                  const remaining = debtRemaining(d, live),
                    paid = (d.total || 0) - remaining,
                    percent = d.total ? (paid / d.total) * 100 : 0;
                  return (
                    <section className="card debt-card" key={d.id}>
                      <div className="section-row">
                        <h3>
                          <CreditCard size={20} />
                          {d.title}
                        </h3>
                        <button
                          className="icon-btn"
                          aria-label={`Editar ${d.title}`}
                          onClick={() => setForm({ kind: "debt", entry: d })}
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                      <p className="muted">Saldo pendiente</p>
                      <div className="debt-amount">{fmt(remaining)}</div>
                      <Progress value={percent} />
                      <div className="budget-caption">
                        <span>{Math.round(percent)}% liquidado</span>
                        <span>de {fmt(d.total || 0)}</span>
                      </div>
                      <div className="debt-detail">
                        <span>
                          Cuota mensual <strong>{fmt(d.monthly || 0)}</strong>
                        </span>
                        <span>
                          Reserva por día{" "}
                          <strong>
                            {fmt((d.monthly || 0) / daysInMonth(month))}
                          </strong>
                        </span>
                      </div>
                      <div className="button-row">
                        <button
                          className="secondary"
                          onClick={() => {
                            setSimDebt(d);
                            setExtra("500");
                          }}
                        >
                          Simular abono
                        </button>
                        <button
                          className="primary"
                          disabled={!remaining}
                          onClick={() =>
                            setForm({ kind: "transaction", debt: d })
                          }
                        >
                          <Plus size={15} /> Abonar
                        </button>
                      </div>
                    </section>
                  );
                })}
              </div>
              {!debts.length && (
                <div className="card empty">
                  <Landmark />
                  <h3>Un espacio para tus deudas</h3>
                  <p>
                    Añade el saldo y la cuota mensual para planear su
                    liquidación.
                  </p>
                </div>
              )}
              <div className="section-row standalone">
                <h2>Gastos fijos</h2>
                <button
                  className="secondary"
                  onClick={() => setForm({ kind: "fixed" })}
                >
                  <Plus size={16} /> Nuevo fijo
                </button>
              </div>
              <section className="card">
                {fixed.length ? (
                  [...new Set(fixed.map((f) => f.category))].map((c) => (
                    <div key={c}>
                      <h3 className="group-label">{c}</h3>
                      {fixed
                        .filter((f) => f.category === c)
                        .map((f) => (
                          <div className="transaction" key={f.id}>
                            <span className="category-icon">
                              <CategoryIcon category={c} />
                            </span>
                            <div className="transaction-label">
                              <strong>{f.title}</strong>
                              <span>{fmt(f.amount)} al mes</span>
                            </div>
                            <div className="fixed-amount">
                              <strong>
                                {fmt(f.amount / daysInMonth(month))}
                              </strong>
                              <span>/ día</span>
                            </div>
                            <button
                              className="icon-btn"
                              aria-label={`Editar ${f.title}`}
                              onClick={() =>
                                setForm({ kind: "fixed", entry: f })
                              }
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-btn"
                              aria-label={`Eliminar ${f.title}`}
                              onClick={() => deleteItem(f)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                    </div>
                  ))
                ) : (
                  <div className="empty">
                    <House />
                    <h3>Anticípate a tus gastos</h3>
                    <p>
                      Renta, internet, servicios… agrega tus compromisos
                      mensuales.
                    </p>
                  </div>
                )}
              </section>
              <p className="footnote">
                <Info size={14} /> Los gastos fijos y cuotas son reservas
                planificadas. Registra cada pago para descontarlo de tu saldo.
              </p>
            </>
          )}
          {tab === "Balances" && (
            <>
              <div className="stat-grid">
                <section className="card stat">
                  <span>Ingresos</span>
                  <strong className="positive">{fmt(s.income)}</strong>
                </section>
                <section className="card stat">
                  <span>Gastos</span>
                  <strong>{fmt(s.expense)}</strong>
                </section>
                <section className="card stat">
                  <span>Balance neto</span>
                  <strong className={s.balance >= 0 ? "positive" : "negative"}>
                    {fmt(s.balance)}
                  </strong>
                </section>
              </div>
              {/* Flujo Comparativo Ingresos vs Gastos */}
              <IncomeExpenseFlow income={s.income} expense={s.expense} />

              <section className="card">
                <div className="section-row">
                  <h2>¿A dónde se fue tu dinero?</h2>
                  <span className="muted">{month}</span>
                </div>
                <CategoryDonutChart
                  data={[...new Set(s.tx.map((e) => e.category))]
                    .map((c) => ({
                      category: c,
                      amount: s.tx
                        .filter(
                          (e) => e.direction !== "income" && e.category === c,
                        )
                        .reduce((v, e) => v + e.amount, 0),
                    }))
                    .filter((c) => c.amount > 0)
                    .sort((a, b) => b.amount - a.amount)}
                  totalExpense={s.expense}
                />
              </section>
              <section className="card export-card">
                <div>
                  <h2>Tus datos van contigo</h2>
                  <p className="muted">
                    Descarga el reporte del mes seleccionado.
                  </p>
                </div>
                <div className="button-row">
                  {(["xlsx", "csv", "pdf"] as const).map((f) => (
                    <button
                      className="secondary"
                      key={f}
                      onClick={() =>
                        void run(
                          () => exportReport(f, entries, prefs, month),
                          "Reporte descargado",
                        )
                      }
                    >
                      <Download size={16} />
                      {f === "xlsx" ? "Excel" : f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </section>
              <section className="card">
                <div className="section-row">
                  <h2>Todos los movimientos</h2>
                  <label className="search">
                    <Search size={16} />
                    <input
                      placeholder="Buscar movimiento"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                {renderTx(transactions)}
              </section>
            </>
          )}
          <footer>
            <span>
              <LockKeyhole size={12} /> Tus registros se guardan en este
              dispositivo
            </span>
            <span>Clara · Finanzas personales</span>
          </footer>
        </div>
      </main>
      {nav(true)}
      {toast && (
        <IosNotificationBanner
          toast={toast}
          onClose={() => setToast(null)}
        />
      )}
      {form && (
        <Modal
          title={
            form.entry
              ? "Editar registro"
              : form.debt
                ? `Abonar a ${form.debt.title}`
                : {
                    transaction: "Nuevo movimiento",
                    fixed: "Nuevo gasto fijo",
                    debt: "Nueva deuda",
                    account: "Nueva cuenta",
                  }[form.kind]
          }
          onClose={() => setForm(null)}
        >
          <EntryForm
            kind={form.kind}
            entry={form.entry}
            debt={form.debt}
            accounts={accounts}
            date={date}
            entries={live}
            categories={availableCategories}
            onAddCategory={handleAddCategory}
            onSave={() => {
              setForm(null);
              notify("Guardado en este dispositivo");
              navigator.vibrate?.(30);
            }}
            onError={notify}
          />
          {form.entry && (
            <button
              className="danger-button"
              onClick={() => {
                deleteItem(form.entry!);
                setForm(null);
              }}
            >
              Eliminar registro
            </button>
          )}
        </Modal>
      )}
      {simDebt && (
        <Modal title="Simula un abono extra" onClose={() => setSimDebt(null)}>
          <p className="muted">
            {simDebt.title} · Sin intereses ni nuevos cargos. Es una estimación.
          </p>
          <label>
            Abono extra (MXN)
            <input
              type="number"
              min="0"
              max={debtRemaining(simDebt, live)}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
          </label>
          <div className="simulation">
            <span>
              Saldo después del abono
              <strong>
                {fmt(
                  Math.max(
                    0,
                    debtRemaining(simDebt, live) - (Number(extra) || 0),
                  ),
                )}
              </strong>
            </span>
            <span>
              Meses estimados restantes
              <strong>
                {simDebt.monthly
                  ? Math.ceil(
                      Math.max(
                        0,
                        debtRemaining(simDebt, live) - (Number(extra) || 0),
                      ) / simDebt.monthly,
                    )
                  : "Define una cuota"}
              </strong>
            </span>
            <span>
              Flujo mensual liberado al liquidar
              <strong className="positive">{fmt(simDebt.monthly || 0)}</strong>
            </span>
          </div>
          <p className="footnote">
            La simulación no modifica tu deuda ni registra pagos.
          </p>
        </Modal>
      )}
      {settings && (
        <Modal title="Configuración" onClose={() => setSettings(false)}>
          {toast && (
            <p className="inline-notice" role="status">
              {toast.message}
            </p>
          )}

          {/* Apartado de Perfil */}
          <div className="google-auth-card" style={{ marginBottom: "20px" }}>
            <div className="section-row" style={{ marginBottom: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>👤 Perfil</h3>
              <span
                className="savings-badge"
                style={{
                  background: currentUser
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(56, 189, 248, 0.15)",
                  color: currentUser ? "#34d399" : "#38bdf8",
                }}
              >
                {currentUser ? "Google Conectado" : "Modo Invitado"}
              </span>
            </div>

            <div className="user-profile-header">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || "Usuario"}
                  className="user-avatar"
                />
              ) : (
                <div
                  className="user-avatar"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: currentUser ? "#3b82f6" : "rgba(255, 255, 255, 0.12)",
                    fontWeight: "bold",
                  }}
                >
                  {(
                    currentUser?.displayName ||
                    currentUser?.email ||
                    (isGuest ? "I" : "U")
                  )[0].toUpperCase()}
                </div>
              )}
              <div className="user-info-text">
                <strong>
                  {currentUser
                    ? currentUser.displayName || currentUser.email
                    : "Invitado (Modo Local)"}
                </strong>
                <span>
                  {currentUser
                    ? currentUser.email
                    : "Datos guardados solo en este equipo"}
                </span>
              </div>
            </div>

            {currentUser ? (
              <button
                type="button"
                className="secondary full"
                style={{
                  marginTop: "12px",
                  color: "#ef4444",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
                disabled={busy}
                onClick={handleLogout}
              >
                <LogOut size={16} /> Cerrar sesión
              </button>
            ) : (
              <div style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  className="google-login-btn full"
                  disabled={busy || !online}
                  onClick={() => {
                    setBusy(true);
                    void run(
                      async () => {
                        const user = await loginWithGoogle();
                        setCurrentUser(user);
                        setIsGuest(false);
                        localStorage.setItem("clara_guest_mode", "false");
                      },
                      "Sesión iniciada con Google",
                    ).finally(() => setBusy(false));
                  }}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <svg className="google-icon-svg" viewBox="0 0 24 24">
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
                  Vincular con cuenta de Google
                </button>
                <button
                  type="button"
                  className="text-button"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    marginTop: "10px",
                    color: "var(--muted, #94a3b8)",
                    fontSize: "13px",
                  }}
                  onClick={handleLogout}
                >
                  <LogOut size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Salir al inicio de sesión
                </button>
              </div>
            )}
          </div>

          <hr />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(
                () =>
                  savePrefs({
                    budget: Number(f.get("budget")),
                    syncUrl: prefs.syncUrl || "",
                    syncToken: prefs.syncToken || "",
                    firebaseConfig: prefs.firebaseConfig || "",
                  }),
                "Configuración guardada",
              );
            }}
          >
            <label>
              Presupuesto mensual (MXN)
              <input
                name="budget"
                type="number"
                min="0"
                max="1000000000"
                step="0.01"
                defaultValue={prefs.budget}
                required
              />
            </label>
            <p className="field-help">
              El límite diario reparte lo disponible después de reservar fijos y
              cuotas.
            </p>

            <button className="primary full" type="submit">
              <Check size={16} /> Guardar configuración
            </button>
          </form>
          <button
            className="secondary full"
            disabled={busy || !online}
            onClick={() => {
              setBusy(true);
              void run(async () => {
                const count = await syncData(prefs);
                notify(
                  typeof count === "number" && count > 0
                    ? `Sincronizados ${count} registros con Firebase`
                    : "Sincronización completada: tus datos están al día en la nube.",
                );
              }).finally(() => setBusy(false));
            }}
          >
            <RefreshCw size={16} className={busy ? "spin" : ""} />
            {busy ? "Sincronizando…" : "Sincronizar ahora con la nube"}
          </button>
          {prefs.lastSync && (
            <p className="field-help">
              Última sincronización:{" "}
              {new Date(prefs.lastSync).toLocaleString("es-MX")}
            </p>
          )}
          <hr />
          <div style={{ margin: "16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={16} style={{ color: "var(--accent, #38bdf8)" }} />
                Versión y Actualizaciones
              </h3>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted, #94a3b8)",
                  background: "rgba(255, 255, 255, 0.06)",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                v1.1.0 · Web
              </span>
            </div>
            <p className="field-help" style={{ marginTop: 0, marginBottom: "12px" }}>
              Comprueba si hay una nueva versión o correcciones en la nube y actualiza al instante.
            </p>
            <button
              type="button"
              className="secondary full"
              disabled={checkingUpdate || !online}
              onClick={handleCheckUpdate}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <RefreshCw size={16} className={checkingUpdate ? "spin" : ""} />
              {checkingUpdate ? "Buscando actualizaciones…" : "Buscar actualizaciones"}
            </button>
          </div>
          <hr />
          <div style={{ margin: "16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Bell size={16} style={{ color: "var(--accent, #38bdf8)" }} />
                Notificaciones estilo iOS
              </h3>
              <span
                style={{
                  fontSize: "11px",
                  color: notificationPermission === "granted" ? "#4ade80" : "var(--muted, #94a3b8)",
                  background: notificationPermission === "granted" ? "rgba(74, 222, 128, 0.1)" : "rgba(255, 255, 255, 0.06)",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                {notificationPermission === "granted" ? "Activas" : "En pantalla"}
              </span>
            </div>
            <p className="field-help" style={{ marginTop: 0, marginBottom: "12px" }}>
              Avisos flotantes estilo iPhone con sonido sutil y háptico para pagos fijos, recordatorios y confirmaciones.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              {notificationPermission !== "granted" && (
                <button
                  type="button"
                  className="secondary"
                  style={{ flex: 1, fontSize: "13px" }}
                  onClick={async () => {
                    if ("Notification" in window) {
                      const res = await Notification.requestPermission();
                      setNotificationPermission(res);
                      if (res === "granted") {
                        notify("Notificaciones del sistema activadas correctamente.", "NOTIFICACIONES", "success");
                      }
                    }
                  }}
                >
                  <Bell size={14} /> Activar en sistema
                </button>
              )}
              <button
                type="button"
                className="secondary"
                style={{ flex: 1, fontSize: "13px" }}
                onClick={() => {
                  notify(
                    "📅 Pago próximo: Internet Telmex ($550.00 MXN) vence en 2 días.",
                    "RECORDATORIO DE PAGO",
                    "payment",
                  );
                }}
              >
                <Sparkles size={14} /> Probar aviso iOS
              </button>
            </div>
          </div>
          <hr />
          <div style={{ margin: "16px 0" }}>
            <div className="section-row" style={{ marginBottom: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>Categorías de Gastos</h3>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: "12px", color: "var(--muted, #94a3b8)" }}
                onClick={() => {
                  void run(
                    () => savePrefs({ customCategories: defaultCategories }),
                    "Categorías restablecidas a las iniciales",
                  );
                }}
              >
                Restablecer
              </button>
            </div>
            <p className="field-help" style={{ marginTop: 0, marginBottom: "12px" }}>
              Agrega o elimina categorías para personalizar tu registro de gastos.
            </p>

            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <input
                type="text"
                id="settings-cat-input"
                placeholder="Ej. Gimnasio, Mascotas..."
                maxLength={25}
                style={{ flex: 1, padding: "8px 12px" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const target = e.currentTarget;
                    if (target.value.trim()) {
                      void handleAddCategory(target.value.trim());
                      target.value = "";
                    }
                  }
                }}
              />
              <button
                type="button"
                className="secondary"
                style={{ padding: "0 14px", flexShrink: 0 }}
                onClick={() => {
                  const input = document.getElementById(
                    "settings-cat-input",
                  ) as HTMLInputElement;
                  if (input && input.value.trim()) {
                    void handleAddCategory(input.value.trim());
                    input.value = "";
                  }
                }}
              >
                <Plus size={16} /> Agregar
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {availableCategories.map((cat) => (
                <span
                  key={cat}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "999px",
                    padding: "6px 12px",
                    fontSize: "13px",
                  }}
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    aria-label={`Eliminar categoría ${cat}`}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--muted, #94a3b8)",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                    onClick={() => void handleDeleteCategory(cat)}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>
          <hr />
          <h3>Respaldo y portabilidad</h3>
          <p className="field-help">
            El respaldo contiene tus registros financieros. Guárdalo en un lugar
            privado.
          </p>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() =>
                void run(
                  () => exportReport("json", entries, prefs, month),
                  "Respaldo descargado",
                )
              }
            >
              <Download size={16} /> Respaldo JSON
            </button>
            <label className="secondary file-button">
              <Upload size={16} /> Restaurar
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (
                    file &&
                    confirm(
                      "El respaldo reemplazará tus registros actuales. ¿Continuar?",
                    )
                  )
                    void run(() => restoreBackup(file), "Respaldo restaurado");
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <hr />
          <h3>Privacidad</h3>
          <button
            className="secondary full"
            onClick={() =>
              void run(async () => {
                if (hasLock()) {
                  await unlock();
                  disableLock();
                } else await enableLock();
                notify(hasLock() ? "Bloqueo activado" : "Bloqueo desactivado");
              })
            }
          >
            <LockKeyhole size={16} />
            {hasLock()
              ? "Desactivar bloqueo del dispositivo"
              : "Activar bloqueo del dispositivo"}
          </button>
          <p className="field-help">
            Usa la biometría o el PIN del dispositivo mediante WebAuthn. Bloquea
            la interfaz al salir; no cifra la base de datos.
          </p>
          <hr />
          <h3>Instalar Clara</h3>
          {install ? (
            <button
              className="secondary full"
              onClick={() => void install.prompt()}
            >
              <Smartphone size={16} /> Instalar app
            </button>
          ) : (
            <p className="field-help">
              En iPhone: Safari → Compartir → Añadir a pantalla de inicio. En
              Android: menú de Chrome → Instalar app. Abre la app con conexión
              una vez para preparar el uso sin conexión.
            </p>
          )}
          <hr />
          <div style={{ margin: "16px 0" }}>
            <h3 style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 6px 0", fontSize: "16px" }}>
              <Trash2 size={18} /> Restablecer desde cero
            </h3>
            <p className="field-help" style={{ marginTop: 0, marginBottom: "12px" }}>
              Elimina de forma definitiva todos los gastos, ingresos, cuentas, gastos fijos y deudas guardados en este dispositivo y en la nube.
            </p>
            <button
              type="button"
              className="danger-btn full"
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                padding: "10px 16px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontWeight: 600,
                cursor: "pointer",
                width: "100%",
              }}
              disabled={busy}
              onClick={handleWipeAllData}
            >
              <Trash2 size={16} /> Restablecer y borrar datos de la cuenta
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function EntryForm({
  kind,
  entry,
  debt,
  accounts,
  date,
  entries,
  categories: activeCategories = defaultCategories,
  onAddCategory,
  onSave,
  onError,
}: {
  kind: Kind;
  entry?: Entry;
  debt?: Entry;
  accounts: Entry[];
  date: string;
  entries: Entry[];
  categories?: string[];
  onAddCategory?: (name: string) => Promise<void>;
  onSave: () => void;
  onError: (s: string) => void;
}) {
  const [amount, setAmount] = useState(entry ? String(entry.amount) : ""),
    [category, setCategory] = useState(
      entry?.category || (debt ? "Deuda" : "Comida"),
    ),
    [direction, setDirection] = useState<"income" | "expense">(
      entry?.direction || "expense",
    ),
    [saving, setSaving] = useState(false),
    [addingCat, setAddingCat] = useState(false),
    [newCatName, setNewCatName] = useState(""),
    [errorMessage, setErrorMessage] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const f = new FormData(e.currentTarget),
        value = Number(amount);
      let title = String(f.get("title") || "").trim();
      if (!title) {
        if (kind === "transaction") {
          title = category || (direction === "income" ? "Ingreso" : "Gasto");
        } else {
          throw new Error(kind === "account" ? "Escribe un nombre de cuenta." : "Escribe un concepto.");
        }
      }
      if (
        !Number.isFinite(value) ||
        value < 0 ||
        (kind !== "debt" && kind !== "account" && value === 0)
      )
        throw new Error("Ingresa un monto mayor a cero.");
      const total = Number(f.get("total")),
        initialPaid = Number(f.get("initialPaid")),
        monthly = Number(f.get("monthly"));
      if (
        kind === "debt" &&
        (!Number.isFinite(total) ||
          total <= 0 ||
          initialPaid < 0 ||
          initialPaid > total ||
          monthly <= 0)
      )
        throw new Error("Revisa el total, el pago inicial y la cuota.");
      const linked = debt || entries.find((d) => d.id === entry?.debtId);
      if (linked) {
        const remaining = debtRemaining(linked, entries) + (entry?.amount || 0);
        if (value > remaining || direction !== "expense")
          throw new Error(
            "El abono debe ser un gasto y no superar el saldo pendiente.",
          );
      }
      if (
        kind === "account" &&
        entries.some(
          (a) =>
            a.kind === "account" &&
            a.id !== entry?.id &&
            a.title.toLowerCase() === title.toLowerCase(),
        )
      )
        throw new Error("Ya existe una cuenta con ese nombre.");
      await db.transaction("rw", db.entries, async () => {
        await saveEntry({
          id: entry?.id,
          kind,
          title,
          amount: kind === "debt" ? 0 : round(value),
          date: String(f.get("date") || date),
          category,
          account: String(f.get("account") || ""),
          direction,
          debtId: debt?.id || entry?.debtId,
          total: kind === "debt" ? total : undefined,
          initialPaid: kind === "debt" ? initialPaid : undefined,
          monthly: kind === "debt" ? monthly : undefined,
        });
        if (kind === "account" && entry && entry.title !== title) {
          for (const t of entries.filter(
            (t) => t.kind === "transaction" && t.account === entry.title,
          ))
            await db.entries.put({ ...t, account: title, updated: Date.now() });
        }
      });
      onSave();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar.";
      setErrorMessage(message);
      onError(message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="entry-form">
      {kind === "transaction" && !debt && !entry?.debtId && (
        <div className="segmented">
          <button
            type="button"
            className={direction === "expense" ? "selected" : ""}
            onClick={() => setDirection("expense")}
          >
            <ArrowUpRight size={16} /> Gasto
          </button>
          <button
            type="button"
            className={direction === "income" ? "selected" : ""}
            onClick={() => {
              setDirection("income");
              setCategory("Nómina");
            }}
          >
            <ArrowDownLeft size={16} /> Ingreso
          </button>
        </div>
      )}
      {kind !== "debt" && (
        <label className="amount-input">
          <span>
            {kind === "fixed"
              ? "Monto mensual"
              : kind === "account"
                ? "Saldo inicial"
                : "Monto"}{" "}
            · MXN
          </span>
          <div>
            <span>$</span>
            <input
              aria-label="Monto"
              inputMode="decimal"
              type="text"
              pattern="[0-9]+([.][0-9]{1,2})?"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
              placeholder="0.00"
              required
              maxLength={14}
            />
          </div>
        </label>
      )}
      <label>
        {kind === "account" ? "Nombre de la cuenta" : "Concepto"}
        <input
          name="title"
          placeholder={
            kind === "transaction"
              ? "¿En qué lo usaste? (opcional)"
              : kind === "fixed"
                ? "Ej. Internet en casa"
                : kind === "debt"
                  ? "Ej. Tarjeta Nu"
                  : "Ej. Débito BBVA"
          }
          defaultValue={entry?.title || (debt ? `Abono · ${debt.title}` : "")}
          required={kind !== "transaction"}
          maxLength={100}
        />
      </label>
      {kind === "debt" && (
        <div className="form-grid">
          <label>
            Deuda original
            <input
              name="total"
              type="number"
              min="0.01"
              step="0.01"
              max="1000000000"
              defaultValue={entry?.total}
              required
            />
          </label>
          <label>
            Pagado antes de Clara
            <input
              name="initialPaid"
              type="number"
              min="0"
              step="0.01"
              max="1000000000"
              defaultValue={entry?.initialPaid || 0}
              required
            />
          </label>
          <label>
            Cuota mensual
            <input
              name="monthly"
              type="number"
              min="0.01"
              step="0.01"
              max="1000000000"
              defaultValue={entry?.monthly}
              required
            />
          </label>
        </div>
      )}
      {(kind === "transaction" || kind === "fixed") && (
        <>
          <label>Categoría</label>
          <div className="chips">
            {activeCategories
              .filter((c) => kind !== "fixed" || c !== "Nómina")
              .map((c) => (
                <button
                  type="button"
                  key={c}
                  className={category === c ? "selected" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            {onAddCategory &&
              (addingCat ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Nueva..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    maxLength={25}
                    autoFocus
                    style={{
                      width: "105px",
                      padding: "4px 8px",
                      fontSize: "13px",
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = newCatName.trim();
                        if (val) {
                          await onAddCategory(val);
                          setCategory(val);
                          setNewCatName("");
                          setAddingCat(false);
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="secondary"
                    style={{ padding: "4px 8px" }}
                    onClick={async () => {
                      const val = newCatName.trim();
                      if (val) {
                        await onAddCategory(val);
                        setCategory(val);
                        setNewCatName("");
                        setAddingCat(false);
                      }
                    }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    style={{ padding: "4px" }}
                    onClick={() => setAddingCat(false)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  style={{
                    border: "1px dashed rgba(255, 255, 255, 0.35)",
                    background: "transparent",
                    color: "#38bdf8",
                    padding: "6px 12px",
                    borderRadius: "999px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                  onClick={() => setAddingCat(true)}
                >
                  + Nueva
                </button>
              ))}
          </div>
        </>
      )}
      {kind === "transaction" && (
        <div className="form-grid">
          <label>
            Cuenta
            <select
              name="account"
              defaultValue={entry?.account || accounts[0]?.title || "Efectivo"}
            >
              {[
                ...new Set([
                  ...accounts.map((a) => a.title),
                  "Efectivo",
                  ...(entry?.account ? [entry.account] : []),
                ]),
              ].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <input
              name="date"
              type="date"
              defaultValue={entry?.date || date}
              required
            />
          </label>
        </div>
      )}
      <p className="form-error" role="alert">
        {errorMessage}
      </p>
      <button className="primary full save-button" disabled={saving}>
        <Check size={18} />
        {saving
          ? "Guardando…"
          : "Guardar " +
            (kind === "transaction"
              ? "movimiento"
              : kind === "fixed"
                ? "gasto fijo"
                : kind === "debt"
                  ? "deuda"
                  : "cuenta")}
      </button>
    </form>
  );
}
