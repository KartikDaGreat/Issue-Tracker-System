import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, requireSession, json } from "@/lib/api";
import { parsePagination } from "@/lib/validation";

export const GET = handler(async (req: NextRequest) => {
  const user = await requireSession();
  const params = req.nextUrl.searchParams;
  const { page, limit, skip } = parsePagination(params, 20);

  const where = {
    userId: user.id,
    ...(params.get("unread") === "true" ? { read: false } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return json(
    {
      notifications,
      unreadCount,
      total,
      page,
      limit,
      hasMore: skip + notifications.length < total,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=20",
      },
    }
  );
});

/** Marks every unread notification as read. */
export const PATCH = handler(async () => {
  const user = await requireSession();

  const result = await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });

  return json({ success: true, updated: result.count });
});

/** Clears read notifications so the list cannot grow without bound. */
export const DELETE = handler(async () => {
  const user = await requireSession();

  const result = await prisma.notification.deleteMany({
    where: { userId: user.id, read: true },
  });

  return json({ success: true, deleted: result.count });
});
