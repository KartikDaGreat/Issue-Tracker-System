import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import {
  handler,
  requireSession,
  parseBody,
  forbidden,
  conflict,
  json,
} from "@/lib/api";
import {
  BCRYPT_ROUNDS,
  LIMITS,
  ROLES,
  emailString,
  passwordString,
  parsePagination,
  parseEnumParam,
  parseSearch,
  trimmedString,
} from "@/lib/validation";
import type { Prisma } from "@prisma/client";

const createUserSchema = z.object({
  name: trimmedString(LIMITS.name, "Name"),
  email: emailString,
  password: passwordString,
  role: z.enum(ROLES),
});

export const GET = handler(async (req: NextRequest) => {
  const user = await requireSession();
  const params = req.nextUrl.searchParams;

  // Any signed-in user may read a minimal directory, which is what populates
  // the assignee dropdowns.
  if (params.get("minimal") === "true") {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    return json(users, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  }

  if (!canManageUsers(user.role)) {
    throw forbidden("Only admins can view the full user list.");
  }

  const where: Prisma.UserWhereInput = {};

  const role = parseEnumParam(params.get("role"), ROLES, "role");
  if (role) where.role = role;

  const status = params.get("status");
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;

  const search = parseSearch(params.get("search"));
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const { page, limit, skip } = parsePagination(params, 25);

  const [users, total, adminCount] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { createdTickets: true, managedTickets: true },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
  ]);

  return json({
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    activeAdminCount: adminCount,
  });
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireSession();
  if (!canManageUsers(user.role)) {
    throw forbidden("Only admins can create users.");
  }

  const data = await parseBody(req, createUserSchema);

  // Emails are lowercased by the schema. Without that, "Admin@school.com"
  // created a second account that could never sign in as "admin@school.com".
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (existing) throw conflict("That email address is already in use.");

  const created = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      hashedPassword: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
      role: data.role,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json(created, { status: 201 });
});
