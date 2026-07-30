import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  BoardMemberRole,
  UserStatus,
  WorkspaceMemberRole,
} from '../../../generated/prisma/client';

import { BoardColumnType } from '../../../generated/prisma/client';
import { getDefaultCellValue } from 'src/boards/defaults/default-cell-value.template';
import { DEFAULT_COLUMNS, DEFAULT_GROUPS, DEFAULT_STATUS_OPTIONS } from 'src/boards/defaults/default-board.template';

@Injectable()
export class SeedService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

async seed() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash(
    process.env.DEFAULT_OWNER_PASSWORD!,
    12,
  );

  const users: {
    firstName: string;
    lastName: string;
    email: string;
  }[] = JSON.parse(process.env.DEFAULT_USERS!);

  for (const user of users) {
    const owner = await this.prisma.user.upsert({
      where: {
        email: user.email,
      },
      update: {},
      create: {
        ...user,
        password: passwordHash,
        status: UserStatus.ACTIVE,
      },
    });

    console.log(`✅ User ready: ${owner.email}`);

    const existingWorkspace = await this.prisma.workspace.findFirst({
      where: {
        createdById: owner.id,
      },
    });

    const workspace =
      existingWorkspace ??
      (await this.prisma.workspace.create({
        data: {
          name: `${owner.firstName}'s Workspace`,
          description: 'Default workspace',
          createdById: owner.id,
        },
      }));

    console.log(`✅ Workspace ready: ${workspace.name}`);

    await this.prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: owner.id,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        userId: owner.id,
        role: WorkspaceMemberRole.OWNER,
      },
    });

    console.log(`✅ Workspace membership ready`);

    const existingBoard = await this.prisma.board.findFirst({
      where: {
        workspaceId: workspace.id,
        name: 'Basic Board',
      },
    });

    if (!existingBoard) {
      await this.prisma.$transaction(async (tx) => {
        const board = await tx.board.create({
          data: {
            name: 'Basic Board',
            workspaceId: workspace.id,
            visibility: 'PUBLIC',
            createdById: owner.id,

            members: {
              create: {
                userId: owner.id,
                role: BoardMemberRole.OWNER,
              },
            },
          },
        });

        const columns = await tx.boardColumn.createManyAndReturn({
          data: DEFAULT_COLUMNS.map((column, index) => ({
            boardId: board.id,
            name: column.name,
            type: column.type,
            isPrimary: column.isPrimary,
            order: (index + 1) * 1000,
          })),
        });

        const statusColumn = columns.find(
          (column) => column.type === BoardColumnType.STATUS,
        );

        if (!statusColumn) {
          throw new Error('Default status column was not created.');
        }

        const statusOptions = await tx.statusOption.createManyAndReturn({
          data: DEFAULT_STATUS_OPTIONS.map((status) => ({
            columnId: statusColumn.id,
            label: status.label,
            color: status.color,
            order: status.order,
          })),
        });

        for (const groupTemplate of DEFAULT_GROUPS) {
          const group = await tx.group.create({
            data: {
              boardId: board.id,
              name: groupTemplate.name,
              color: groupTemplate.color,
              order: groupTemplate.order * 1000,
              createdById: owner.id,
            },
          });

          const tasks = await tx.task.createManyAndReturn({
            data: groupTemplate.tasks.map((task, index) => ({
              groupId: group.id,
              name: task.title,
              order: (index + 1) * 1000,
              createdById: owner.id,
            })),
          });

          await tx.taskCell.createMany({
            data: tasks.flatMap((task, index) =>
              columns
                .filter((column) => !column.isPrimary)
                .map((column) => ({
                  taskId: task.id,
                  columnId: column.id,
                  value: getDefaultCellValue(
                    column.type,
                    groupTemplate.tasks[index],
                    {
                      id: owner.id,
                      email: owner.email,
                      firstName: owner.firstName,
                      lastName: owner.lastName,
                      avatarUrl: owner.avatarUrl,
                    },
                    statusOptions,
                  ),
                })),
            ),
          });
        }
      });

      console.log(`✅ Basic Board created for ${workspace.name}`);
    } else {
      console.log(`ℹ️ Basic Board already exists for ${workspace.name}`);
    }
  }

  console.log('🎉 Database seeded successfully.');
}
}