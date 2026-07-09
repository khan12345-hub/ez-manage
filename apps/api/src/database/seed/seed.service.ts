import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  UserRole,
  UserStatus,
  WorkspaceRole,
} from '../../../generated/prisma/client';

@Injectable()
export class SeedService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

async seed() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash(
    process.env.DEFAULT_OWNER_PASSWORD!,
    12,
  );

  const users: {
    firstName: string;
    lastName: string;
    email: string;
  }[] = JSON.parse(process.env.DEFAULT_USERS!);

  const defaultBoards = [
    "General",
    "Development",
    "Design",
    "Human Resources",
  ];

  for (const user of users) {
    // Create or update user
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

    // Create default workspace if one does not already exist for this user
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
          description: "Default workspace",
          createdById: owner.id,
        },
      }));

    console.log(`✅ Workspace ready: ${workspace.name}`);

    // Create or update workspace membership
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
        role: WorkspaceRole.OWNER,
      },
    });

    console.log(`✅ Workspace membership ready`);

    // Create default boards
    for (const boardName of defaultBoards) {
      await this.prisma.board.upsert({
        where: {
          workspaceId_name: {
            workspaceId: workspace.id,
            name: boardName,
          },
        },
        update: {},
        create: {
          name: boardName,
          workspaceId: workspace.id,
          createdById: owner.id,

        },
      });
    }

    console.log(`✅ Default boards ready for ${workspace.name}`);
  }

  console.log("🎉 Database seeded successfully.");
}
}
