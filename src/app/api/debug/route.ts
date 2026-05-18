import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    // Test DB connection
    const userCount = await prisma.user.count();
    const admin = await prisma.user.findUnique({
      where: { email: "admin@school.com" },
      select: { id: true, email: true, role: true, hashedPassword: true },
    });

    if (!admin) {
      return NextResponse.json({
        dbConnected: true,
        userCount,
        adminFound: false,
        env: {
          hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
          nextAuthUrl: process.env.NEXTAUTH_URL,
          hasDatabaseUrl: !!process.env.DATABASE_URL,
        },
      });
    }

    // Test password comparison
    const passwordMatch = await bcrypt.compare("admin123", admin.hashedPassword);
    const hashPrefix = admin.hashedPassword.substring(0, 10);

    return NextResponse.json({
      dbConnected: true,
      userCount,
      adminFound: true,
      adminRole: admin.role,
      hashPrefix,
      passwordMatch,
      env: {
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nextAuthUrl: process.env.NEXTAUTH_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
