import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
process.env.SYNC_TOKEN = randomBytes(32).toString("hex");
process.env.PORT = "0";
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "crystal-test-"));
process.env.ALLOWED_ORIGIN = "https://crystal.example";
const { server, db } = await import("./index.mjs");
try {
  if (!server.listening) await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}/api/sync`;
  const send = (entries, authorized = true) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorized
          ? { Authorization: `Bearer ${process.env.SYNC_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ entries }),
    });
  assert.equal((await send([], false)).status, 401);
  assert.equal((await send([{ id: "bad" }])).status, 400);
  const entry = {
    id: "test",
    kind: "transaction",
    title: "Test",
    amount: 125.5,
    date: "2026-09-14",
    category: "Otros",
    account: "Efectivo",
    updated: 1,
    direction: "expense",
  };
  assert.equal((await (await send([entry])).json()).entries[0].amount, 125.5);
  await send([{ ...entry, amount: 200, updated: 2 }]);
  assert.equal((await (await send([entry])).json()).entries[0].amount, 200);
  await send([{ ...entry, deleted: true, updated: 3 }]);
  assert.equal((await (await send([entry])).json()).entries[0].deleted, true);
  assert.equal(
    (
      await fetch(url, {
        method: "OPTIONS",
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  console.log(
    "PASS: authentication, validation, round-trip, conflict resolution, deletion tombstones, CORS",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  db.close();
}
