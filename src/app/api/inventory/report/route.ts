import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function formatMonth(month: string) {
  const [year, m] = month.split("-");
  const date = new Date(parseInt(year), parseInt(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function gatherReportData(
  items: Awaited<ReturnType<typeof fetchData>>["items"],
  recentLogs: Awaited<ReturnType<typeof fetchData>>["recentLogs"],
  categories: Awaited<ReturnType<typeof fetchData>>["categories"],
) {
  let totalStock = 0;
  let outOfStockCount = 0;
  let lowStockCount = 0;
  const itemSummaries: { name: string; category: string; stock: number; purchased: number; used: number; broken: number }[] = [];

  for (const item of items) {
    let stock = 0, purchased = 0, used = 0, broken = 0;
    for (const log of item.logs) {
      if (log.action === "PURCHASED") { stock += log.quantity; purchased += log.quantity; }
      else if (log.action === "USED") { stock -= log.quantity; used += log.quantity; }
      else if (log.action === "BROKEN") { stock -= log.quantity; broken += log.quantity; }
    }
    totalStock += stock;
    if (stock <= 0) outOfStockCount++;
    else if (stock <= 5) lowStockCount++;
    itemSummaries.push({ name: item.name, category: item.category.name, stock, purchased, used, broken });
  }

  const categoryBreakdown = categories.map((cat) => {
    let catStock = 0, catPurchased = 0, catUsed = 0, catBroken = 0;
    for (const item of cat.items) {
      for (const log of item.logs) {
        if (log.action === "PURCHASED") { catStock += log.quantity; catPurchased += log.quantity; }
        else if (log.action === "USED") { catStock -= log.quantity; catUsed += log.quantity; }
        else if (log.action === "BROKEN") { catStock -= log.quantity; catBroken += log.quantity; }
      }
    }
    return { name: cat.name, itemCount: cat.items.length, stock: catStock, purchased: catPurchased, used: catUsed, broken: catBroken };
  }).filter((c) => c.itemCount > 0);

  const monthlyTrends: Record<string, { purchased: number; used: number; broken: number }> = {};
  for (const log of recentLogs) {
    const key = `${log.date.getFullYear()}-${String(log.date.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyTrends[key]) monthlyTrends[key] = { purchased: 0, used: 0, broken: 0 };
    if (log.action === "PURCHASED") monthlyTrends[key].purchased += log.quantity;
    else if (log.action === "USED") monthlyTrends[key].used += log.quantity;
    else if (log.action === "BROKEN") monthlyTrends[key].broken += log.quantity;
  }

  const trends = Object.entries(monthlyTrends)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  const topUsed = [...itemSummaries].sort((a, b) => b.used - a.used).slice(0, 5);
  const needsAttention = itemSummaries.filter((i) => i.stock <= 5).sort((a, b) => a.stock - b.stock);

  return {
    summary: { totalItems: items.length, totalStock, outOfStockCount, lowStockCount },
    categoryBreakdown,
    trends,
    topUsed,
    needsAttention,
    itemSummaries,
  };
}

async function fetchData() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [items, recentLogs, categories] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      include: {
        category: { select: { name: true } },
        logs: { select: { action: true, quantity: true } },
      },
    }),
    prisma.inventoryLog.findMany({
      where: { date: { gte: sixMonthsAgo } },
      select: { action: true, quantity: true, date: true, item: { select: { name: true, category: { select: { name: true } } } } },
      orderBy: { date: "asc" },
    }),
    prisma.inventoryCategory.findMany({
      include: {
        items: { where: { isActive: true }, include: { logs: { select: { action: true, quantity: true } } } },
      },
    }),
  ]);

  return { items, recentLogs, categories };
}

function buildPdf(data: ReturnType<typeof gatherReportData>): ArrayBuffer {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Inventory Report", pageWidth / 2, 20, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated on ${now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} at ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`, pageWidth / 2, 27, { align: "center" });
  doc.setTextColor(0);

  // Summary boxes
  let y = 36;
  const boxW = 42;
  const boxH = 18;
  const startX = (pageWidth - boxW * 4 - 6 * 3) / 2;
  const summaryItems = [
    { label: "Total Items", value: String(data.summary.totalItems), color: [59, 130, 246] },
    { label: "Total Stock", value: String(data.summary.totalStock), color: [16, 185, 129] },
    { label: "Out of Stock", value: String(data.summary.outOfStockCount), color: [239, 68, 68] },
    { label: "Low Stock", value: String(data.summary.lowStockCount), color: [245, 158, 11] },
  ];

  summaryItems.forEach((item, i) => {
    const x = startX + i * (boxW + 6);
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255);
    doc.text(item.value, x + boxW / 2, y + 10, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(item.label, x + boxW / 2, y + 15, { align: "center" });
  });
  doc.setTextColor(0);
  y += boxH + 10;

  // Monthly Trends
  if (data.trends.length > 0) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Monthly Trends (Last 6 Months)", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Month", "Purchased", "Used", "Broken", "Net Change"]],
      body: data.trends.map((t) => [
        formatMonth(t.month),
        `+${t.purchased}`,
        `-${t.used}`,
        `-${t.broken}`,
        `${t.purchased - t.used - t.broken >= 0 ? "+" : ""}${t.purchased - t.used - t.broken}`,
      ]),
      headStyles: { fillColor: [51, 65, 85], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        1: { textColor: [22, 163, 74] },
        2: { textColor: [37, 99, 235] },
        3: { textColor: [220, 38, 38] },
        4: { fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
    });

    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY) ?? y + 30;
    y += 8;
  }

  // Category Breakdown
  if (data.categoryBreakdown.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Category Breakdown", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Category", "Items", "Stock", "Purchased", "Used", "Broken"]],
      body: data.categoryBreakdown.map((c) => [c.name, c.itemCount, c.stock, c.purchased, c.used, c.broken]),
      headStyles: { fillColor: [51, 65, 85], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        3: { textColor: [22, 163, 74] },
        4: { textColor: [37, 99, 235] },
        5: { textColor: [220, 38, 38] },
      },
      margin: { left: 14, right: 14 },
    });

    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY) ?? y + 30;
    y += 8;
  }

  // Top 5 Most Used
  const topUsedFiltered = data.topUsed.filter((i) => i.used > 0);
  if (topUsedFiltered.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Top 5 Most Used Items", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Item", "Category", "Total Used", "Current Stock"]],
      body: topUsedFiltered.map((i) => [i.name, i.category, i.used, i.stock]),
      headStyles: { fillColor: [51, 65, 85], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });

    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY) ?? y + 30;
    y += 8;
  }

  // Items Needing Attention
  if (data.needsAttention.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Items Needing Attention", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Item", "Category", "Current Stock", "Status"]],
      body: data.needsAttention.map((i) => [
        i.name,
        i.category,
        i.stock,
        i.stock <= 0 ? "OUT OF STOCK" : "LOW STOCK",
      ]),
      headStyles: { fillColor: [51, 65, 85], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didParseCell: (hookData: any) => {
        if (hookData.section === "body" && hookData.column.index === 3) {
          const status = hookData.row.raw?.[3] as string;
          hookData.cell.styles.textColor = status === "OUT OF STOCK" ? [220, 38, 38] : [245, 158, 11];
          hookData.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 14, right: 14 },
    });

    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY) ?? y + 30;
    y += 8;
  }

  // All Items Summary
  if (data.itemSummaries.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Complete Item Summary", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Item", "Category", "Stock", "Purchased", "Used", "Broken"]],
      body: data.itemSummaries
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => [i.name, i.category, i.stock, i.purchased, i.used, i.broken]),
      headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
    doc.text("School Issue Tracker - Inventory Report", 14, doc.internal.pageSize.getHeight() - 8);
  }

  return doc.output("arraybuffer");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await fetchData();
  const data = gatherReportData(raw.items, raw.recentLogs, raw.categories);
  const pdfBuffer = buildPdf(data);

  const dateStr = new Date().toISOString().split("T")[0];
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="inventory-report-${dateStr}.pdf"`,
    },
  });
}
