import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BoardMemberRole, BoardVisibility } from "generated/prisma/enums";
import { PrismaService } from "prisma/prisma.service";

// import { BoardMemberRole, BoardVisibility } from "@prisma/client";

// import { PrismaService } from "@/prisma/prisma.service";

@Injectable()
export class BoardAccessManagementService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Owner cannot be changed through normal member role updates.
    if (member.role === BoardMemberRole.OWNER) {
      throw new BadRequestException(
        "The board owner role cannot be changed.",
      );
    }

    // Don't allow assigning OWNER through this endpoint.
    if (role === BoardMemberRole.OWNER) {
      throw new BadRequestException(
        "Owner role cannot be assigned through this endpoint.",
      );
    }

    const updatedMember =
      await this.prisma.boardMember.update({
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

    await this.prisma.boardMember.delete({
      where: {
        id: member.id,
      },
    });

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