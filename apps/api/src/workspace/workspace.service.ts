import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceMemberRole } from 'generated/prisma/enums';

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
            role: WorkspaceMemberRole.OWNER,
          },
        },
      },
    });
  }

  async findAll(userId: number) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId,
      },
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

  async findOne(workspaceId: number) {
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
            groups: {
              select: {
                _count: {
                  select: { tasks: true },
                },
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
    userId: number,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    const data: { name?: string; visibility?: any } = {};

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

    return this.prisma.workspace.delete({
      where: {
        id: workspaceId,
      },
    });
  }

  async updateMemberRole(
    workspaceId: number,
    memberId: number,
    role: WorkspaceMemberRole,
    requesterId: number,
  ) {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!target || target.workspaceId !== workspaceId) {
      throw new NotFoundException('Member not found.');
    }

    if (target.role === WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Cannot change the role of the workspace owner.');
    }

    if (role === WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Cannot assign the OWNER role.');
    }

    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
  }

  async removeMember(
    workspaceId: number,
    memberId: number,
    requesterId: number,
  ) {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!target || target.workspaceId !== workspaceId) {
      throw new NotFoundException('Member not found.');
    }

    if (target.role === WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Cannot remove the workspace owner.');
    }

    return this.prisma.workspaceMember.delete({
      where: { id: memberId },
    });
  }
}