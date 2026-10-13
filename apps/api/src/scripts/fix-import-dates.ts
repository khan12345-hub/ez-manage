/**
 * One-time fix: imported DATE cells are stored one day behind because
 * xlsx parsed Excel dates as local midnight and .toISOString() shifted
 * them back to UTC (e.g. UTC+5 midnight → previous day 19:00 UTC).
 *
 * This script finds all TaskCell rows whose column type is DATE or
 * PLAIN_DATE and whose stored date has a time component other than noon
 * (12:00:00.000Z), then advances the date by 1 day and pins it to noon.
 *
 * Usage (from apps/api directory, with DATABASE_URL in env):
 *   npx ts-node -r tsconfig-paths/register src/scripts/fix-import-dates.ts
 *
 * Optional: pass a board ID to limit to one board only:
 *   BOARD_ID=42 npx ts-node -r tsconfig-paths/register src/scripts/fix-import-dates.ts
 */

import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const boardId = process.env.BOARD_ID ? Number(process.env.BOARD_ID) : undefined;

  console.log(boardId
    ? `Fixing date cells for board ${boardId}…`
    : 'Fixing date cells across ALL boards…'
  );

  // Find every TaskCell whose column is a date type
  const cells = await prisma.taskCell.findMany({
    where: {
      column: {
        type: { in: ['DATE', 'PLAIN_DATE', 'LABEL'] },
        ...(boardId ? { boardId } : {}),
      },
    },
    select: { id: true, value: true, column: { select: { type: true } } },
  });

  console.log(`Found ${cells.length} date/label cell(s) to inspect.`);

  let updated = 0;
  let skipped = 0;

  for (const cell of cells) {
    const val = cell.value as Record<string, unknown> | null;
    if (!val) { skipped++; continue; }

    const raw = val['date'] as string | undefined;
    if (!raw || typeof raw !== 'string') { skipped++; continue; }

    const d = new Date(raw);
    if (isNaN(d.getTime())) { skipped++; continue; }

    // If already noon UTC, skip — it was either entered manually or
    // already fixed by a previous run of this script
    if (d.getUTCHours() === 12 && d.getUTCMinutes() === 0) {
      skipped++;
      continue;
    }

    // Advance by 1 day and pin to noon UTC
    const fixed = new Date(d);
    fixed.setUTCDate(fixed.getUTCDate() + 1);
    fixed.setUTCHours(12, 0, 0, 0);

    await prisma.taskCell.update({
      where: { id: cell.id },
      data: { value: { ...val, date: fixed.toISOString() } },
    });

    console.log(`  Cell ${cell.id}: ${raw} → ${fixed.toISOString()}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
