import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const itemCount = await prisma.inventoryItem.count({
    where: { categoryId: id },
  });
  if (itemCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete category with existing items" },
      { status: 400 }
    );
  }

  await prisma.inventoryCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
