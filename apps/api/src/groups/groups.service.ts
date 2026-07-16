import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { PrismaService } from 'prisma/prisma.service';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { DeleteGroupDto } from './dto/delete-group.dto';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardAccessService: BoardAccessService,
  ) {}
  async create(createGroupDto: CreateGroupDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.group.findFirst({
        where: {
          boardId: createGroupDto.boardId,
          name: createGroupDto.name,
        },
      });

      if (existing) {
        throw new ConflictException('Group with this name already exists.');
      }

      const lastGroup = await tx.group.findFirst({
        where: {
          boardId: createGroupDto.boardId,
        },
        orderBy: {
          order: 'desc',
        },
      });

      const group = await tx.group.create({
        data: {
          name: createGroupDto.name,
          boardId: createGroupDto.boardId,
          createdById: userId,
          color:createGroupDto.color,
          order: (lastGroup?.order ?? -1) + 1,
        },
      });

      return group;
    });
  }

  async update(id: number, updateGroupDto: UpdateGroupDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.findFirst({
        where: {
          id,
          boardId: updateGroupDto.boardId,
        },
        include: {
          board: {
            select: {
              id: true,
              workspaceId: true,
            },
          },
        },
      });

      if (!group) {
        throw new NotFoundException('Group not found.');
      }

      await this.boardAccessService.requireViewer(
        group.board.workspaceId,
        userId,
      );

      if (updateGroupDto.name && updateGroupDto.name !== group.name) {
        const existing = await tx.group.findFirst({
          where: {
            boardId: updateGroupDto.boardId,
            name: updateGroupDto.name,
            NOT: {
              id,
            },
          },
        });

        if (existing) {
          throw new ConflictException('Group with this name already exists.');
        }
      }

      return tx.group.update({
        where: { id },
        data: {
          ...(updateGroupDto.name !== undefined && {
            name: updateGroupDto.name,
          }),
          ...(updateGroupDto.color !== undefined && {
            color: updateGroupDto.color,
          }),
          updatedById: userId,
        },
      });
    });
  }

  async remove(id: number, boardId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.findFirst({
        where: {
          id,
          boardId,
        },
        include: {
          board: {
            select: {
              id: true,
              workspaceId: true,
            },
          },
        },
      });

      if (!group) {
        throw new NotFoundException('Group not found for the specified board.');
      }

      await this.boardAccessService.requireViewer(
        group.board.workspaceId,
        userId,
      );

      await tx.group.delete({
        where: { id },
      });

      return {
        message: 'Group deleted successfully.',
      };
    });
  }
  findAll() {
    return `This action returns all groups`;
  }

  findOne(id: number) {
    return `This action returns a #${id} group`;
  }
}
