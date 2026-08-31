import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { prisma } from "./prisma";
import { NOT_VOIDED, LOW_STOCK_THRESHOLD, getMovementByItem, EMPTY_MOVEMENT } from "./inventory";

/**
 * Inventory report generation, extracted from the route handler so both the
 * download endpoint and the Drive upload endpoint build the same document from
 * the same data. The Drive route previously re-uploaded bytes supplied by the
 * browser, which meant the server never saw what it was archiving.
 */

export interface ReportOptions {
  /** Inclusive start of the trend/movement window. */
  from: Date;
  /** Exclusive end of the trend/movement window. */
  to: Date;
}

export interface ItemSummary {
  name: string;
  code: string;
  category: string;
  stock: number;
  purchased: number;
  used: number;
  broken: number;
}

export interface ReportData {
  options: ReportOptions;
  summary: {
    totalItems: number;
    totalStock: number;
    outOfStockCount: number;
    lowStockCount: number;
  };
  categoryBreakdown: {
    name: string;
    itemCount: number;
    stock: number;
    purchased: number;
    used: number;
    broken: number;
  }[];
  trends: { month: string; purchased: number; used: number; broken: number }[];
  topUsed: ItemSummary[];
  needsAttention: ItemSummary[];
  itemSummaries: ItemSummary[];
}

export function defaultReportRange(): ReportOptions {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 6);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/**
 * Loads everything the report needs.
 *
 * Lifetime movement totals come from a single grouped aggregate rather than by
 * pulling every log row into memory (which the old version did three separate
 * times over). Only the trend window actually needs individual rows, and it is
 * bounded by date.
 */
export async function gatherReportData(
  options: ReportOptions = defaultReportRange()
): Promise<ReportData> {
  const [items, trendLogs] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryLog.groupBy({
      by: ["action", "date"],
      where: {
        ...NOT_VOIDED,
        date: { gte: options.from, lte: options.to },
      },
      _sum: { quantity: true },
    }),
  ]);

  const movement = await getMovementByItem(items.map((i) => i.id));

  const itemSummaries: ItemSummary[] = items.map((item) => {
    const m = movement.get(item.id) ?? EMPTY_MOVEMENT;
    return {
      name: item.name,
      code: item.code,
      category: item.category.name,
      stock: m.stock,
      purchased: m.purchased,
      used: m.used,
      broken: m.broken,
    };
  });

  let totalStock = 0;
  let outOfStockCount = 0;
  let lowStockCount = 0;
  for (const item of itemSummaries) {
    totalStock += item.stock;
    if (item.stock <= 0) outOfStockCount++;
    else if (item.stock <= LOW_STOCK_THRESHOLD) lowStockCount++;
  }

  const categoryMap = new Map<string, ReportData["categoryBreakdown"][number]>();
  for (const item of itemSummaries) {
    const entry = categoryMap.get(item.category) ?? {
      name: item.category,
      itemCount: 0,
      stock: 0,
      purchased: 0,
      used: 0,
      broken: 0,
    };
    entry.itemCount += 1;
    entry.stock += item.stock;
    entry.purchased += item.purchased;
    entry.used += item.used;
    entry.broken += item.broken;
    categoryMap.set(item.category, entry);
  }

  const monthly = new Map<
    string,
    { purchased: number; used: number; broken: number }
  >();
  for (const row of trendLogs) {
    const key = monthKey(row.date);
    const entry = monthly.get(key) ?? { purchased: 0, used: 0, broken: 0 };
    const quantity = row._sum.quantity ?? 0;
    if (row.action === "PURCHASED") entry.purchased += quantity;
    else if (row.action === "USED") entry.used += quantity;
    else if (row.action === "BROKEN") entry.broken += quantity;
    monthly.set(key, entry);
  }

  const trends = Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  return {
    options,
    summary: {
      totalItems: items.length,
      totalStock,
      outOfStockCount,
      lowStockCount,
    },
    categoryBreakdown: Array.from(categoryMap.values())
      .filter((c) => c.itemCount > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
    trends,
    topUsed: [...itemSummaries]
      .filter((i) => i.used > 0)
      .sort((a, b) => b.used - a.used)
      .slice(0, 5),
    needsAttention: itemSummaries
      .filter((i) => i.stock <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.stock - b.stock),
    itemSummaries,
  };
}

type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };

const HEAD_FILL: [number, number, number] = [51, 65, 85];
const GREEN: [number, number, number] = [22, 163, 74];
const BLUE: [number, number, number] = [37, 99, 235];
const RED: [number, number, number] = [220, 38, 38];
const AMBER: [number, number, number] = [245, 158, 11];

