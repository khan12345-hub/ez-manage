import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

export const PRODUCTS = ['accounts', 'work', 'tracker', 'vault', 'crm', 'executive'] as const;
export type Product = (typeof PRODUCTS)[number];
export const PRODUCT_LABEL: Record<Product, string> = {
  accounts: 'Accounts & Invoices', work: 'Company Work', tracker: 'EZ Tracker', vault: 'EZ Vault', crm: 'EZ Sales', executive: 'Executive Hub',
};

/**
 * The Administrator's product switch (Access Center). Only an explicit OFF row blocks:
 * no row keeps today's behaviour (a membership decides; Vault for everyone; Executive Hub
 * for SUPER_ADMIN). Memberships and roles are never touched, so ON restores them.
 */
@Injectable()
export class ProductAccessService {
  /** userId → products switched off (short cache; cleared on every change) */
  private cache = new Map<number, { off: Set<Product>; at: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async off(userId: number): Promise<Set<Product>> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < 30_000) return hit.off;
    const rows = await this.prisma.userProductAccess.findMany({ where: { userId, enabled: false }, select: { product: true } });
    const off = new Set(rows.map((r) => r.product as Product));
    this.cache.set(userId, { off, at: Date.now() });
    return off;
  }

  async isOff(userId: number, product: Product) {
    return (await this.off(userId)).has(product);
  }

  /** throws 403 when the Administrator switched this product off for the person */
  async assert(userId: number, product: Product) {
    if (await this.isOff(userId, product)) {
      throw new ForbiddenException(`You don't have access to ${PRODUCT_LABEL[product]}. Ask the Administrator.`);
    }
  }

  /**
   * An invite into a product: refused when the Administrator switched the product off for
   * this person, otherwise the product is switched on for them (decision 1a).
   */
  async allowInvite(userId: number, product: Product, byId: number | null) {
    if (await this.isOff(userId, product)) {
      throw new BadRequestException(`This person doesn't have access to ${PRODUCT_LABEL[product]}. Ask the Administrator.`);
    }
    await this.set(userId, product, true, byId);
  }

  async set(userId: number, product: Product, enabled: boolean, byId: number | null) {
    await this.prisma.userProductAccess.upsert({
      where: { userId_product: { userId, product } },
      create: { userId, product, enabled, changedById: byId },
      update: { enabled, changedById: byId },
    });
    this.cache.delete(userId);
  }

  forget(userId: number) {
    this.cache.delete(userId);
  }
}
