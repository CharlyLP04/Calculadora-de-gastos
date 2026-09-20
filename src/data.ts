import Dexie, { type Table } from "dexie";
import { profileDatabaseName, sessionProfileId } from "./profiles";
export type Kind = "transaction" | "fixed" | "debt" | "account" | "transfer";
// Un traspaso mueve dinero entre dos cuentas propias: no es ingreso ni gasto y
// queda fuera de `summarize`, que solo mira kind === "transaction".
export const TRANSFER_CATEGORY = "Traspaso";
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
  // Identidad estable de la cuenta. `account` guarda el nombre y sigue siendo el
  // único dato en registros anteriores o escritos por versiones viejas, así que
  // todo lo que reparte dinero acepta ambos (ver matchesAccount).
  accountId?: string;
  // Cuenta de destino de un traspaso. Los traspasos nacen después de accountId,
  // así que siempre referencian por identificador, nunca por nombre.
  toAccountId?: string;
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
  prefsUpdated?: number;
  notificationsEnabled?: boolean;
  // Última revisión del perfil en la nube ya reconciliada. Solo local: permite
  // saltarse la lectura completa de la colección cuando nada cambió.
  syncedRev?: number;
}
export class Database extends Dexie {
  entries!: Table<Entry, string>;
  prefs!: Table<Prefs, string>;
  constructor(profileId = sessionProfileId || "unselected") {
    super(profileDatabaseName(profileId));
    this.version(1).stores({ entries: "id,kind,date,updated", prefs: "id" });
    // Rellena accountId a partir del nombre de cuenta ya guardado. No toca
    // `updated` a propósito: es un dato derivado que cada dispositivo puede
    // recalcular, y tocarlo volvería a subir toda la cartera a Firestore.
    this.version(2)
      .stores({ entries: "id,kind,date,updated", prefs: "id" })
      .upgrade(async (tx) => {
        const table = tx.table<Entry, string>("entries");
        const all = await table.toArray();
        const idByTitle = new Map<string, string>();
        for (const e of all)
          if (e.kind === "account" && !e.deleted) idByTitle.set(e.title, e.id);
        const pending = all.filter(
          (e) => !e.accountId && e.account && idByTitle.has(e.account),
        );
        if (pending.length)
          await table.bulkPut(
            pending.map((e) => ({ ...e, accountId: idByTitle.get(e.account) })),
          );
      });
  }
}
// Un registro pertenece a una cuenta por identidad cuando la tiene; si no, por
// nombre, que es lo único que traen los registros anteriores a accountId.
export const matchesAccount = (entry: Entry, account: Entry) =>
  entry.accountId
    ? entry.accountId === account.id
    : entry.account === account.title;

// Nombre a mostrar: el actual de la cuenta vinculada, no la copia guardada en el
// registro, que queda obsoleta cuando se renombra la cuenta.
export const accountNameMap = (entries: Entry[]) =>
  new Map(
    entries
      .filter((e) => e.kind === "account" && !e.deleted)
      .map((e) => [e.id, e.title] as const),
  );
export const accountLabel = (entry: Entry, names: Map<string, string>) =>
  (entry.accountId && names.get(entry.accountId)) || entry.account;

