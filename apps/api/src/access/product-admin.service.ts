import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PRODUCTS, type Product } from './product-access.service';

/** products that can have a per-product Administrator (crm is future) */
export const ADMIN_PRODUCTS = ['accounts', 'work', 'tracker', 'vault', 'crm'] as const;
export type AdminProduct = (typeof ADMIN_PRODUCTS)[number];

/**
 * A per-product Administrator: full admin over one entire product and nothing else.
 * The global Administrator (systemRole SUPER_ADMIN) is above this. Mirrors
 * ProductAccessService's short per-user cache so product guards can ask cheaply.
 */
@Injectable()
export class ProductAdminService {
  private cache = new Map<number, { set: Set<string>; at: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async products(userId: number): Promise<Set<string>> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < 30_000) return hit.set;
    const rows = await this.prisma.productAdmin.findMany({ where: { userId }, select: { product: true } }).catch(() => [] as { product: string }[]);
    const set = new Set(rows.map((r) => r.product));
    this.cache.set(userId, { set, at: Date.now() });
    return set;
  }

  async is(userId: number, product: AdminProduct | Product): Promise<boolean> {
    return (await this.products(userId)).has(product);
  }

  async set(userId: number, product: AdminProduct, on: boolean, byId: number | null) {
    if (on) {
      await this.prisma.productAdmin.upsert({
        where: { userId_product: { userId, product } },
        create: { userId, product, grantedById: byId },
        update: { grantedById: byId },
      });
    } else {
      await this.prisma.productAdmin.deleteMany({ where: { userId, product } });
    }
    this.cache.delete(userId);
  }

  /** userIds who administer this product */
  async adminsOf(product: AdminProduct): Promise<number[]> {
    const rows = await this.prisma.productAdmin.findMany({ where: { product }, select: { userId: true } }).catch(() => [] as { userId: number }[]);
    return rows.map((r) => r.userId);
  }

  forget(userId: number) {
    this.cache.delete(userId);
  }
}

export { PRODUCTS };
