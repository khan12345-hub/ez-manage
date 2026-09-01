import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateBoardDocumentDto } from './dto/create-board-document.dto';
import { UpdateBoardDocumentDto } from './dto/update-board-document.dto';

@Injectable()
export class BoardDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(boardId: number) {
    return this.prisma.boardDocument.findMany({
      where: { boardId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        boardId: true,
        title: true,
        content: true,
        icon: true,
        order: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(boardId: number, userId: number, dto: CreateBoardDocumentDto) {
    const last = await this.prisma.boardDocument.findFirst({
      where: { boardId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return this.prisma.boardDocument.create({
      data: {
        boardId,
        createdById: userId,
        title: dto.title,
        content: dto.content,
        order: last ? last.order + 1 : 0,
      },
    });
  }

  async update(id: number, boardId: number, dto: UpdateBoardDocumentDto) {
    const doc = await this.prisma.boardDocument.findFirst({
      where: { id, boardId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found.');
    }

    return this.prisma.boardDocument.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
      },
    });
  }

  async remove(id: number, boardId: number) {
    const doc = await this.prisma.boardDocument.findFirst({
      where: { id, boardId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found.');
    }

    await this.prisma.boardDocument.delete({ where: { id } });

    return { message: 'Document deleted successfully.' };
  }
}
