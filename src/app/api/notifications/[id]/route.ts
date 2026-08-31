import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, requireSession, parseBody, notFound, json } from "@/lib/api";

const patchSchema = z.object({ read: z.boolean().optional() });

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  const { id } = await ctx.params;
  const { read = true } = await parseBody(req, patchSchema);

  // Scoping the update by userId means another user's notification id simply
  // matches nothing, rather than being readable first and rejected after.
  const result = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read },
  });

  if (result.count === 0) throw notFound("That notification no longer exists.");

  return json({ success: true });
});

export const DELETE = handler(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSession();
  const { id } = await ctx.params;

  const result = await prisma.notification.deleteMany({
    where: { id, userId: user.id },
  });

  if (result.count === 0) throw notFound("That notification no longer exists.");

  return json({ success: true });
});
