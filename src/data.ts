import Dexie, { type Table } from "dexie";
export type Kind = "transaction" | "fixed" | "debt" | "account";
export interface Entry {
  id: string;
  kind: Kind;
  title: string;
  amount: number;
  date: string;
  category: string;
  account: string;
  updated: number;
  deleted?: boolean;
  direction?: "income" | "expense";
  debtId?: string;
  total?: number;
  initialPaid?: number;
  monthly?: number;
}
export interface Prefs {
  id: string;
  budget: number;
  hidden: boolean;
  syncUrl: string;
  syncToken: string;
  firebaseConfig?: string;
  lastSync?: string;
  customCategories?: string[];
}
class Database extends Dexie {
  entries!: Table<Entry, string>;
  prefs!: Table<Prefs, string>;
  constructor() {
    super("crystal-finanzas");
    this.version(1).stores({ entries: "id,kind,date,updated", prefs: "id" });
  }
}
export const db = new Database();
export const defaultCategories = [
  "Comida",
  "Gasolina",
  "Despensa",
  "Farmacia",
  "Vivienda",
  "Servicios",
  "Transporte",
  "Ocio",
  "Salud",
  "Deuda",
  "Nómina",
  "Otros",
];
export const categories = defaultCategories;
export function getCategories(prefs?: Prefs): string[] {
  if (prefs?.customCategories && prefs.customCategories.length > 0) {
    return prefs.customCategories;
  }
  return defaultCategories;
}
export const defaults: Prefs = {
  id: "main",
  budget: 0,
  hidden: false,
  syncUrl: "",
  syncToken: "",
  firebaseConfig: "",
  customCategories: defaultCategories,
};
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    n,
  );
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const daysInMonth = (month: string) =>
  new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
