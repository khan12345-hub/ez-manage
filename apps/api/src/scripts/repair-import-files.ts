/**
 * One-time script: repair import-failed file records.
 *
 * Single-URL records  → strip "import-failed:" prefix so onModuleInit retries them.
 * Multi-URL records   → split into individual file records (one per URL),
 *                       each linked to the same TaskCell.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/repair-import-files.ts
 * (from apps/api directory with DATABASE_URL set)
 */

import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const failed = await prisma.file.findMany({
    where: { storageKey: { startsWith: 'import-failed:' } },
    include: {
      cells: { include: { cell: true } },
    },
  });

  console.log(`Found ${failed.length} import-failed files.`);

  for (const file of failed) {
    const rawKey = file.storageKey.replace(/^import-failed:/, '');

    // Split on ", " followed by http(s):// to find individual URLs
    const urls = rawKey
      .split(/,\s+(?=https?:\/\/)/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//.test(u));

    if (urls.length === 0) {
      console.warn(`  File ${file.id} has no valid URLs — skipping`);
      continue;
    }

    const cellLink = file.cells[0];

    if (urls.length === 1) {
      // Simple reset: just strip the import-failed prefix
      await prisma.file.update({
        where: { id: file.id },
        data: { storageKey: urls[0], url: urls[0] },
      });
      console.log(`  File ${file.id} reset → ${urls[0].slice(0, 80)}…`);
      continue;
    }

    // Multi-URL: update the first record with the first URL, create new records for the rest
    console.log(`  File ${file.id} has ${urls.length} URLs — splitting…`);

    // Update existing record with first URL
    await prisma.file.update({
      where: { id: file.id },
      data: {
        storageKey: urls[0],
        url: urls[0],
        fileName: decodeURIComponent((urls[0].split('/').pop() ?? '').split('?')[0]) || file.fileName,
      },
    });

    if (!cellLink) {
      console.warn(`    No cell link for file ${file.id} — can only fix first URL`);
      continue;
    }

    // Create new file records for the remaining URLs and link to same cell
    for (const u of urls.slice(1)) {
      const newFile = await prisma.file.create({
        data: {
          fileName: decodeURIComponent((u.split('/').pop() ?? '').split('?')[0]) || 'Imported File',
          storageKey: u,
          url: u,
          mimeType: 'application/octet-stream',
          fileSize: 0,
          uploadedById: file.uploadedById,
        },
      });

      await prisma.taskCellFile.create({
        data: { cellId: cellLink.cellId, fileId: newFile.id },
      });

      console.log(`    Created file ${newFile.id} → ${u.slice(0, 70)}…`);
    }
  }

  console.log('Done. Restart the API — onModuleInit will retry all reset files.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
