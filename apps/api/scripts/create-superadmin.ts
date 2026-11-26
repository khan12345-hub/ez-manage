/**
 * Create (or promote) a GLOBAL super-admin account directly in the database.
 * Run on the server where the API lives:
 *
 *   cd /home/ezmanage-staging/apps/api        # staging  (live: /home/ez-manage/apps/api)
 *   EMAIL="khan2@ezaccounts.ca" PASSWORD="ChangeMe#2026" FIRST_NAME="Khan" LAST_NAME="Admin" \
 *     npx tsx -r dotenv/config scripts/create-superadmin.ts
 *
 * - If the email is new, it creates the user with the given password.
 * - If the email already exists, it is promoted to SUPER_ADMIN (password is left unchanged
 *   unless you also pass RESET_PASSWORD=1).
 */
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

async function main() {
  const email = (process.env.EMAIL ?? process.argv[2] ?? '').trim().toLowerCase();
  const password = process.env.PASSWORD ?? process.argv[3] ?? '';
  const firstName = (process.env.FIRST_NAME ?? 'Super').trim();
  const lastName = (process.env.LAST_NAME ?? 'Admin').trim();
  const resetPassword = process.env.RESET_PASSWORD === '1';

  if (!/.+@.+\..+/.test(email)) { console.error('Set a valid EMAIL, e.g. EMAIL="you@company.com"'); process.exit(1); }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!existing && password.length < 8) { console.error('New account needs PASSWORD of at least 8 characters.'); process.exit(1); }

  const hash = password ? await bcrypt.hash(password, 12) : undefined;
  const user = await prisma.user.upsert({
    where: { email },
    update: { systemRole: 'SUPER_ADMIN', status: 'ACTIVE', ...(resetPassword && hash ? { password: hash } : {}) },
    create: { email, firstName, lastName, password: hash!, status: 'ACTIVE', systemRole: 'SUPER_ADMIN' },
    select: { id: true, email: true, firstName: true, lastName: true, systemRole: true, status: true },
  });

  console.log(existing ? '✅ Promoted to global Administrator:' : '✅ Global Administrator created:', user);
  if (existing && !resetPassword) console.log('   (password unchanged — pass RESET_PASSWORD=1 to also set a new one)');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('Failed:', e?.message ?? e); await prisma.$disconnect(); process.exit(1); });
