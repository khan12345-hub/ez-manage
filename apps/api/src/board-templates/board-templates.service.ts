import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "prisma/prisma.service";

import { CreateBoardTemplateDto } from "./dto/create-board-template.dto";
import { UpdateBoardTemplateDto } from "./dto/update-board-template.dto";

import { Prisma } from "generated/prisma/client";

@Injectable()
export class BoardTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all global board templates.
   */
  async findAll() {
    return this.prisma.boardTemplate.findMany({
      include: {
        groups: {
          orderBy: {
            position: "asc",
          },

          include: {
            columns: {
              orderBy: {
                position: "asc",
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Get a single global board template.
   */
  async findOne(templateId: number) {
    const template = await this.prisma.boardTemplate.findUnique({
      where: {
        id: templateId,
      },

      include: {
        groups: {
          orderBy: {
            position: "asc",
          },

          include: {
            columns: {
              orderBy: {
                position: "asc",
              },
            },
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException("Board template not found");
    }

    return template;
  }

  /**
   * Create a global board template.
   */
  async create(dto: CreateBoardTemplateDto) {
    this.validateTemplateGroups(dto);

    return this.prisma.$transaction(async (tx) => {
      const template = await tx.boardTemplate.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,

          groups: {
            create: dto.groups.map((group) => ({
              name: group.name.trim(),
              color: group.color,
              position: group.position,

              columns: {
                create: group.columns.map((column) => ({
                  name: column.name.trim(),
                  type: column.type,
                  position: column.position,
                  isPrimary: column.isPrimary ?? false,

                  options: column.options
                    ? (column.options as Prisma.InputJsonValue)
                    : undefined,
                })),
              },
            })),
          },
        },

        include: {
          groups: {
            orderBy: {
              position: "asc",
            },

            include: {
              columns: {
                orderBy: {
                  position: "asc",
                },
              },
            },
          },
        },
      });

      return template;
    });
  }

  /**
   * Update a global board template.
   */
  async update(
    templateId: number,
    dto: UpdateBoardTemplateDto,
  ) {
    const existing = await this.prisma.boardTemplate.findUnique({
      where: {
        id: templateId,
      },
    });

    if (!existing) {
      throw new NotFoundException("Board template not found");
    }

    if (dto.groups) {
      this.validateTemplateGroups(dto);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.boardTemplate.update({
        where: {
          id: templateId,
        },

        data: {
          ...(dto.name !== undefined && {
            name: dto.name.trim(),
          }),

          ...(dto.description !== undefined && {
            description: dto.description?.trim() || null,
          }),
        },
      });

      if (dto.groups) {
        await tx.boardTemplateGroup.deleteMany({
          where: {
            templateId,
          },
        });

        await Promise.all(
          dto.groups.map((group) =>
            tx.boardTemplateGroup.create({
              data: {
                templateId,
                name: group.name.trim(),
                color: group.color,
                position: group.position,

                columns: {
                  create: group.columns.map((column) => ({
                    name: column.name.trim(),
                    type: column.type,
                    position: column.position,
                    isPrimary: column.isPrimary ?? false,

                    options: column.options
                      ? (column.options as Prisma.InputJsonValue)
                      : undefined,
                  })),
                },
              },
            }),
          ),
        );
      }

      return tx.boardTemplate.findUnique({
        where: {
          id: templateId,
        },

        include: {
          groups: {
            orderBy: {
              position: "asc",
            },

            include: {
              columns: {
                orderBy: {
                  position: "asc",
                },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Delete a global board template.
   */
  async remove(templateId: number) {
    const template = await this.prisma.boardTemplate.findUnique({
      where: {
        id: templateId,
      },
    });

    if (!template) {
      throw new NotFoundException("Board template not found");
    }

    await this.prisma.boardTemplate.delete({
      where: {
        id: templateId,
      },
    });

    return {
      success: true,
      id: templateId,
    };
  }

  private validateTemplateGroups(
    dto: CreateBoardTemplateDto | UpdateBoardTemplateDto,
  ) {
    if (!dto.groups) {
      return;
    }

    for (const group of dto.groups) {
      if (!group.columns?.length) {
        throw new BadRequestException(
          `Group "${group.name}" must contain at least one column`,
        );
      }

      const primaryColumns = group.columns.filter(
        (column) => column.isPrimary,
      );

      if (primaryColumns.length > 1) {
        throw new BadRequestException(
          `Group "${group.name}" cannot have more than one primary column`,
        );
      }
    }
  }
}