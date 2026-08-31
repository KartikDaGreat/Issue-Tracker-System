import { prisma } from "./prisma";
import type { InventoryAction, Prisma } from "@prisma/client";

/**
 * Stock is derived from the log table rather than stored on the item.
 *
 * The previous implementation shipped *every* log row for *every* item into
 * Node and summed them in JavaScript, which grew linearly with the log table
 * forever. These helpers push the aggregation into Postgres instead, so only
 * one small row per (item, action) pair crosses the wire.
 *
 * Voided logs are excluded everywhere, which is what makes a mistyped entry
 * correctable without deleting history.
 */

export const NOT_VOIDED = { voidedAt: null } as const;

function applyDelta(
  stock: number,
  action: InventoryAction,
  quantity: number
): number {
  return action === "PURCHASED" ? stock + quantity : stock - quantity;
}

export interface ItemMovement {
  stock: number;
  purchased: number;
  used: number;
  broken: number;
}

export const EMPTY_MOVEMENT: ItemMovement = {
  stock: 0,
  purchased: 0,
  used: 0,
  broken: 0,
};

function foldGroups(
  groups: { itemId: string; action: InventoryAction; _sum: { quantity: number | null } }[]
): Map<string, ItemMovement> {
  const byItem = new Map<string, ItemMovement>();

  for (const group of groups) {
    const quantity = group._sum.quantity ?? 0;
    const current = byItem.get(group.itemId) ?? { ...EMPTY_MOVEMENT };

    current.stock = applyDelta(current.stock, group.action, quantity);
    if (group.action === "PURCHASED") current.purchased += quantity;
    else if (group.action === "USED") current.used += quantity;
    else if (group.action === "BROKEN") current.broken += quantity;

    byItem.set(group.itemId, current);
  }

  return byItem;
}

/** Movement totals for every item (optionally narrowed to a set of item ids). */
export async function getMovementByItem(
  itemIds?: string[]
): Promise<Map<string, ItemMovement>> {
  if (itemIds && itemIds.length === 0) return new Map();

  const groups = await prisma.inventoryLog.groupBy({
    by: ["itemId", "action"],
    where: {
      ...NOT_VOIDED,
      ...(itemIds ? { itemId: { in: itemIds } } : {}),
    },
    _sum: { quantity: true },
  });

  return foldGroups(groups);
}

/**
 * Current stock for a single item, read inside the caller's transaction so the
 * check and the insert cannot interleave with another write.
 */
export async function getStockForItem(
  tx: Prisma.TransactionClient,
  itemId: string
): Promise<number> {
  const groups = await tx.inventoryLog.groupBy({
    by: ["action"],
    where: { itemId, ...NOT_VOIDED },
    _sum: { quantity: true },
  });

  let stock = 0;
  for (const group of groups) {
    stock = applyDelta(stock, group.action, group._sum.quantity ?? 0);
  }
  return stock;
}

/** How much a log entry changes stock by: positive for purchases. */
export function logDelta(action: InventoryAction, quantity: number): number {
  return action === "PURCHASED" ? quantity : -quantity;
}

export const LOW_STOCK_THRESHOLD = 5;

export function stockStatus(stock: number): "OUT" | "LOW" | "OK" {
  if (stock <= 0) return "OUT";
  if (stock <= LOW_STOCK_THRESHOLD) return "LOW";
  return "OK";
}
