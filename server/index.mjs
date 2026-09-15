import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const token = process.env.SYNC_TOKEN;
if (!token || token.length < 32)
  throw new Error("Define SYNC_TOKEN con al menos 32 caracteres aleatorios.");
const dataDir = process.env.DATA_DIR || path.join(root, "data");
mkdirSync(dataDir, { recursive: true });
export const db = new DatabaseSync(path.join(dataDir, "crystal.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, updated REAL NOT NULL, payload TEXT NOT NULL)",
);
const select = db.prepare("SELECT payload FROM entries"),
  upsert = db.prepare(
    "INSERT INTO entries VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,payload=excluded.payload WHERE excluded.updated > entries.updated",
  );
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store");
    const allowed = process.env.ALLOWED_ORIGIN;
    if (req.headers.origin && allowed && req.headers.origin !== allowed)
      return res.sendStatus(403);
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", allowed);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    const supplied = Buffer.from(req.headers.authorization || ""),
      expected = Buffer.from(`Bearer ${token}`);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return res.sendStatus(401);
  }
  next();
});
app.use(express.json({ limit: "20mb" }));
app.post("/api/sync", (req, res) => {
  const rows = req.body?.entries;
  if (
    !Array.isArray(rows) ||
    rows.length > 100000 ||
    rows.some(
      (e) =>
        !e ||
        typeof e.id !== "string" ||
        e.id.length > 100 ||
        !["transaction", "fixed", "debt", "account"].includes(e.kind) ||
        typeof e.title !== "string" ||
        e.title.length > 200 ||
        !Number.isFinite(e.amount) ||
        e.amount < 0 ||
        e.amount > 1e12 ||
        !Number.isFinite(e.updated) ||
        e.updated > Date.now() + 300000 ||
        typeof e.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
        typeof e.category !== "string" ||
        typeof e.account !== "string" ||
        (e.direction !== undefined &&
          !["income", "expense"].includes(e.direction)) ||
        (e.deleted !== undefined && typeof e.deleted !== "boolean") ||
        ["total", "initialPaid", "monthly"].some(
          (k) =>
            e[k] !== undefined &&
            (!Number.isFinite(e[k]) || e[k] < 0 || e[k] > 1e12),
        ) ||
        (e.kind === "debt" &&
          (!(e.total > 0) || (e.initialPaid || 0) > e.total)),
    )
  )
    return res.status(400).json({ error: "Datos no válidos" });
  try {
    db.exec("BEGIN IMMEDIATE");
    for (const e of rows) upsert.run(e.id, e.updated, JSON.stringify(e));
    db.exec("COMMIT");
    res.json({ entries: select.all().map((r) => JSON.parse(r.payload)) });
  } catch (error) {
    db.exec("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "No se pudo guardar" });
  }
});
app.use(express.static(path.join(root, "../dist")));
app.use((req, res) => res.sendFile(path.join(root, "../dist/index.html")));
export const server = app.listen(
  process.env.PORT === "0" ? 0 : Number(process.env.PORT) || 3000,
  process.env.HOST || "127.0.0.1",
  () => console.log("Clara listo en el puerto " + (process.env.PORT || 3000)),
);