export function summarize(
  entries: Entry[],
  month: string,
  date: string,
  budget: number,
) {
  const live = entries.filter((e) => !e.deleted),
    tx = live.filter(
      (e) => e.kind === "transaction" && e.date.startsWith(month),
    );
  const income = round(
    tx
      .filter((e) => e.direction === "income")
      .reduce((s, e) => s + e.amount, 0),
  );
  const expense = round(
    tx
      .filter((e) => e.direction !== "income")
      .reduce((s, e) => s + e.amount, 0),
  );
  const fixed = round(
    live.filter((e) => e.kind === "fixed").reduce((s, e) => s + e.amount, 0),
  );
  const debtMonthly = round(
    live
      .filter((e) => e.kind === "debt" && debtRemaining(e, live) > 0)
      .reduce(
        (s, e) => s + Math.min(e.monthly || 0, debtRemaining(e, live)),
        0,
      ),
  );
  const dayTx = tx.filter((e) => e.date === date),
    dayExpense = round(
      dayTx
        .filter((e) => e.direction !== "income")
        .reduce((s, e) => s + e.amount, 0),
    );
  const dayIncome = round(
    dayTx
      .filter((e) => e.direction === "income")
      .reduce((s, e) => s + e.amount, 0),
  );
  const committed = round((fixed + debtMonthly) / daysInMonth(month));
  const allowance = round(
    Math.max(0, (budget - fixed - debtMonthly) / daysInMonth(month)),
  );
  return {
    tx,
    income,
    expense,
    balance: round(income - expense),
    fixed,
    debtMonthly,
    committed,
    allowance,
    dayExpense,
    dayIncome,
    dayTx,
  };
}
export function debtRemaining(debt: Entry, entries: Entry[]) {
  return round(
    Math.max(
      0,
      (debt.total || 0) -
        (debt.initialPaid || 0) -
        entries
          .filter(
            (e) =>
              !e.deleted &&
              e.kind === "transaction" &&
              e.direction === "expense" &&
              e.debtId === debt.id,
          )
          .reduce((s, e) => s + e.amount, 0),
    ),
  );
}
export async function saveEntry(
  entry: Omit<Entry, "id" | "updated"> & { id?: string },
) {
  if (!Number.isFinite(entry.amount) || entry.amount < 0)
    throw new Error("Monto no válido");
  await db.entries.put({
    ...entry,
    id: entry.id || crypto.randomUUID(),
    updated: Date.now(),
  });
}
export async function removeEntry(entry: Entry) {
  await db.entries.put({ ...entry, deleted: true, updated: Date.now() });
}
export function validEntries(value: unknown): value is Entry[] {
  if (!Array.isArray(value) || value.length > 100000) return false;
  const ids = new Set<string>();
  return value.every((e) => {
    if (!e || typeof e.id !== "string" || !e.id || ids.has(e.id)) return false;
    ids.add(e.id);
    return (
      ["transaction", "fixed", "debt", "account"].includes(e.kind) &&
      typeof e.title === "string" &&
      e.title.length <= 200 &&
      typeof e.amount === "number" &&
      Number.isFinite(e.amount) &&
      e.amount >= 0 &&
      e.amount <= 1e12 &&
      typeof e.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
      typeof e.updated === "number" &&
      Number.isFinite(e.updated) &&
      typeof e.category === "string" &&
      typeof e.account === "string" &&
      (e.direction === undefined ||
        ["income", "expense"].includes(e.direction)) &&
      (e.deleted === undefined || typeof e.deleted === "boolean") &&
      ["total", "initialPaid", "monthly"].every(
        (k) =>
          e[k] === undefined ||
          (typeof e[k] === "number" &&
            Number.isFinite(e[k]) &&
            e[k] >= 0 &&
            e[k] <= 1e12),
      ) &&
      (e.kind !== "debt" ||
        ((e.total || 0) > 0 && (e.initialPaid || 0) <= (e.total || 0)))
    );
  });
}
let syncing = false;
export async function syncData(prefs: Prefs): Promise<number> {
  if (syncing) return 0;
  syncing = true;
  try {
    const { syncWithFirestore } = await import("./firebase");
    return await syncWithFirestore(prefs);
  } finally {
    syncing = false;
  }
}
export async function seedDemo() {
  if (await db.entries.filter((e) => !e.deleted).count())
    throw new Error(
      "Los datos de ejemplo solo se pueden cargar en una cuenta vacía.",
    );
  const date = today(),
    month = date.slice(0, 7);
  const base = {
    date,
    updated: Date.now(),
    category: "Otros",
    account: "Efectivo",
  };
  const records: Entry[] = [
    { id: "demo-cash", kind: "account", title: "Efectivo", amount: 1500 },
    { id: "demo-bank", kind: "account", title: "Débito BBVA", amount: 3200 },
    {
      id: "demo-salary",
      kind: "transaction",
      title: "Nómina quincenal",
      amount: 14800,
      direction: "income",
      date: month + "-01",
      category: "Nómina",
      account: "Débito BBVA",
    },
    {
      id: "demo-groceries",
      kind: "transaction",
      title: "Despensa de la semana",
      amount: 486,
      direction: "expense",
      category: "Despensa",
      account: "Débito BBVA",
    },
    {
      id: "demo-lunch",
      kind: "transaction",
      title: "Comida / almuerzo",
      amount: 120,
      direction: "expense",
      category: "Comida",
    },
    {
      id: "demo-gas",
      kind: "transaction",
      title: "Carga de gasolina",
      amount: 350,
      direction: "expense",
      category: "Gasolina",
      date: month + "-02",
    },
    {
      id: "demo-coffee",
      kind: "transaction",
      title: "Café de la mañana",
      amount: 58,
      direction: "expense",
      category: "Ocio",
    },
    {
      id: "demo-home",
      kind: "fixed",
      title: "Renta de departamento",
      amount: 4500,
      category: "Vivienda",
    },
    {
      id: "demo-services",
      kind: "fixed",
      title: "Internet y servicios",
      amount: 850,
      category: "Servicios",
    },
    {
      id: "demo-phone",
      kind: "fixed",
      title: "Plan de celular",
      amount: 249,
      category: "Servicios",
    },
    {
      id: "demo-debt",
      kind: "debt",
      title: "Tarjeta Nu",
      amount: 0,
      total: 18000,
      initialPaid: 7200,
      monthly: 1800,
      category: "Deuda",
    },
    {
      id: "demo-moto",
      kind: "debt",
      title: "Crédito de moto",
      amount: 0,
      total: 24000,
      initialPaid: 16800,
      monthly: 1200,
      category: "Deuda",
    },
  ].map((e) => ({ ...base, ...e }) as Entry);
  await db.transaction("rw", db.entries, db.prefs, async () => {
    await db.entries.bulkPut(records);
    await db.prefs.put({ ...defaults, budget: 22000 });
  });
}

export async function wipeAllData(): Promise<void> {
  await db.transaction("rw", db.entries, db.prefs, async () => {
    await db.entries.clear();
    await db.prefs.put({ ...defaults, id: "main" });
  });
}
