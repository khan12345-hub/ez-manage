import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
// Adjust path to your PrismaService

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        firstName: true, // Prisma handles camelCase if mapped in schema.prisma
        lastName: true,
        email: true,
        password: true,
        
        status: true,
      },
    });
  }

  async findUserById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        
        status: true,
        password: true,

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