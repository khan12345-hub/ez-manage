import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
// Adjust path to your PrismaService

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        password: true,
        systemRole: true,
        status: true,
      },
    });
  }

  async findUserById(id: number) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        systemRole: true,
        status: true,
        password: true,
        avatarUrl: true,
        workspaceMemberships: {
          select: {
            role: true,
            workspace: true,
          },
        },
        boardMemberships: {
          select: {
            role: true,
            board: {
              select: {
                id:true,
                name:true,
                workspace: true,
              },
            },
          },
        },
      },
    });
  }

  async updateLastLogin(id: number) {
    await this.prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(), // Equivalent to NOW()
      },
    });
  }
}
