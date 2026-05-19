import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, name: true, email: true, role: true },
  });

  const results: { name: string; email: string; role: string; password: string }[] = [];

  for (const user of users) {
    const firstName = user.name.split(" ")[0].toLowerCase();
    const randomNum = Math.floor(Math.random() * 30) + 1;
    const newPassword = `${firstName}@${randomNum}`;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { hashedPassword },
    });

    results.push({
      name: user.name,
      email: user.email,
      role: user.role,
      password: newPassword,
    });
  }

  console.log("\n=== Password Reset Results ===\n");
  console.table(results);
  console.log(`\nReset ${results.length} user passwords. Admin password unchanged (admin123).\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
