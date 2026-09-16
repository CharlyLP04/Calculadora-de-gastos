import "fake-indexeddb/auto";
import { beforeEach, afterAll, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => {
  vi.stubGlobal("sessionStorage", { getItem: () => "sync-test" });
  return {
    user: { uid: "ana" } as { uid: string } | null,
    records: new Map<string, any>(),
    reads: [] as string[],
    afterRead: undefined as (() => Promise<void>) | undefined,
  };
});
vi.mock("firebase/app", () => ({
  getApps: () => [{}],
  initializeApp: () => ({}),
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: mock.user }),
}));
vi.mock("firebase/firestore", () => {
  const path = (parent: any, ...parts: string[]) => ({
    path: [parent?.path, ...parts].filter(Boolean).join("/"),
  });
  const snap = (ref: any) => ({
    id: ref.path.split("/").at(-1),
    ref,
    exists: () => mock.records.has(ref.path),
    data: () => mock.records.get(ref.path),
  });
  return {
    getFirestore: () => ({}),
    doc: path,
    collection: path,
    query: (r: any) => r,
    limit: () => ({}),
    getDocs: vi.fn(),
    getDocFromServer: async (ref: any) => snap(ref),
    getDocsFromServer: async (ref: any) => {
      mock.reads.push(ref.path);
      await mock.afterRead?.();
      const docs = [...mock.records.keys()]
        .filter(
          (p) =>
            p.startsWith(ref.path + "/") &&
            p.slice(ref.path.length + 1).split("/").length === 1,
        )
        .map((p) => snap({ path: p }));
      return { docs, empty: docs.length === 0 };
    },
    runTransaction: async (_: any, action: any) =>
      action({
        get: async (ref: any) => snap(ref),
        set: (ref: any, data: any) => {
          mock.records.set(ref.path, data);
        },
      }),
  };
});
import { db, defaults } from "./data";
import { registry, pauseCloud } from "./profiles";
import { syncWithFirestore } from "./firebase";
const root = "clara_users/ana/profiles/personal";
const entry = {
  id: "coffee",
  kind: "transaction" as const,
  title: "Café",
  amount: 50,
  date: "2026-09-15",
  category: "Comida",
  account: "Efectivo",
  updated: 100,
};
beforeEach(async () => {
  mock.user = { uid: "ana" };
  mock.records.clear();
  mock.reads.length = 0;
  mock.afterRead = undefined;
  await db.entries.clear();
  await registry.profiles.clear();
  await db.prefs.put({ ...defaults, budget: 400, prefsUpdated: 100 });
  await registry.profiles.add({
    id: "sync-test",
    name: "Personal",
    created: 100,
    cloudEnabled: true,
    googleUid: "ana",
    cloudId: "personal",
  });
});
afterAll(async () => {
  await db.delete();
  await registry.delete();
});
it("uses only this profile's path and synchronizes its budget", async () => {
  await db.entries.put(entry);
  mock.records.set("clara_users/ana/profiles/work/entries/coffee", {
    ...entry,
    amount: 9999,
  });
  await syncWithFirestore();
  expect(mock.reads).toEqual([root + "/entries"]);
  expect(mock.records.get(root + "/entries/coffee").amount).toBe(50);
  expect(mock.records.get(root + "/preferences/main").budget).toBe(400);
  expect(
    mock.records.get("clara_users/ana/profiles/work/entries/coffee").amount,
  ).toBe(9999);
});
it("makes no Firestore requests for a local-only or mismatched account", async () => {
  await pauseCloud();
  await expect(syncWithFirestore()).rejects.toThrow("Conecta");
  await registry.profiles.update("sync-test", { cloudEnabled: true });
  mock.user = { uid: "luis" };
  await expect(syncWithFirestore()).rejects.toThrow("Conecta");
  expect(mock.reads).toHaveLength(0);
});
it("cancels pending downloads when Google is disconnected", async () => {
  mock.records.set(root + "/entries/coffee", entry);
  mock.afterRead = pauseCloud;
  await expect(syncWithFirestore()).rejects.toThrow();
  expect(await db.entries.count()).toBe(0);
  expect((await db.prefs.get("main"))?.lastSync).toBeUndefined();
});
it("preserves a newer local edit arriving during the network read", async () => {
  mock.records.set(root + "/entries/coffee", { ...entry, updated: 200 });
  mock.afterRead = async () => {
    await db.entries.put({ ...entry, amount: 75, updated: 300 });
  };
  await syncWithFirestore();
  expect((await db.entries.get("coffee"))?.amount).toBe(75);
  expect(mock.records.get(root + "/entries/coffee").updated).toBe(300);
});
it("downloads newer deletions and preferences without overwriting local privacy", async () => {
  await db.entries.put(entry);
  await db.prefs.update("main", { hidden: true });
  mock.records.set(root + "/entries/coffee", {
    ...entry,
    deleted: true,
    updated: 200,
  });
  mock.records.set(root + "/preferences/main", {
    budget: 1500,
    customCategories: ["Comida"],
    updated: 200,
  });
  await syncWithFirestore();
  expect((await db.entries.get("coffee"))?.deleted).toBe(true);
  expect((await db.prefs.get("main"))?.budget).toBe(1500);
  expect((await db.prefs.get("main"))?.hidden).toBe(true);
});
it("rejects malformed remote records without marking them synchronized", async () => {
  mock.records.set(root + "/entries/coffee", { ...entry, amount: -1 });
  await expect(syncWithFirestore()).rejects.toThrow("no válido");
  expect(await db.entries.count()).toBe(0);
  expect((await db.prefs.get("main"))?.lastSync).toBeUndefined();
});
