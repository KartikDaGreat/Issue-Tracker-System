import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@school.com" },
    update: { hashedPassword, name: "School Administrator" },
    create: {
      name: "School Administrator",
      email: "admin@school.com",
      hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("Seed complete: admin@school.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
