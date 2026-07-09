import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from '@repo/shared';
import { PrismaService } from "prisma/prisma.service";

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspaceMember(workspaceId: number, userId: number) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
      },
    });

    if (!member) {
      throw new ForbiddenException("You are not a member of this workspace.");
    }

    return member;
  }

  async isOwner(workspaceId: number, userId: number) {
    const member = await this.getWorkspaceMember(workspaceId, userId);

    return member.role === UserRole.OWNER;
  }

  async requireOwner(workspaceId: number, userId: number) {
    const member = await this.getWorkspaceMember(workspaceId, userId);

    if (member.role !== UserRole.OWNER) {
      throw new ForbiddenException("Owner access required.");
    }

    return member;
  }
}