export function buildReportPdf(data: ReportData): ArrayBuffer {
  const doc = new jsPDF() as AutoTableDoc;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Inventory Report", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `Generated ${now.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })} at ${now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    pageWidth / 2,
    27,
    { align: "center" }
  );
  doc.text(
    `Movement window: ${data.options.from.toLocaleDateString("en-GB")} to ${data.options.to.toLocaleDateString("en-GB")}`,
    pageWidth / 2,
    32,
    { align: "center" }
  );
  doc.setTextColor(0);

  let y = 40;
  const boxW = 42;
  const boxH = 18;
  const startX = (pageWidth - boxW * 4 - 6 * 3) / 2;
  const tiles: { label: string; value: string; color: [number, number, number] }[] =
    [
      { label: "Total Items", value: String(data.summary.totalItems), color: [59, 130, 246] },
      { label: "Total Stock", value: String(data.summary.totalStock), color: [16, 185, 129] },
      { label: "Out of Stock", value: String(data.summary.outOfStockCount), color: RED },
      { label: "Low Stock", value: String(data.summary.lowStockCount), color: AMBER },
    ];

  tiles.forEach((tile, i) => {
    const x = startX + i * (boxW + 6);
    doc.setFillColor(...tile.color);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255);
    doc.text(tile.value, x + boxW / 2, y + 10, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(tile.label, x + boxW / 2, y + 15, { align: "center" });
  });
  doc.setTextColor(0);
  y += boxH + 10;

  function sectionHeading(title: string, minSpace = 230) {
    if (y > minSpace) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(title, 14, y);
    y += 3;
  }

  function advanceAfterTable() {
    y = (doc.lastAutoTable?.finalY ?? y + 30) + 8;
  }

  if (data.trends.length > 0) {
    sectionHeading("Monthly Trends");
    autoTable(doc, {
      startY: y,
      head: [["Month", "Purchased", "Used", "Broken", "Net Change"]],
      body: data.trends.map((t) => {
        const net = t.purchased - t.used - t.broken;
        return [
          formatMonth(t.month),
          `+${t.purchased}`,
          `-${t.used}`,
          `-${t.broken}`,
          `${net >= 0 ? "+" : ""}${net}`,
        ];
      }),
      headStyles: { fillColor: HEAD_FILL, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        1: { textColor: GREEN },
        2: { textColor: BLUE },
        3: { textColor: RED },
        4: { fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
    });
    advanceAfterTable();
  }

  if (data.categoryBreakdown.length > 0) {
    sectionHeading("Category Breakdown");
    autoTable(doc, {
      startY: y,
      head: [["Category", "Items", "Stock", "Purchased", "Used", "Broken"]],
      body: data.categoryBreakdown.map((c) => [
        c.name,
        c.itemCount,
        c.stock,
        c.purchased,
        c.used,
        c.broken,
      ]),
      headStyles: { fillColor: HEAD_FILL, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        3: { textColor: GREEN },
        4: { textColor: BLUE },
        5: { textColor: RED },
      },
      margin: { left: 14, right: 14 },
    });
    advanceAfterTable();
  }

  if (data.topUsed.length > 0) {
    sectionHeading("Top 5 Most Used Items");
    autoTable(doc, {
      startY: y,
      head: [["Item", "Category", "Total Used", "Current Stock"]],
      body: data.topUsed.map((i) => [i.name, i.category, i.used, i.stock]),
      headStyles: { fillColor: HEAD_FILL, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    advanceAfterTable();
  }

  if (data.needsAttention.length > 0) {
    sectionHeading("Items Needing Attention");
    autoTable(doc, {
      startY: y,
      head: [["Item", "Category", "Current Stock", "Status"]],
      body: data.needsAttention.map((i) => [
        i.name,
        i.category,
        i.stock,
        i.stock <= 0 ? "OUT OF STOCK" : "LOW STOCK",
      ]),
      headStyles: { fillColor: HEAD_FILL, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 3) {
          const raw = hookData.row.raw as unknown[];
          hookData.cell.styles.textColor =
            raw?.[3] === "OUT OF STOCK" ? RED : AMBER;
          hookData.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 14, right: 14 },
    });
    advanceAfterTable();
  }

  if (data.itemSummaries.length > 0) {
    sectionHeading("Complete Item Summary", 200);
    autoTable(doc, {
      startY: y,
      head: [["Code", "Item", "Category", "Stock", "Purchased", "Used", "Broken"]],
      body: data.itemSummaries.map((i) => [
        i.code,
        i.name,
        i.category,
        i.stock,
        i.purchased,
        i.used,
        i.broken,
      ]),
      headStyles: { fillColor: HEAD_FILL, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, {
      align: "center",
    });
    doc.text("KVMHSS Ticket Tracker — Inventory Report", 14, pageHeight - 8);
  }

  return doc.output("arraybuffer");
}

export function reportFileName(date = new Date()): string {
  return `inventory-report-${date.toISOString().split("T")[0]}.pdf`;
}
