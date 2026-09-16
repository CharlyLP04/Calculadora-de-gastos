import {
  db,
  validEntries,
  type Entry,
  type Prefs,
  summarize,
  money,
  debtRemaining,
} from "./data";
export function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const safe = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
export async function exportReport(
  format: "csv" | "xlsx" | "pdf" | "json",
  entries: Entry[],
  prefs: Prefs,
  month: string,
) {
  if (format === "json") {
    download(
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          entries: await db.entries.toArray(),
          budget: prefs.budget,
        },
        null,
        2,
      ),
      "clara-respaldo.json",
      "application/json",
    );
    return;
  }
  const s = summarize(entries, month, month + "-01", prefs.budget);
  const rows = s.tx.map((e) => ({
    Fecha: e.date,
    Concepto: safe(e.title),
    Categoría: safe(e.category),
    Cuenta: safe(e.account),
    Tipo: e.direction === "income" ? "Ingreso" : "Gasto",
    Monto: e.amount,
  }));
  if (format === "csv") {
    const fields = [
      "Fecha",
      "Concepto",
      "Categoría",
      "Cuenta",
      "Tipo",
      "Monto",
    ];
    download(
      "\uFEFF" +
        [fields, ...rows.map((r) => Object.values(r))]
          .map((r) =>
            r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
          )
          .join("\r\n"),
      `clara-${month}.csv`,
      "text/csv;charset=utf-8",
    );
  }
  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          Mes: month,
          Ingresos: s.income,
          Gastos: s.expense,
          Balance: s.balance,
          Presupuesto: prefs.budget,
          Fijos: s.fixed,
        },
      ]),
      "Resumen mensual",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Movimientos",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        entries
          .filter((e) => !e.deleted && e.kind === "debt")
          .map((e) => ({
            Deuda: safe(e.title),
            Total: e.total,
            PagadoInicial: e.initialPaid,
            SaldoPendiente: debtRemaining(e, entries),
            CuotaMensual: e.monthly,
          })),
      ),
      "Deudas",
    );
    XLSX.writeFile(wb, `clara-${month}.xlsx`);
  }
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFillColor("#0A0F1D");
    doc.rect(0, 0, 210, 56, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFontSize(26);
    doc.text("Clara", 20, 26);
    doc.setFontSize(12);
    doc.text(`Resumen mensual / ${month} / MXN`, 20, 40);
    doc.setTextColor("#273869");
    let y = 78;
    for (const [label, value] of [
      ["Ingresos registrados", s.income],
      ["Gastos registrados", s.expense],
      ["Balance neto", s.balance],
      ["Presupuesto mensual", prefs.budget],
      ["Compromisos fijos mensuales", s.fixed + s.debtMonthly],
    ] as const) {
      doc.setFontSize(12);
      doc.text(label, 20, y);
      doc.text(money(value), 190, y, { align: "right" });
      y += 14;
    }
    doc.setFontSize(16);
    doc.text("Gastos por categoría", 20, y + 12);
    y += 26;
    const totals = new Map<string, number>();
    s.tx
      .filter((e) => e.direction !== "income")
      .forEach((e) =>
        totals.set(e.category, (totals.get(e.category) || 0) + e.amount),
      );
    for (const [label, value] of [...totals]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)) {
      doc.setFontSize(11);
      doc.text(label, 20, y);
      doc.text(money(value), 190, y, { align: "right" });
      y += 10;
    }
    doc.setFontSize(9);
    doc.setTextColor("#64748b");
    doc.text(
      "Los compromisos planificados no se contabilizan como pagos realizados.",
      20,
      276,
    );
    doc.save(`clara-${month}.pdf`);
  }
}
export async function restoreBackup(file: File) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("El respaldo supera 20 MB.");
  const data = JSON.parse(await file.text());
  if (
    data.version !== 1 ||
    !validEntries(data.entries) ||
    typeof data.budget !== "number" ||
    !Number.isFinite(data.budget) ||
    data.budget < 0
  )
    throw new Error("El archivo no es un respaldo válido de Clara.");
  await db.transaction("rw", db.entries, db.prefs, async () => {
    const now = Date.now();
    const existing = await db.entries.toArray();
    const restored = new Set(data.entries.map((e: Entry) => e.id));
    await db.entries.bulkPut(
      existing
        .filter((e) => !restored.has(e.id))
        .map((e) => ({ ...e, deleted: true, updated: now })),
    );
    await db.entries.bulkPut(
      data.entries.map((e: Entry) => ({ ...e, updated: now })),
    );
    await db.prefs.update("main", { budget: data.budget, prefsUpdated: now });
  });
}
