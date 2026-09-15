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
} from "lucide-react";
import {
  db,
  defaults,
  today,
  money,
  round,
  daysInMonth,
  categories,
  summarize,
  debtRemaining,
  saveEntry,
  removeEntry,
  seedDemo,
  syncData,
  type Entry,
  type Prefs,
  type Kind,
} from "./data";
import { exportReport, restoreBackup } from "./reports";
import { enableLock, unlock, disableLock, hasLock } from "./security";
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
export default function App() {
  const entries = useLiveQuery(() => db.entries.toArray(), []) || [];
  const prefs = useLiveQuery(() => db.prefs.get("main"), []) || defaults;
  const [tab, setTab] = useState<Tab>("Inicio"),
    [date, setDate] = useState(today()),
    [online, setOnline] = useState(navigator.onLine),
    [toast, setToast] = useState(""),
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
    [extra, setExtra] = useState("500");
  const month = date.slice(0, 7),
    live = entries.filter((e) => !e.deleted),
    s = summarize(entries, month, date, prefs.budget),
    fixed = live.filter((e) => e.kind === "fixed"),
    debts = live.filter((e) => e.kind === "debt"),
    accounts = live.filter((e) => e.kind === "account");
  const fmt = (n: number) => (prefs.hidden ? "$ ••••••" : money(n));
  const notify = (message: string) => setToast(message);
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
  const savePrefs = async (change: Partial<Prefs>) =>
    db.prefs.put({ ...prefs, ...change });
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
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!online || !prefs.syncUrl || !prefs.syncToken || locked) return;
    const t = setTimeout(() => {
      void syncData(prefs).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [online, prefs.syncUrl, prefs.syncToken, entries, locked]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
  useEffect(() => {
    if (!online || !prefs.syncUrl || !prefs.syncToken || locked) return;
    const timer = setInterval(() => {
      void syncData(prefs).catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [online, prefs.syncUrl, prefs.syncToken, locked]);
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
        {toast && <p role="alert">{toast}</p>}
      </div>
    );
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
          <div className="profile">
            <div className="avatar">C</div>
            <div>
              <strong>Mi cuenta personal</strong>
              <span>Moneda · MXN</span>
            </div>
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
                    <button
                      className="register-row"
                      onClick={() => setForm({ kind: "transaction" })}
                    >
                      <Plus size={16} /> Registrar un movimiento
                    </button>
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
                <div className="section-row">
                  <h2>Bitácora diaria</h2>
                  <input
                    type="date"
                    aria-label="Día seleccionado"
                    value={date}
                    onChange={(e) => {
                      if (e.target.value) setDate(e.target.value);
                    }}
                  />
                </div>
                <div className="date-strip">
                  {Array.from({ length: daysInMonth(month) }, (_, i) => {
                    const day = month + "-" + String(i + 1).padStart(2, "0"),
                      ds = summarize(entries, month, day, prefs.budget);
                    return (
                      <button
                        ref={(el) => {
                          if (el && day === date)
                            el.parentElement?.scrollTo({
                              left:
                                el.offsetLeft -
                                el.parentElement.offsetLeft -
                                el.parentElement.clientWidth / 2 +
                                el.clientWidth / 2,
                            });
                        }}
                        className={day === date ? "selected" : ""}
                        key={day}
                        onClick={() => setDate(day)}
                      >
                        <span>
                          {new Date(day + "T12:00:00").toLocaleDateString(
                            "es-MX",
                            { weekday: "short" },
                          )}
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
              <section className="card">
                <div className="section-row">
                  <h2>¿A dónde se fue tu dinero?</h2>
                  <span className="muted">{month}</span>
                </div>
                <div className="category-chart">
                  {[...new Set(s.tx.map((e) => e.category))]
                    .map((c) => ({
                      category: c,
                      amount: s.tx
                        .filter(
                          (e) => e.direction !== "income" && e.category === c,
                        )
                        .reduce((v, e) => v + e.amount, 0),
                    }))
                    .filter((c) => c.amount > 0)
                    .sort((a, b) => b.amount - a.amount)
                    .map((c) => (
                      <div className="chart-row" key={c.category}>
                        <span>{c.category}</span>
                        <Progress
                          value={s.expense ? (c.amount / s.expense) * 100 : 0}
                        />
                        <strong>{fmt(c.amount)}</strong>
                        <span>{Math.round((c.amount / s.expense) * 100)}%</span>
                      </div>
                    ))}
                  {!s.expense && (
                    <p className="empty">
                      Tus categorías aparecerán después del primer gasto.
                    </p>
                  )}
                </div>
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
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button aria-label="Cerrar aviso" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
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
        <Modal title="Tu configuración" onClose={() => setSettings(false)}>
          {toast && (
            <p className="inline-notice" role="status">
              {toast}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(
                () =>
                  savePrefs({
                    budget: Number(f.get("budget")),
                    syncUrl: String(f.get("syncUrl")).trim(),
                    syncToken: String(f.get("syncToken")).trim(),
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
            <h3>Sincronización opcional</h3>
            <p className="field-help">
              Conecta tu servidor Clara para sincronizar entre dispositivos. Sin
              servidor, todo permanece aquí.
            </p>
            <label>
              Dirección del servidor
              <input
                name="syncUrl"
                type="url"
                placeholder="https://tu-servidor.com"
                defaultValue={prefs.syncUrl}
              />
            </label>
            <label>
              Clave de acceso
              <input
                name="syncToken"
                type="password"
                autoComplete="off"
                defaultValue={prefs.syncToken}
              />
            </label>
            <button className="primary full" type="submit">
              <Check size={16} /> Guardar configuración
            </button>
          </form>
          <button
            className="secondary full"
            disabled={busy || !online || !prefs.syncUrl}
            onClick={() => {
              setBusy(true);
              void run(
                () => syncData(prefs),
                "Sincronización completada",
              ).finally(() => setBusy(false));
            }}
          >
            <RefreshCw size={16} className={busy ? "spin" : ""} />
            {busy ? "Sincronizando…" : "Sincronizar ahora"}
          </button>
          {prefs.lastSync && (
            <p className="field-help">
              Última sincronización:{" "}
              {new Date(prefs.lastSync).toLocaleString("es-MX")}
            </p>
          )}
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
  onSave,
  onError,
}: {
  kind: Kind;
  entry?: Entry;
  debt?: Entry;
  accounts: Entry[];
  date: string;
  entries: Entry[];
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
    [errorMessage, setErrorMessage] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const f = new FormData(e.currentTarget),
        value = Number(amount),
        title = String(f.get("title")).trim();
      if (!title) throw new Error("Escribe un concepto.");
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
              ? "¿En qué lo usaste?"
              : kind === "fixed"
                ? "Ej. Internet en casa"
                : kind === "debt"
                  ? "Ej. Tarjeta Nu"
                  : "Ej. Débito BBVA"
          }
          defaultValue={entry?.title || (debt ? `Abono · ${debt.title}` : "")}
          required
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
            {categories
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
      {kind === "transaction" && (
        <details className="keypad-disclosure">
          <summary>Teclado rápido</summary>
          <div className="keypad" aria-label="Teclado numérico">
            {[
              "1",
              "2",
              "3",
              "4",
              "5",
              "6",
              "7",
              "8",
              "9",
              ".",
              "0",
              "borrar",
            ].map((key) => (
              <button
                type="button"
                aria-label={key === "borrar" ? "Borrar último dígito" : key}
                key={key}
                onClick={() =>
                  setAmount((v) =>
                    key === "borrar"
                      ? v.slice(0, -1)
                      : key === "."
                        ? v.includes(".")
                          ? v
                          : (v || "0") + "."
                        : v.length < 12 &&
                            (!v.includes(".") || v.split(".")[1].length < 2)
                          ? v === "0"
                            ? key
                            : v + key
                          : v,
                  )
                }
              >
                {key === "borrar" ? <Delete size={20} /> : key}
              </button>
            ))}
          </div>
        </details>
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
