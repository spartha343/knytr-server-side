// import { RoleType } from "../src/generated/prisma/client";
import { prisma } from "../src/shared/prisma";

async function main() {}

main()
  .catch((err) => {
    console.error("❌ Seeding failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
