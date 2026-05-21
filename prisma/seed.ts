import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@school.com" },
    update: { hashedPassword, name: "Vaneetha V" },
    create: {
      name: "Vaneetha V",
      email: "admin@school.com",
      hashedPassword,
      role: "ADMIN",
    },
  });

  // Seed default inventory categories
  const defaultCategories = [
    "Lab Equipment",
    "Classroom Devices",
    "Stationery",
    "Furniture",
    "Electronics",
    "Sports Equipment",
  ];

  for (const name of defaultCategories) {
    await prisma.inventoryCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Seed complete: admin user + inventory categories");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
