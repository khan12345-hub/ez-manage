import { Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationType } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationStreamService } from 'src/notifications/notification-stream.service';
import { PRODUCT_LABEL, type Product } from './product-access.service';

export type AccessEvent = {
  actorId?: number | null;
  targetUserId?: number | null;
  targetEmail?: string | null;
  product: Product | 'system';
  workspaceId?: number | null;
  workspaceName?: string | null;
  action: 'invited' | 'added' | 'joined' | 'role_changed' | 'removed' | 'product_on' | 'product_off' | 'disabled' | 'enabled' | 'refused' | 'promoted' | 'demoted' | 'manager_set' | 'manager_removed';
  fromRole?: string | null;
  toRole?: string | null;
  via?: 'product' | 'access_center' | 'invite_link' | 'invite_accept' | 'sign_up';
};

const ROLE = (r?: string | null) => (r ? r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ') : '');

/**
 * Access history + a heads-up to every Administrator. Never throws: a logging problem must
 * not break an invite or a role change.
 */
@Injectable()
export class AccessAuditService {
  private readonly log = new Logger('AccessAudit');

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly stream?: NotificationStreamService,
  ) {}

  record(e: AccessEvent) {
    void this.write(e).catch((err) => this.log.warn(`audit failed: ${err?.message ?? err}`));
  }

  private async write(e: AccessEvent) {
    let workspaceName = e.workspaceName ?? null;
    if (!workspaceName && e.workspaceId && (e.product === 'accounts' || e.product === 'work')) {
      workspaceName = e.product === 'accounts'
        ? (await this.prisma.workspace.findUnique({ where: { id: e.workspaceId }, select: { name: true } }))?.name ?? null
        : (await this.prisma.workWorkspace.findUnique({ where: { id: e.workspaceId }, select: { name: true } }))?.name ?? null;
    }
    await this.prisma.accessAudit.create({
      data: {
        actorId: e.actorId ?? null, targetUserId: e.targetUserId ?? null, targetEmail: e.targetEmail ?? null,
        product: e.product, workspaceId: e.workspaceId ?? null, workspaceName, action: e.action,
        fromRole: e.fromRole ?? null, toRole: e.toRole ?? null, via: e.via ?? 'product',
      },
    });
    await this.notifyAdmins({ ...e, workspaceName });
  }

  /** in-app heads-up to every Administrator except the one who did it */
  private async notifyAdmins(e: AccessEvent) {
    if (!this.notifications) return;
    const [admins, actor, target] = await Promise.all([
      this.prisma.user.findMany({ where: { systemRole: 'SUPER_ADMIN', deletedAt: null, status: 'ACTIVE' }, select: { id: true } }),
      e.actorId ? this.prisma.user.findUnique({ where: { id: e.actorId }, select: { firstName: true, lastName: true } }) : null,
      e.targetUserId ? this.prisma.user.findUnique({ where: { id: e.targetUserId }, select: { firstName: true, lastName: true, email: true } }) : null,
    ]);
    const who = actor ? `${actor.firstName} ${actor.lastName}`.trim() : 'Someone';
    const whom = target ? `${target.firstName} ${target.lastName}`.trim() || target.email : e.targetEmail ?? 'someone';
    const product = e.product === 'system' ? 'EZ Manage' : PRODUCT_LABEL[e.product];
    const where = e.workspaceName ? ` in ${e.workspaceName}` : '';
    const text: Record<AccessEvent['action'], string> = {
      invited: `${who} invited ${whom} to ${product}${where}${e.toRole ? ` as ${ROLE(e.toRole)}` : ''}.`,
      added: `${who} added ${whom} to ${product}${where}${e.toRole ? ` as ${ROLE(e.toRole)}` : ''}.`,
      joined: `${whom} joined ${product}${where}${e.toRole ? ` as ${ROLE(e.toRole)}` : ''}.`,
      role_changed: `${who} changed ${whom}'s role in ${product}${where}: ${ROLE(e.fromRole)} → ${ROLE(e.toRole)}.`,
      removed: `${who} removed ${whom} from ${product}${where}.`,
      product_on: `${who} turned ${product} on for ${whom}.`,
      product_off: `${who} turned ${product} off for ${whom}.`,
      disabled: `${who} disabled ${whom}'s account.`,
      enabled: `${who} enabled ${whom}'s account again.`,
      refused: `${who} tried to invite ${whom} to ${product}${where}, but ${product} is off for them.`,
      promoted: `${who} made ${whom} a Co-Administrator.`,
      demoted: `${who} removed ${whom}'s Administrator role.`,
      manager_set: `${who} made ${whom} an Access Manager (${e.toRole ?? ''}).`,
      manager_removed: `${who} removed ${whom}'s Access Manager role.`,
    };
    for (const a of admins) {
      if (a.id === e.actorId) continue;
      try {
        const n = await this.notifications.notify({
          recipientId: a.id,
          type: NotificationType.WORKSPACE_MEMBER_ADDED,
          title: 'Access changed',
          message: text[e.action],
          metadata: { access: true, url: '/access?tab=history', action: e.action, product: e.product },
          sendEmail: false,
        });
        if (n) this.stream?.emit(a.id, n);
      } catch { /* the history row is what matters */ }
    }
  }
}
