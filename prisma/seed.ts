import { PrismaClient } from "@prisma/client";
import { propertiesData } from "./seed.data";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${propertiesData.length} properties...`);
  await prisma.property.deleteMany(); // idempotent
  await prisma.property.createMany({ data: propertiesData });
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