export function accountBalance(account: Entry, entries: Entry[]) {
  return round(
    entries.reduce((total, e) => {
      if (e.deleted) return total;
      if (e.kind === "transaction" && matchesAccount(e, account))
        return total + (e.direction === "income" ? e.amount : -e.amount);
      if (e.kind === "transfer") {
        if (e.accountId === account.id) return total - e.amount;
        if (e.toAccountId === account.id) return total + e.amount;
      }
      return total;
    }, account.amount),
  );
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
// El calendario necesita, por día, cuántos movimientos hubo y cuánto se gastó.
// Llamar a summarize una vez por día recorría la cartera entera 31 veces (y con
// ella debtRemaining por cada deuda); aquí basta un recorrido para todo el mes.
export function summarizeDays(entries: Entry[], month: string, budget: number) {
  const base = summarize(entries, month, month + "-01", budget);
  const byDay = new Map<string, { expense: number; count: number }>();
  for (const e of base.tx) {
    const day = byDay.get(e.date) || { expense: 0, count: 0 };
    day.count++;
    if (e.direction !== "income") day.expense = round(day.expense + e.amount);
    byDay.set(e.date, day);
  }
  return { allowance: base.allowance, byDay };
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
export interface TransferInput {
  id?: string;
  amount: number;
  date: string;
  fromId: string;
  toId: string;
  title?: string;
}
export async function saveTransfer(input: TransferInput) {
  const amount = round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Ingresa un monto mayor a cero.");
  if (!input.fromId || !input.toId)
    throw new Error("Elige la cuenta de origen y la de destino.");
  if (input.fromId === input.toId)
    throw new Error("Elige dos cuentas distintas.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    throw new Error("Revisa la fecha del traspaso.");
  // Las cuentas se releen aquí dentro: la lista que vio el formulario pudo
  // quedarse vieja si otro dispositivo borró una mientras se llenaba.
  await db.transaction("rw", db.entries, async () => {
    const [from, to] = await Promise.all([
      db.entries.get(input.fromId),
      db.entries.get(input.toId),
    ]);
    const usable = (a?: Entry) => a && a.kind === "account" && !a.deleted;
    if (!usable(from) || !usable(to))
      throw new Error("Alguna de las cuentas ya no está disponible.");
    await db.entries.put({
      id: input.id || crypto.randomUUID(),
      kind: "transfer",
      title: (input.title || "").trim() || `${from!.title} → ${to!.title}`,
      amount,
      date: input.date,
      category: TRANSFER_CATEGORY,
      account: from!.title,
      accountId: from!.id,
      toAccountId: to!.id,
      updated: Date.now(),
    });
  });
}
export function validEntries(value: unknown): value is Entry[] {
  if (!Array.isArray(value) || value.length > 100000) return false;
  const ids = new Set<string>();
  return value.every((e) => {
    if (
      !e ||
      typeof e.id !== "string" ||
      !e.id ||
      e.id.length > 200 ||
      e.id.includes("/") ||
      ids.has(e.id)
    )
      return false;
    ids.add(e.id);
    return (
      ["transaction", "fixed", "debt", "account", "transfer"].includes(e.kind) &&
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
      e.updated >= 0 &&
      e.updated <= Number.MAX_SAFE_INTEGER &&
      typeof e.category === "string" &&
      e.category.length <= 200 &&
      typeof e.account === "string" &&
      e.account.length <= 200 &&
      (e.direction === undefined ||
        ["income", "expense"].includes(e.direction)) &&
      (e.deleted === undefined || typeof e.deleted === "boolean") &&
      ["accountId", "toAccountId"].every(
        (k) =>
          e[k] === undefined ||
          (typeof e[k] === "string" && e[k].length > 0 && e[k].length <= 200),
      ) &&
      // Un traspaso sin las dos cuentas, o con la misma dos veces, movería
      // dinero a ninguna parte o a sí mismo.
      (e.kind !== "transfer" ||
        (typeof e.accountId === "string" &&
          typeof e.toAccountId === "string" &&
          e.accountId !== e.toAccountId &&
          e.amount > 0)) &&
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
let syncBlocked = false;
let syncGeneration = 0;

export function setSyncBlocked(blocked: boolean) {
  if (blocked) syncGeneration++;
  syncBlocked = blocked;
}
export const getSyncGeneration = () => syncGeneration;

export function isSyncBlocked(): boolean {
  return syncBlocked;
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
    await db.prefs.put({
      ...defaults,
      budget: 22000,
      prefsUpdated: Date.now(),
    });
  });
}

export async function wipeAllData(): Promise<void> {
  await db.transaction("rw", db.entries, db.prefs, async () => {
    const now = Date.now();
    const entries = await db.entries.toArray();
    await db.entries.bulkPut(
      entries.map((entry) => ({ ...entry, deleted: true, updated: now })),
    );
    await db.prefs.put({ ...defaults, id: "main", prefsUpdated: now });
  });
}
