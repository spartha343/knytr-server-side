import { RoleType } from "../src/generated/prisma/client";
import { prisma } from "../src/shared/prisma";

async function main() {
  const roles = [
    { name: RoleType.CUSTOMER, description: "Default customer role" },
    { name: RoleType.VENDOR, description: "Vendor role" },
    { name: RoleType.ADMIN, description: "Admin role" },
    { name: RoleType.SUPER_ADMIN, description: "Super admin role" }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role
    });
  }

  console.log("✅ Roles seeded successfully");
}

main()
  .catch((err) => {
    console.error("❌ Seeding failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
