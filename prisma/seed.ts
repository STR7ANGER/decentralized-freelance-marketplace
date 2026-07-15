import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
  await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: { slug: "demo", name: "Demo Marketplace" },
  });
}

main().finally(() => prisma.$disconnect());
