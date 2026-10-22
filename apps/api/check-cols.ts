import { PrismaClient } from './generated/prisma';
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'task_cells' ORDER BY ordinal_position`;
  console.log(JSON.stringify(rows, null, 2));
}
main().finally(() => prisma.$disconnect());
