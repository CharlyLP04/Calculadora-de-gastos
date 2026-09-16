import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
let env;
const entry = {
  id: "coffee",
  kind: "transaction",
  title: "Café",
  amount: 50,
  date: "2026-09-15",
  category: "Comida",
  account: "Efectivo",
  updated: 100,
};
const root = "clara_users/ana/profiles/personal";
const claims = { firebase: { sign_in_provider: "google.com" } };
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-clara-profiles",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
after(async () => {
  await env?.cleanup();
});
test("owner can save and query only her scoped records", async () => {
  const own = env.authenticatedContext("ana", claims).firestore();
  await assertSucceeds(
    setDoc(doc(own, root), { name: "Personal", created: Date.now() }),
  );
  await assertSucceeds(setDoc(doc(own, root, "entries", "coffee"), entry));
  await assertSucceeds(getDocs(collection(own, root, "entries")));
  await assertSucceeds(getDocs(collection(own, "clara_users/ana/profiles")));
  await assertSucceeds(
    setDoc(doc(own, root, "preferences", "main"), {
      budget: 1000,
      customCategories: ["Comida"],
      updated: 100,
    }),
  );
});
test("guest, anonymous auth and another Google account cannot read or write Ana's data", async () => {
  const contexts = [
    env.unauthenticatedContext(),
    env.authenticatedContext("luis", claims),
    env.authenticatedContext("ana", {
      firebase: { sign_in_provider: "anonymous" },
    }),
  ];
  for (const context of contexts) {
    const db = context.firestore();
    for (const path of [
      root,
      root + "/entries/coffee",
      root + "/preferences/main",
    ]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), entry));
    }
    await assertFails(getDocs(collection(db, "clara_users/ana/profiles")));
  }
});
test("rejects negative amounts, unknown fields, wrong IDs and stale edits", async () => {
  const db = env.authenticatedContext("ana", claims).firestore();
  const target = doc(db, root, "entries", "coffee");
  await assertFails(setDoc(target, { ...entry, amount: -1 }));
  await assertFails(setDoc(target, { ...entry, uid: "luis" }));
  await assertFails(setDoc(target, { ...entry, id: "other" }));
  await assertFails(setDoc(target, { ...entry, updated: 1 }));
  await assertFails(updateDoc(target, { kind: "invalid" }));
  await assertSucceeds(updateDoc(target, { deleted: true, updated: 101 }));
  await assertFails(deleteDoc(target));
});
test("validates profile and preferences on create AND update", async () => {
  const db = env.authenticatedContext("ana", claims).firestore();
  await assertFails(setDoc(doc(db, root), { name: "" }));
  await assertFails(updateDoc(doc(db, root), { created: -1 }));
  await assertFails(
    setDoc(doc(db, root, "preferences", "main"), {
      budget: -1,
      customCategories: [],
      updated: 100,
    }),
  );
  await assertFails(
    updateDoc(doc(db, root, "preferences", "main"), { updated: 0 }),
  );
  await assertFails(
    setDoc(doc(db, root, "preferences", "other"), {
      budget: 10,
      customCategories: [],
      updated: 100,
    }),
  );
});
test("legacy data can only be recovered by its owner, never written by old clients", async () => {
  await env.withSecurityRulesDisabled(async (context) =>
    setDoc(doc(context.firestore(), "clara_users/ana/entries/coffee"), entry),
  );
  const own = env.authenticatedContext("ana", claims).firestore();
  const other = env.authenticatedContext("luis", claims).firestore();
  await assertSucceeds(getDocs(collection(own, "clara_users/ana/entries")));
  await assertFails(getDoc(doc(other, "clara_users/ana/entries/coffee")));
  await assertFails(setDoc(doc(own, "clara_users/ana/entries/coffee"), entry));
});
