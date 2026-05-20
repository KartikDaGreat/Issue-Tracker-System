import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessInventory } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
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
        logs: { select: { action: true, quantity: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedItems = items.map((item) => {
    let stock = 0;
    for (const log of item.logs) {
      if (log.action === "PURCHASED") stock += log.quantity;
      else stock -= log.quantity;
    }
    const { logs: _, ...rest } = item;
    return {
      ...rest,
      updatedAt: rest.updatedAt.toISOString(),
      quantityAvailable: stock,
    };
  });

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    _count: c._count,
  }));

  return (
    <InventoryClient
      items={serializedItems}
      categories={serializedCategories}
      role={session.user.role}
    />
  );
}
