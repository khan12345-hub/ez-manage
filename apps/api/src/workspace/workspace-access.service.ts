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

import { WORKSPACE_ROLE_PERMISSIONS } from '../auth/permissions/workspace-permissions';

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requirePermission(
    workspaceId: number,
    userId: number,
    permission: WorkspacePermission,
  ): Promise<boolean> {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      select: {
        members: {
          where: {
            userId,
          },
          select: {
            role: true,
            user: {
              select: {
                systemRole: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    const systemRole = workspace.members[0]?.user.systemRole;
    const workspaceRole = workspace.members[0]
      ?.role as WorkspaceMemberRole | undefined;

    // Super Admin
    if (systemRole === SystemRole.SUPER_ADMIN) {
      return true;
    }

    // Workspace permissions
    if (
      workspaceRole &&
      WORKSPACE_ROLE_PERMISSIONS[workspaceRole]?.includes(permission)
    ) {
      return true;
    }

    throw new ForbiddenException(
      "You don't have permission to perform this action.",
    );
  }
}