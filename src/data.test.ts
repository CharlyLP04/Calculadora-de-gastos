import { describe, it, expect } from "vitest";
import {
  summarize,
  summarizeDays,
  daysInMonth,
  debtRemaining,
  validEntries,
  type Entry,
} from "./data";
const base: Entry = {
  id: "1",
  kind: "transaction",
  title: "Test",
  amount: 100,
  date: "2024-02-10",
  category: "Otros",
  account: "Efectivo",
  updated: 1,
  direction: "expense",
};
describe("Cálculos financieros", () => {
  it("prorratea con los días reales de febrero bisiesto", () => {
    expect(daysInMonth("2024-02")).toBe(29);
    expect(daysInMonth("2025-02")).toBe(28);
    const s = summarize(
      [{ ...base, kind: "fixed", amount: 2900 }],
      "2024-02",
      "2024-02-10",
      5800,
    );
    expect(s.committed).toBe(100);
    expect(s.allowance).toBe(100);
    expect(s.expense).toBe(0);
  });
  it("separa reservas de gastos realizados y excluye otros meses y eliminados", () => {
    const s = summarize(
      [
        base,
        { ...base, id: "2", amount: 500, direction: "income" },
        { ...base, id: "3", amount: 900, deleted: true },
        { ...base, id: "4", date: "2024-03-01" },
      ],
      "2024-02",
      "2024-02-10",
      0,
    );
    expect(s.balance).toBe(400);
    expect(s.expense).toBe(100);
    expect(s.dayExpense).toBe(100);
    expect(s.allowance).toBe(0);
  });
  it("abonos reducen deuda y eliminar un pago recupera el saldo", () => {
    const d: Entry = {
      ...base,
      id: "debt",
      kind: "debt",
      amount: 0,
      total: 1000,
      initialPaid: 200,
      monthly: 100,
    };
    expect(debtRemaining(d, [{ ...base, debtId: "debt" }])).toBe(700);
    expect(debtRemaining(d, [{ ...base, debtId: "debt", deleted: true }])).toBe(
      800,
    );
    expect(
      debtRemaining(d, [{ ...base, debtId: "debt", direction: "income" }]),
    ).toBe(800);
  });
  it("rechaza respaldos inválidos y duplicados", () => {
    expect(validEntries([base])).toBe(true);
    expect(validEntries([base, base])).toBe(false);
    expect(validEntries([{ ...base, amount: -1 }])).toBe(false);
    expect(validEntries([{ ...base, kind: "unknown" }])).toBe(false);
    expect(
      validEntries([{ ...base, kind: "debt", total: 100, initialPaid: 200 }]),
    ).toBe(false);
  });
});
describe("Resumen por días del calendario", () => {
  it("cuenta lo mismo que summarize día por día, en un solo recorrido", () => {
    const entries: Entry[] = [
      { ...base, id: "a", date: "2024-02-10", amount: 100 },
      { ...base, id: "b", date: "2024-02-10", amount: 50 },
      {
        ...base,
        id: "c",
        date: "2024-02-10",
        amount: 900,
        direction: "income",
      },
      { ...base, id: "d", date: "2024-02-12", amount: 30 },
      { ...base, id: "e", date: "2024-02-12", amount: 70, deleted: true },
      { ...base, id: "f", date: "2024-03-01", amount: 500 },
      { ...base, id: "g", kind: "fixed", date: "2024-02-10", amount: 2900 },
    ];
    const { allowance, byDay } = summarizeDays(entries, "2024-02", 5800);
    expect(allowance).toBe(
      summarize(entries, "2024-02", "2024-02-01", 5800).allowance,
    );
    for (const day of ["2024-02-10", "2024-02-12", "2024-02-11"]) {
      const reference = summarize(entries, "2024-02", day, 5800);
      expect(byDay.get(day)?.expense || 0).toBe(reference.dayExpense);
      expect(byDay.get(day)?.count || 0).toBe(reference.dayTx.length);
    }
    // Un mes distinto no se cuela en el calendario.
    expect(byDay.has("2024-03-01")).toBe(false);
  });
});
