import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { PrismaService } from 'prisma/prisma.service';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccess: WorkspaceAccessService
  ) {}
  create(createBoardDto: CreateBoardDto) {
    return 'This action adds a new board';
  }

  async findAll(workspaceId: number, userId: number) {
    // const workspace = await this.prisma.workspaceMember.findFirst({
    //   where: {
    //     workspaceId,
    //     userId,
    //   },
    // });
    // if (!workspace) {
    //   throw new ForbiddenException();
    // }

    const workspace = await this.workspaceAccess.getWorkspaceMember(workspaceId, userId);

    const boards = await this.prisma.board.findMany({
      where: {
        workspaceId,
        members: {
          some: {
            userId,
          },
        },
      },
    });
    if (!boards) {
      throw new ForbiddenException();
    }
    return boards.map((board) => ({
      name: board.name,
      role: workspace.role,
    }));
  }

  findOne(id: number) {
    return `This action returns a #${id} board`;
  }

  update(id: number, updateBoardDto: UpdateBoardDto) {
    return `This action updates a #${id} board`;
  }

  remove(id: number) {
    return `This action removes a #${id} board`;
  }
}
