import { CanActivate, ExecutionContext, Injectable, Optional, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { ProductAccessService } from 'src/access/product-access.service';
import { createHash } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';

export type VaultCaller = { userId: number; via: 'web' | 'extension' };

/**
 * EZ Vault routes: the web app's session, or a browser-extension token
 * ("Authorization: Bearer ezv_…", only its SHA-256 is stored). Tokens only open /vault routes.
 */
@Injectable()
export class VaultAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly productAccess?: ProductAccessService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const sid = req.session?.user?.id;
    if (sid) { req.vault = { userId: sid, via: 'web' } satisfies VaultCaller; return true; }
    const m = /^Bearer (ezv_[A-Za-z0-9_-]{40,80})$/.exec(String(req.headers?.authorization ?? ''));
    if (!m) throw new UnauthorizedException('Not signed in.');
    const t = await this.prisma.vaultToken.findUnique({ where: { tokenHash: createHash('sha256').update(m[1]).digest('hex') }, select: { id: true, userId: true, revokedAt: true, lastUsedAt: true } });
    if (!t || t.revokedAt) throw new UnauthorizedException('This extension was signed out. Connect it again from EZ Vault.');
    const user = await this.prisma.user.findUnique({ where: { id: t.userId }, select: { id: true, deletedAt: true, status: true } });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') throw new UnauthorizedException('Not signed in.');
    // the Administrator's product switch (Access Center); the web session is checked by the global guard
    await this.productAccess?.assert(t.userId, 'vault');
    if (!t.lastUsedAt || Date.now() - t.lastUsedAt.getTime() > 5 * 60_000) await this.prisma.vaultToken.update({ where: { id: t.id }, data: { lastUsedAt: new Date() } });
    req.vault = { userId: t.userId, via: 'extension' } satisfies VaultCaller;
    return true;
  }
}

export const Caller = createParamDecorator((_: unknown, ctx: ExecutionContext): VaultCaller => ctx.switchToHttp().getRequest().vault);
