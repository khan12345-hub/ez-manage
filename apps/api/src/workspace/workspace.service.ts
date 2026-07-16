import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      throw new ConflictException(
        'A workspace with this name already exists.',
      );
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
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: true,
      },
      orderBy: {
        workspace: {
          createdAt: 'desc',
        },
      },
    });

    return memberships.map(({ workspace, role }) => ({
      ...workspace,
      role,
    }));
  }

  async findOne(workspaceId: number, userId: number) {
    const workspace = await this.prisma.workspace.findUnique({
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
          },
          orderBy: {
            createdAt: 'asc',
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
    
    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    return workspace;
  }

  async update(
    workspaceId: number,
    updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    const data: UpdateWorkspaceDto = {};

    if (updateWorkspaceDto.name !== undefined) {
      const name = updateWorkspaceDto.name.trim();

      if (!name) {
        throw new BadRequestException('Workspace name is required.');
      }

      const existingWorkspace = await this.prisma.workspace.findFirst({
        where: {
          createdById: workspace.createdById,
          id: {
            not: workspaceId,
          },
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (existingWorkspace) {
        throw new ConflictException(
          'A workspace with this name already exists.',
        );
      }

      data.name = name;
    }

    if (updateWorkspaceDto.visibility !== undefined) {
      data.visibility = updateWorkspaceDto.visibility;
    }

    return this.prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data,
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

  async remove(workspaceId: number) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.workspaceMember.deleteMany({
        where: {
          workspaceId,
        },
      });

      await tx.board.deleteMany({
        where: {
          workspaceId,
        },
      });

      return tx.workspace.delete({
        where: {
          id: workspaceId,
        },
      });
    });
  }
}