import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CeoSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async hasKey(): Promise<boolean> {
    const row = await this.prisma.ceoSettings.findUnique({ where: { id: 1 } });
    return !!row?.dashboardKey;
  }

  async setKey(rawKey: string): Promise<void> {
    const hashed = await bcrypt.hash(rawKey, 10);
    await this.prisma.ceoSettings.upsert({
      where: { id: 1 },
      create: { id: 1, dashboardKey: hashed },
      update: { dashboardKey: hashed },
    });
  }

  async verifyKey(rawKey: string): Promise<boolean> {
    const row = await this.prisma.ceoSettings.findUnique({ where: { id: 1 } });
    if (!row?.dashboardKey) return false;
    return bcrypt.compare(rawKey, row.dashboardKey);
  }
}
