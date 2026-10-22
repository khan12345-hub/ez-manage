import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { SaveTemplateDto } from '../dto/save-template.dto';

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number) {
    return this.prisma.ceoEmailTemplate.findMany({
      where: { createdById: userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async create(userId: number, dto: SaveTemplateDto) {
    if (dto.isDefault) {
      await this.prisma.ceoEmailTemplate.updateMany({
        where: { createdById: userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.ceoEmailTemplate.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        body: dto.body,
        tone: dto.tone ?? 'professional',
        isDefault: dto.isDefault ?? false,
        createdById: userId,
      },
    });
  }

  async update(id: number, userId: number, dto: Partial<SaveTemplateDto>) {
    await this.assertOwner(id, userId);

    if (dto.isDefault) {
      await this.prisma.ceoEmailTemplate.updateMany({
        where: { createdById: userId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.ceoEmailTemplate.update({ where: { id }, data: dto });
  }

  async remove(id: number, userId: number) {
    await this.assertOwner(id, userId);
    return this.prisma.ceoEmailTemplate.delete({ where: { id } });
  }

  private async assertOwner(id: number, userId: number) {
    const template = await this.prisma.ceoEmailTemplate.findFirst({ where: { id, createdById: userId } });
    if (!template) throw new NotFoundException('Template not found');
  }
}
