import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BoardMemberRole, BoardVisibility, NotificationType } from "generated/prisma/enums";
import { PrismaService } from "prisma/prisma.service";
import { NotificationsService } from "src/notifications/notifications.service";
import { NotificationStreamService } from "src/notifications/notification-stream.service";

@Injectable()
export class BoardAccessManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationStreamService: NotificationStreamService,
  ) {}

  /**
   * Get board access information
   */
  async getBoardAccess(boardId: number, userId: number) {
    const board = await this.prisma.board.findUnique({
      where: {
        id: boardId,
      },
      select: {
        id: true,
        name: true,
        visibility: true,

        members: {
          orderBy: {
            role: "desc",
          },
          select: {
            id: true,
            userId: true,
            role: true,

            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!board) {
      throw new NotFoundException("Board not found");
    }

    await this.assertCanManageAccess(boardId, userId);

    return board;
  }

  /**
   * Update board visibility
   */
  async updateVisibility(
    boardId: number,
    userId: number,
    visibility: BoardVisibility,
  ) {
    await this.assertCanManageAccess(boardId, userId);

    const board = await this.prisma.board.update({
      where: {
        id: boardId,
      },
      data: {
        visibility,
      },
      select: {
        id: true,
        visibility: true,
      },
    });

    return board;
  }

  /**
   * Update a board member's role
   */
  async updateMemberRole(
    boardId: number,
    memberId: number,
    userId: number,
    role: BoardMemberRole,
  ) {
    await this.assertCanManageAccess(boardId, userId);

    const member = await this.prisma.boardMember.findFirst({
      where: {
        id: memberId,
        boardId,
      },
      select: {
        id: true,
        role: true,
        userId: true,
      },
    });

    if (!member) {
      throw new NotFoundException(
        "Board member not found",
      );
    }

    if (member.role === BoardMemberRole.OWNER) {
      throw new BadRequestException(
        "The board owner role cannot be changed.",
      );
    }

    if (role === BoardMemberRole.OWNER) {
      throw new BadRequestException(
        "Owner role cannot be assigned through this endpoint.",
      );
    }

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, name: true, workspaceId: true },
    });

    const updatedMember = await this.prisma.boardMember.update({
      where: {
        id: member.id,
      },
      data: {
        role,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    try {
      const notification = await this.notificationsService.notify({
        recipientId: member.userId,
        type: NotificationType.BOARD_MEMBER_ROLE_UPDATED,
        title: 'Your board role was updated',
        message: `Your role in "${board?.name}" has been changed to ${role.toLowerCase()}.`,
        entityType: 'BOARD' as any,
        entityId: boardId,
        metadata: { boardId, workspaceId: board?.workspaceId, role },
        sendEmail: true,
      });
      this.notificationStreamService.emit(member.userId, notification);
    } catch {}

    return updatedMember;
  }

  /**
   * Remove a member from the board
   */
  async removeMember(
    boardId: number,
    memberId: number,
    userId: number,
  ) {
    await this.assertCanManageAccess(boardId, userId);

    const member = await this.prisma.boardMember.findFirst({
      where: {
        id: memberId,
        boardId,
      },
      select: {
        id: true,
        role: true,
        userId: true,
      },
    });

    if (!member) {
      throw new NotFoundException(
        "Board member not found",
      );
    }

    if (member.role === BoardMemberRole.OWNER) {
      throw new BadRequestException(
        "The board owner cannot be removed.",
      );
    }

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, name: true, workspaceId: true },
    });

    await this.prisma.boardMember.delete({
      where: {
        id: member.id,
      },
    });

    try {
      const notification = await this.notificationsService.notify({
        recipientId: member.userId,
        type: NotificationType.BOARD_MEMBER_REMOVED,
        title: 'Removed from board',
        message: `You have been removed from "${board?.name}".`,
        entityType: 'BOARD' as any,
        entityId: boardId,
        metadata: { boardId, workspaceId: board?.workspaceId },
        sendEmail: true,
      });
      this.notificationStreamService.emit(member.userId, notification);
    } catch {}

    return {
      success: true,
      memberId,
    };
  }

  /**
   * Verify that the current user can manage board access.
   */
  private async assertCanManageAccess(
    boardId: number,
    userId: number,
  ) {
    const member = await this.prisma.boardMember.findFirst({
      where: {
        boardId,
        userId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!member) {
      throw new ForbiddenException(
        "You do not have access to this board.",
      );
    }

    if (
      member.role !== BoardMemberRole.OWNER &&
      member.role !== BoardMemberRole.ADMIN
    ) {
      throw new ForbiddenException(
        "You do not have permission to manage board access.",
      );
    }

    return member;
  }
}
