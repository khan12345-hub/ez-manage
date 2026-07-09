import { Injectable } from '@nestjs/common';

import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
      },
    });
  }

  async findWorkspaceMembership(
    userId: number,
    workspaceId: number,
  ) {
    return this.prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
      select: {
        id: true,
        role: true,
        workspaceId: true,
        userId: true,
      },
    });
  }

  async create(user: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: user.password,
        status: user.status,
      },
    });
  }
}