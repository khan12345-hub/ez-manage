import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { PrismaService } from 'prisma/prisma.service';
import { WorkspaceRole } from '../../generated/prisma/client';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createWorkspaceDto: CreateWorkspaceDto, userId: number) {
   
    const name = createWorkspaceDto.name.trim();

    if (!name) {
      throw new BadRequestException('Workspace name is required.');
    }

    // Optional: prevent duplicate workspace names for same owner
    const existingWorkspace = await this.prisma.workspace.findFirst({
      where: {
        createdById: userId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingWorkspace) {
      throw new ConflictException('A workspace with this name already exists.');
    }

    return this.prisma.workspace.create({
      data: {
        name,
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
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
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
            // members: {
            //   take: 3,
            //   include: {
            //     user: {
            //       select: {
            //         avatarUrl: true,
            //       },
            //     },
            //   },
            // },
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
    return this.prisma.workspace.update({
      where: { id },
      data: {
        name: updateWorkspaceDto.name,
        visibility: updateWorkspaceDto.visibility,
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
      },
    });
  }

  async remove(id: number) {
    // Delete all workspace members first
    await this.prisma.workspaceMember.deleteMany({
      where: { workspaceId: id },
    });

    // Delete all boards in the workspace
    await this.prisma.board.deleteMany({
      where: { workspaceId: id },
    });

    // Finally delete the workspace
    return this.prisma.workspace.delete({
      where: { id },
      include: {
        members: true,
      },
    });
  }
}
