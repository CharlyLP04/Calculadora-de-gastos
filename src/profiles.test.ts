import "fake-indexeddb/auto";
import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  const values = new Map([["clara-active-profile", "test-active"]]);
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) || null,
  });
});
import { Database, db, defaults, saveEntry, wipeAllData } from "./data";
import {
  registry,
  initializeProfiles,
  createProfile,
  linkProfile,
  pauseCloud,
  cloudScope,
  profileDatabaseName,
  renameProfile,
  deleteProfile,
} from "./profiles";
const other = new Database("test-other");
const legacy = new Database("legacy");
beforeEach(async () => {
  await Promise.all([
    db.entries.clear(),
    db.prefs.clear(),
    other.entries.clear(),
    other.prefs.clear(),
    registry.profiles.clear(),
  ]);
  await registry.profiles.add({ id: "test-active", name: "Ana", created: 1 });
});
afterAll(async () => {
  await Promise.all([
    db.delete(),
    other.delete(),
    legacy.delete(),
    registry.delete(),
  ]);
});
describe("perfiles locales", () => {
  it("aísla movimientos, cuentas y preferencias incluso con el mismo ID", async () => {
    const entry = {
      id: "same",
      kind: "transaction" as const,
      title: "Café",
      amount: 50,
      date: "2026-09-15",
      account: "Efectivo",
      category: "Comida",
    };
    await saveEntry(entry);
    await other.entries.put({ ...entry, amount: 900, updated: 1 });
    await db.prefs.put({ ...defaults, budget: 1200, hidden: true });
    await other.prefs.put({ ...defaults, budget: 6500, hidden: false });
    expect((await db.entries.get("same"))?.amount).toBe(50);
    expect((await other.entries.get("same"))?.amount).toBe(900);
    expect((await db.prefs.get("main"))?.budget).toBe(1200);
    expect((await other.prefs.get("main"))?.hidden).toBe(false);
    db.close();
    await db.open();
    expect((await db.entries.get("same"))?.amount).toBe(50);
  });
  it("conserva la base anterior sin inferir una cuenta Google", async () => {
    await legacy.prefs.put({ ...defaults, budget: 731 });
    await initializeProfiles();
    await initializeProfiles();
    expect((await registry.profiles.get("legacy"))?.googleUid).toBeUndefined();
    expect((await legacy.prefs.get("main"))?.budget).toBe(731);
    expect(profileDatabaseName("legacy")).toBe("crystal-finanzas");
    expect(await registry.profiles.where("id").equals("legacy").count()).toBe(
      1,
    );
  });
  it("crea perfiles locales sin activar Google y lista por fecha", async () => {
    const a = await createProfile("  Trabajo  ");
    const b = await createProfile("Trabajo");
    expect(a.name).toBe("Trabajo");
    expect(a.id).not.toBe(b.id);
    expect(a.cloudEnabled).toBeUndefined();
    expect((await registry.profiles.orderBy("created").toArray()).length).toBe(
      3,
    );
    await expect(createProfile("   ")).rejects.toThrow();
  });
  it("no permite cambiar la cuenta dueña de un perfil ya vinculado", async () => {
    await linkProfile("google-ana", "ana@example.test");
    await pauseCloud();
    expect(
      cloudScope(await registry.profiles.get("test-active"), "google-ana"),
    ).toBeNull();
    await expect(
      linkProfile("google-luis", "luis@example.test"),
    ).rejects.toThrow("vinculado");
    await linkProfile("google-ana", "ana@example.test");
    const profile = await registry.profiles.get("test-active");
    expect(cloudScope(profile, "google-luis")).toBeNull();
    expect(cloudScope(profile, undefined)).toBeNull();
    expect(cloudScope(profile, "google-ana")).toEqual({
      uid: "google-ana",
      profileId: "test-active",
    });
  });
  it("vaciar un perfil mantiene tombstones y no toca otros perfiles", async () => {
    const e = {
      id: "expense",
      kind: "transaction" as const,
      title: "Café",
      amount: 50,
      date: "2026-09-15",
      account: "Efectivo",
      category: "Comida",
      updated: 1,
    };
    await db.entries.put(e);
    await other.entries.put(e);
    await wipeAllData();
    expect((await db.entries.get(e.id))?.deleted).toBe(true);
    expect((await other.entries.get(e.id))?.deleted).toBeUndefined();
    expect((await db.prefs.get("main"))?.prefsUpdated).toBeGreaterThan(1);
  });
  it("permite renombrar un perfil local", async () => {
    const p = await createProfile("Gastos Viejos");
    await renameProfile(p.id, "Personal");
    expect((await registry.profiles.get(p.id))?.name).toBe("Personal");
    await expect(renameProfile(p.id, "   ")).rejects.toThrow();
    await expect(renameProfile("non-existent", "Nuevo")).rejects.toThrow();
  });
  it("permite eliminar un perfil y purgar su almacenamiento", async () => {
    const p = await createProfile("Temporal");
    expect(await registry.profiles.get(p.id)).toBeDefined();
    await deleteProfile(p.id);
    expect(await registry.profiles.get(p.id)).toBeUndefined();
    await expect(deleteProfile("non-existent")).rejects.toThrow();
  });
});

