import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  vi.stubGlobal("sessionStorage", { getItem: () => "accounts-test" });
});
import Dexie from "dexie";
import {
  db,
  accountBalance,
  accountLabel,
  accountNameMap,
  matchesAccount,
  type Entry,
} from "./data";

const cash: Entry = {
  id: "acc-cash",
  kind: "account",
  title: "Efectivo",
  amount: 1000,
  date: "2026-01-01",
  category: "Otros",
  account: "",
  updated: 1,
};
const tx = (over: Partial<Entry>): Entry => ({
  id: "t1",
  kind: "transaction",
  title: "Movimiento",
  amount: 100,
  date: "2026-01-05",
  category: "Otros",
  account: "Efectivo",
  updated: 1,
  direction: "expense",
  ...over,
});

beforeEach(async () => {
  await db.entries.clear();
});
afterAll(async () => {
  await db.delete();
});

describe("Identidad de cuentas", () => {
  it("reconoce por identificador y, si falta, por nombre", () => {
    expect(matchesAccount(tx({ accountId: "acc-cash" }), cash)).toBe(true);
    expect(matchesAccount(tx({ account: "Efectivo" }), cash)).toBe(true);
    // Con identificador, el nombre guardado ya no manda: así un renombrado no
    // desvincula el movimiento ni se lo roba otra cuenta con el nombre viejo.
    expect(
      matchesAccount(tx({ accountId: "acc-otra", account: "Efectivo" }), cash),
    ).toBe(false);
    expect(
      matchesAccount(tx({ accountId: "acc-cash", account: "Viejo" }), cash),
    ).toBe(true);
  });

  it("calcula el saldo con el historial, sin contar eliminados ni ajenos", () => {
    const entries = [
      cash,
      tx({ id: "a", amount: 300, direction: "expense", accountId: "acc-cash" }),
      tx({ id: "b", amount: 500, direction: "income", accountId: "acc-cash" }),
      tx({ id: "c", amount: 999, accountId: "acc-cash", deleted: true }),
      tx({ id: "d", amount: 999, accountId: "acc-otra", account: "Efectivo" }),
      { ...cash, id: "e", kind: "fixed", amount: 999 } as Entry,
    ];
    expect(accountBalance(cash, entries)).toBe(1200);
  });

  it("muestra el nombre actual de la cuenta, no la copia guardada", () => {
    const names = accountNameMap([{ ...cash, title: "Efectivo MXN" }]);
    expect(accountLabel(tx({ accountId: "acc-cash", account: "Efectivo" }), names)).toBe(
      "Efectivo MXN",
    );
    expect(accountLabel(tx({ account: "Tarjeta" }), names)).toBe("Tarjeta");
    // Una cuenta borrada ya no aporta nombre: queda el guardado en el registro.
    expect(
      accountLabel(tx({ accountId: "acc-ida", account: "Cuenta vieja" }), names),
    ).toBe("Cuenta vieja");
  });

  it("rellena accountId al abrir una base anterior sin tocar updated", async () => {
    db.close();
    await Dexie.delete("clara-profile-accounts-test");
    const legacy = new Dexie("clara-profile-accounts-test");
    legacy.version(1).stores({ entries: "id,kind,date,updated", prefs: "id" });
    await legacy.open();
    await legacy.table("entries").bulkPut([
      cash,
      { ...cash, id: "acc-bank", title: "Débito", amount: 0 },
      tx({ id: "old", account: "Efectivo", updated: 111 }),
      tx({ id: "bank", account: "Débito", updated: 222 }),
      tx({ id: "suelto", account: "Cuenta que ya no existe", updated: 333 }),
    ]);
    legacy.close();

    await db.open();
    const migrated = await db.entries.get("old");
    expect(migrated?.accountId).toBe("acc-cash");
    expect(migrated?.updated).toBe(111);
    expect((await db.entries.get("bank"))?.accountId).toBe("acc-bank");
    expect((await db.entries.get("suelto"))?.accountId).toBeUndefined();
    expect(accountBalance(cash, await db.entries.toArray())).toBe(900);
  });
});
