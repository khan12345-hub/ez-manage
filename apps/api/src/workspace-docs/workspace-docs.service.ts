import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateWorkspaceDocDto } from './dto/create-workspace-doc.dto';
import { UpdateWorkspaceDocDto } from './dto/update-workspace-doc.dto';

@Injectable()
export class WorkspaceDocsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: number, userId: number) {
    return this.prisma.workspaceDoc.findMany({
      where: {
        workspaceId,
        OR: [
          { privacy: { in: ['MAIN', 'SHAREABLE'] } },
          { createdById: userId },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        privacy: true,
        emoji: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findOne(id: number, workspaceId: number, userId: number) {
    const doc = await this.prisma.workspaceDoc.findFirst({
      where: { id, workspaceId },
    });
    if (!doc) throw new NotFoundException('Document not found.');
    if (doc.privacy === 'PRIVATE' && doc.createdById !== userId) {
      throw new ForbiddenException('You do not have access to this document.');
    }
    return doc;
  }

  async create(workspaceId: number, userId: number, dto: CreateWorkspaceDocDto) {
    return this.prisma.workspaceDoc.create({
      data: {
        workspaceId,
        createdById: userId,
        name: dto.name,
        privacy: dto.privacy ?? 'MAIN',
        emoji: dto.emoji,
        content: {},
      },
    });
  }

  async update(id: number, workspaceId: number, userId: number, dto: UpdateWorkspaceDocDto) {
    const doc = await this.prisma.workspaceDoc.findFirst({ where: { id, workspaceId } });
    if (!doc) throw new NotFoundException('Document not found.');
    if (doc.privacy === 'PRIVATE' && doc.createdById !== userId) {
      throw new ForbiddenException('You cannot edit this document.');
    }
    return this.prisma.workspaceDoc.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.privacy !== undefined && { privacy: dto.privacy }),
        ...(dto.emoji !== undefined && { emoji: dto.emoji }),
      },
    });
  }

  async remove(id: number, workspaceId: number, userId: number) {
    const doc = await this.prisma.workspaceDoc.findFirst({ where: { id, workspaceId } });
    if (!doc) throw new NotFoundException('Document not found.');
    if (doc.createdById !== userId) {
      throw new ForbiddenException('Only the creator can delete this document.');
    }
    await this.prisma.workspaceDoc.delete({ where: { id } });
    return { message: 'Document deleted.' };
  }
}
