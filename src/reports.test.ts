import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  vi.stubGlobal("sessionStorage", { getItem: () => "reports-test" });
});
import { db, defaults, getCategories, type Entry } from "./data";
import { restoreBackup } from "./reports";

const entry: Entry = {
  id: "coffee",
  kind: "transaction",
  title: "Café",
  amount: 50,
  date: "2026-09-15",
  category: "Ahorro viaje",
  account: "Efectivo",
  updated: 100,
  direction: "expense",
};
const backup = (over: Record<string, unknown> = {}) =>
  ({
    text: async () =>
      JSON.stringify({
        version: 1,
        exportedAt: "2026-09-15T00:00:00.000Z",
        entries: [entry],
        budget: 8000,
        ...over,
      }),
    size: 500,
  }) as unknown as File;

beforeEach(async () => {
  await db.entries.clear();
  await db.prefs.clear();
});
afterAll(async () => {
  await db.delete();
});

describe("Respaldo JSON", () => {
  it("restaura las categorías personalizadas junto con los movimientos", async () => {
    await restoreBackup(
      backup({ customCategories: ["Ahorro viaje", "Renta"] }),
    );
    const prefs = await db.prefs.get("main");
    expect(prefs?.budget).toBe(8000);
    expect(getCategories(prefs)).toEqual(["Ahorro viaje", "Renta"]);
    expect((await db.entries.get("coffee"))?.amount).toBe(50);
  });

  it("guarda el presupuesto aunque no existiera el registro de preferencias", async () => {
    // update() no crea el registro; antes el presupuesto se perdía en silencio
    // al restaurar en un dispositivo recién estrenado.
    expect(await db.prefs.get("main")).toBeUndefined();
    await restoreBackup(backup());
    expect((await db.prefs.get("main"))?.budget).toBe(8000);
  });

  it("acepta respaldos anteriores, sin categorías, sin perder las actuales", async () => {
    await db.prefs.put({ ...defaults, customCategories: ["Propia"] });
    await restoreBackup(backup());
    expect(getCategories(await db.prefs.get("main"))).toEqual(["Propia"]);
  });

  it("rechaza categorías mal formadas sin tocar nada", async () => {
    await db.prefs.put({ ...defaults, budget: 123 });
    for (const bad of [[], [""], [1, 2], ["x".repeat(81)], "Comida"]) {
      await expect(
        restoreBackup(backup({ customCategories: bad })),
      ).rejects.toThrow("no es un respaldo válido");
    }
    expect((await db.prefs.get("main"))?.budget).toBe(123);
    expect(await db.entries.count()).toBe(0);
  });

  it("marca como eliminado lo que no viene en el respaldo", async () => {
    await db.entries.put({ ...entry, id: "viejo" });
    await restoreBackup(backup());
    expect((await db.entries.get("viejo"))?.deleted).toBe(true);
    expect((await db.entries.get("coffee"))?.deleted).toBeUndefined();
  });
});
