import { RoleType } from "../src/generated/prisma/client";
import { prisma } from "../src/shared/prisma";

async function main() {
  console.log("🌱 Starting database seeding...");

  // Define all roles
  const roles = [
    {
      name: RoleType.CUSTOMER,
      description: "Regular customer who can browse and purchase products"
    },
    {
      name: RoleType.VENDOR,
      description: "Vendor who can manage their stores, products, and inventory"
    },
    {
      name: RoleType.ADMIN,
      description:
        "Administrator who can manage users, approve vendors, and oversee platform operations"
    },
    {
      name: RoleType.SUPER_ADMIN,
      description: "Super Administrator with full system access and control"
    }
  ];

  // Seed roles using upsert (create if not exists, update if exists)
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: {
        name: role.name,
        description: role.description
      }
    });
    console.log(`✅ Role seeded: ${role.name}`);
  }

  // Add ADMIN role to user ID: 38f2dca8-168f-49ca-93d3-2c4f67b21a54
  console.log("\n👤 Assigning ADMIN role to spartha343@gmail.com...");

  const userId = "90855091-a14a-488d-9a08-6a5445d9f626";

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (user) {
    const adminRole = await prisma.role.findUnique({
      where: { name: RoleType.ADMIN }
    });

    if (adminRole) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: adminRole.id
          }
        },
        update: {},
        create: {
          userId: user.id,
          roleId: adminRole.id
        }
      });
      console.log(`✅ ADMIN role assigned to user: ${user.email || userId}`);
    } else {
      console.log("❌ ADMIN role not found");
    }
  } else {
    console.log(`❌ User with ID ${userId} not found`);
  }

  console.log("\n🎉 Database seeding completed successfully!");
}

main()
  .catch((err) => {
    console.error("❌ Seeding failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
