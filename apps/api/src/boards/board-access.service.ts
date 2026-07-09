import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "prisma/prisma.service";
import { UserRole } from '@repo/shared';

@Injectable()
export class BoardAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireViewer(
    workspaceId: number,
    boardId: number,
    userId: number,
  ) {
    // Verify the user belongs to the workspace
    const workspaceMembership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
      },
    });

    if (!workspaceMembership) {
      throw new ForbiddenException(
        "You don't have access to this workspace.",
      );
    }

    // Verify the board belongs to the workspace and get the board membership
    const boardMembership = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        userId,
        board: {
          workspaceId,
        },
      },
      include: {
        board: true,
      },
    });

    if (!boardMembership) {
      throw new ForbiddenException(
        "You don't have access to this board.",
      );
    }

    return {
      workspaceMembership,
      boardMembership,
      board: boardMembership.board,
    };
  }

  async requireEditor(
    workspaceId: number,
    boardId: number,
    userId: number,
  ) {
    const access = await this.requireViewer(
      workspaceId,
      boardId,
      userId,
    );

    if (
      access.workspaceMembership.role !== UserRole.OWNER &&
      access.workspaceMembership.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        "You don't have permission to edit this board.",
      );
    }

    return access;
  }

  async requireOwner(
    workspaceId: number,
    boardId: number,
    userId: number,
  ) {
    const access = await this.requireViewer(
      workspaceId,
      boardId,
      userId,
    );

    if (access.workspaceMembership.role !== UserRole.OWNER) {
      throw new ForbiddenException(
        "Only the board owner can perform this action.",
      );
    }

    return access;
  }
}