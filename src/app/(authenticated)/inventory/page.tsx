import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessInventory, canViewReports } from "@/lib/permissions";
import { getMovementByItem, EMPTY_MOVEMENT, stockStatus } from "@/lib/inventory";
import { Role } from "@prisma/client";
import InventoryClient from "./InventoryClient";

export default async function InventoryPage() {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessInventory(session.user.role as Role)) {
    redirect("/dashboard");
  }

  const [categories, items] = await Promise.all([
    prisma.inventoryCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { items: true } } },
    }),
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        isActive: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // One grouped aggregate instead of loading every log row for every item.
  const movement = await getMovementByItem(items.map((i) => i.id));

  const serializedItems = items.map((item) => {
    const m = movement.get(item.id) ?? EMPTY_MOVEMENT;
    return {
      ...item,
      updatedAt: item.updatedAt.toISOString(),
      quantityAvailable: m.stock,
      totalPurchased: m.purchased,
      totalUsed: m.used,
      totalBroken: m.broken,
      stockStatus: stockStatus(m.stock),
    };
  });

  return (
    <InventoryClient
      items={serializedItems}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        _count: c._count,
      }))}
      role={session.user.role}
      canDownloadReport={canViewReports(session.user.role as Role)}
    />
  );
}
