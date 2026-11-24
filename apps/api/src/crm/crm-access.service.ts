import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

export type CrmRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type CrmLevel = 'view' | 'edit' | 'admin';
export type CrmCtx = { ws: { id: number; uid: string; name: string; currency: string; ownerId: number }; role: CrmRole; canEdit: boolean; canAdmin: boolean };

/** EZ CRM access: membership of a CRM workspace. Outsiders get 404; viewers are read-only. */
@Injectable()
export class CrmAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async isSuperAdmin(userId: number) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
    return u?.systemRole === 'SUPER_ADMIN';
  }

  async ws(wsUid: string, userId: number, level: CrmLevel = 'view'): Promise<CrmCtx> {
    const ws = await this.prisma.crmWorkspace.findUnique({ where: { uid: wsUid }, select: { id: true, uid: true, name: true, currency: true, ownerId: true } });
    if (!ws) throw new NotFoundException('CRM workspace not found.');
    const m = await this.prisma.crmMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId } }, select: { role: true } });
    if (!m) throw new NotFoundException('CRM workspace not found.');
    const role = m.role as CrmRole;
    const canEdit = role !== 'VIEWER';
    const canAdmin = role === 'OWNER' || role === 'ADMIN';
    if (level === 'edit' && !canEdit) throw new ForbiddenException('You can only view this CRM.');
    if (level === 'admin' && !canAdmin) throw new ForbiddenException('Only CRM admins can do this.');
    return { ws, role, canEdit, canAdmin };
  }

  /** ids that must be members of this workspace (owners, assignees) */
  async requireMembers(workspaceId: number, ids: (number | null | undefined)[]) {
    const want = [...new Set(ids.filter((x): x is number => typeof x === 'number'))];
    if (!want.length) return;
    const n = await this.prisma.crmMember.count({ where: { workspaceId, userId: { in: want } } });
    if (n !== want.length) throw new ForbiddenException('Owners and assignees must be members of this CRM.');
  }
}
