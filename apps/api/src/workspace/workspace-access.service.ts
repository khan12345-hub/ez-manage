import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';

import {
  WorkspacePermission,
} from '@repo/shared';

import { SystemRole, WorkspaceMemberRole } from 'generated/prisma/enums';

import { WORKSPACE_ROLE_WORKSPACE_PERMISSIONS } from '../auth/permissions/workspace-permissions';
import { ProductAdminService } from 'src/access/product-admin.service';

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService, private readonly productAdmin: ProductAdminService) {}

  async requirePermission(
    workspaceId: number,
    userId: number,
    permission: WorkspacePermission,
  ): Promise<boolean> {
    const [workspace, me] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { members: { where: { userId }, select: { role: true }, take: 1 } },
      }),
      // read the caller's system role directly — a global Administrator may not be a member of this
      // workspace, so reading systemRole off the (empty) members list would miss them.
      this.prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } }),
    ]);

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    const systemRole = me?.systemRole;
    const workspaceRole = workspace.members[0]
      ?.role as WorkspaceMemberRole | undefined;

    // Super Admin
    if (systemRole === SystemRole.SUPER_ADMIN) {
      return true;
    }

    // an Accounts & Invoices product Administrator is full admin of every company
    if (await this.productAdmin.is(userId, 'accounts')) {
      return true;
    }

    // Workspace permissions
    if (
      workspaceRole &&
      WORKSPACE_ROLE_WORKSPACE_PERMISSIONS[workspaceRole]?.includes(permission)
    ) {
      return true;
    }

    throw new ForbiddenException(
      "You don't have permission to perform this action.",
    );
  }
}