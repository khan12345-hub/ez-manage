import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';

export type TrackerDeviceCaller = { userId: number; deviceId: number; orgId: number };

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/**
 * EZ Tracker desktop routes: "Authorization: Bearer ezt_…" from a paired desktop app.
 * Only the SHA-256 of the token is stored; a revoked device is signed out at once.
 * Desktop tokens open the /tracker/desktop routes only (never the web app).
 */
@Injectable()
export class TrackerDeviceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const m = /^Bearer (ezt_[A-Za-z0-9_-]{40,80})$/.exec(String(req.headers?.authorization ?? ''));
    if (!m) throw new UnauthorizedException('This app is not connected. Pair it again from EZ Tracker on the web.');
    const d = await this.prisma.trackerDevice.findUnique({ where: { tokenHash: hashToken(m[1]!) }, select: { id: true, userId: true, orgId: true, revokedAt: true, lastSeenAt: true } });
    if (!d || d.revokedAt) throw new UnauthorizedException('This computer was signed out. Pair it again from EZ Tracker on the web.');
    const user = await this.prisma.user.findUnique({ where: { id: d.userId }, select: { id: true, deletedAt: true } });
    if (!user || user.deletedAt) throw new UnauthorizedException('Not signed in.');
    if (!d.lastSeenAt || Date.now() - d.lastSeenAt.getTime() > 60_000) await this.prisma.trackerDevice.update({ where: { id: d.id }, data: { lastSeenAt: new Date() } });
    req.trackerDevice = { userId: d.userId, deviceId: d.id, orgId: d.orgId } satisfies TrackerDeviceCaller;
    return true;
  }
}

export const Device = createParamDecorator((_: unknown, ctx: ExecutionContext): TrackerDeviceCaller => ctx.switchToHttp().getRequest().trackerDevice);
