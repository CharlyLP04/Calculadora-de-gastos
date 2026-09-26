import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  vi.stubGlobal("sessionStorage", { getItem: () => "transfers-test" });
});
import {
  db,
  accountBalance,
  saveTransfer,
  summarize,
  validEntries,
  removeEntry,
  type Entry,
} from "./data";

const account = (id: string, title: string, amount: number): Entry => ({
  id,
  kind: "account",
  title,
  amount,
  date: "2026-01-01",
  category: "Otros",
  account: "",
  updated: 1,
});
const cash = account("cash", "Efectivo", 2000);
const bank = account("bank", "Débito BBVA", 5000);

beforeEach(async () => {
  await db.entries.clear();
  await db.entries.bulkPut([cash, bank]);
});
afterAll(async () => {
  await db.delete();
});

describe("Traspasos entre cuentas", () => {
  it("mueve el saldo de una cuenta a otra sin crear dinero", async () => {
    await saveTransfer({
      amount: 1200,
      date: "2026-01-10",
      fromId: "bank",
      toId: "cash",
    });
    const all = await db.entries.toArray();
    expect(accountBalance(bank, all)).toBe(3800);
    expect(accountBalance(cash, all)).toBe(3200);
    // El total entre cuentas no cambia: es el punto de un traspaso.
    expect(accountBalance(bank, all) + accountBalance(cash, all)).toBe(7000);
  });

  it("no cuenta como ingreso ni como gasto del mes", async () => {
    await saveTransfer({
      amount: 1200,
      date: "2026-01-10",
      fromId: "bank",
      toId: "cash",
    });
    const all = await db.entries.toArray();
    const s = summarize(all, "2026-01", "2026-01-10", 0);
    expect(s.income).toBe(0);
    expect(s.expense).toBe(0);
    expect(s.balance).toBe(0);
    expect(s.tx).toHaveLength(0);
    expect(s.dayTx).toHaveLength(0);
  });

  it("rechaza montos no positivos, la misma cuenta y cuentas inexistentes", async () => {
    const base = {
      amount: 100,
      date: "2026-01-10",
      fromId: "bank",
      toId: "cash",
    };
    await expect(saveTransfer({ ...base, amount: 0 })).rejects.toThrow(
      "mayor a cero",
    );
    await expect(saveTransfer({ ...base, amount: -5 })).rejects.toThrow(
      "mayor a cero",
    );
    await expect(saveTransfer({ ...base, toId: "bank" })).rejects.toThrow(
      "distintas",
    );
    await expect(saveTransfer({ ...base, toId: "" })).rejects.toThrow(
      "origen y la de destino",
    );
    await expect(saveTransfer({ ...base, date: "10/01/2026" })).rejects.toThrow(
      "fecha",
    );
    await expect(saveTransfer({ ...base, toId: "no-existe" })).rejects.toThrow(
      "disponible",
    );
    expect(await db.entries.where("kind").equals("transfer").count()).toBe(0);
  });

  it("no acepta una cuenta borrada como origen ni como destino", async () => {
    await removeEntry(bank);
    await expect(
      saveTransfer({
        amount: 100,
        date: "2026-01-10",
        fromId: "bank",
        toId: "cash",
      }),
    ).rejects.toThrow("disponible");
    await expect(
      saveTransfer({
        amount: 100,
        date: "2026-01-10",
        fromId: "cash",
        toId: "bank",
      }),
    ).rejects.toThrow("disponible");
  });

  it("devuelve el saldo al eliminar el traspaso", async () => {
    await saveTransfer({
      amount: 1200,
      date: "2026-01-10",
      fromId: "bank",
      toId: "cash",
    });
    const transfer = await db.entries.where("kind").equals("transfer").first();
    await removeEntry(transfer!);
    const all = await db.entries.toArray();
    expect(accountBalance(bank, all)).toBe(5000);
    expect(accountBalance(cash, all)).toBe(2000);
  });

  it("edita un traspaso existente en vez de duplicarlo", async () => {
    await saveTransfer({
      id: "tr-1",
      amount: 1200,
      date: "2026-01-10",
      fromId: "bank",
      toId: "cash",
    });
    await saveTransfer({
      id: "tr-1",
      amount: 300,
      date: "2026-01-11",
      fromId: "cash",
      toId: "bank",
    });
    expect(await db.entries.where("kind").equals("transfer").count()).toBe(1);
    const all = await db.entries.toArray();
    expect(accountBalance(cash, all)).toBe(1700);
    expect(accountBalance(bank, all)).toBe(5300);
  });

  it("nombra el traspaso con las cuentas cuando no se escribe concepto", async () => {
    await saveTransfer({
      amount: 50,
      date: "2026-01-10",
      fromId: "bank",
      toId: "cash",
    });
    const transfer = await db.entries.where("kind").equals("transfer").first();
    expect(transfer?.title).toBe("Débito BBVA → Efectivo");
    expect(transfer?.accountId).toBe("bank");
    expect(transfer?.toAccountId).toBe("cash");
  });

  it("valida traspasos en respaldos y en la nube", async () => {
    const valid = {
      id: "tr",
      kind: "transfer",
      title: "A → B",
      amount: 100,
      date: "2026-01-10",
      category: "Traspaso",
      account: "A",
      accountId: "a",
      toAccountId: "b",
      updated: 1,
    };
    expect(validEntries([valid])).toBe(true);
    expect(validEntries([{ ...valid, toAccountId: "a" }])).toBe(false);
    expect(validEntries([{ ...valid, toAccountId: undefined }])).toBe(false);
    expect(validEntries([{ ...valid, accountId: undefined }])).toBe(false);
    expect(validEntries([{ ...valid, amount: 0 }])).toBe(false);
  });
});
