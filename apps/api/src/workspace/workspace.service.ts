import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { PrismaService } from 'prisma/prisma.service';
import { WorkspaceRole } from '../../generated/prisma/client';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}
  create(createWorkspaceDto: CreateWorkspaceDto, userId: number) {
    return this.prisma.workspace.create({
      data: {
        name: createWorkspaceDto.name,
        visibility: createWorkspaceDto.visibility,
        createdById: userId,
        members: {
          create: {
            userId,
            role: WorkspaceRole.OWNER,
          },
        },
      },
    });
  }

  async findAll(userId: number) {
    const memberShips = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: true,
      },
    });
    if (!memberShips) {
      throw new ForbiddenException();
    }
    return memberShips.map((memberShip) => ({
      ...memberShip.workspace,
      role: memberShip.role,
    }));
  }

  findOne(workspaceId: number, userId: number) {
    return this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },

        boards: {
          where: {
            members: {
              some: {
                userId,
              },
            },
          },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            _count: {
              select: {
                members: true,
              },
            },
            members: {
              take: 3,
              include: {
                user: {
                  select: {
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },

        _count: {
          select: {
            boards: true,
            members: true,
          },
        },
      },
    });
  }

  update(id: number, updateWorkspaceDto: UpdateWorkspaceDto) {
    return `This action updates a #${id} workspace`;
  }

  remove(id: number) {
    return `This action removes a #${id} workspace`;
  }
}
