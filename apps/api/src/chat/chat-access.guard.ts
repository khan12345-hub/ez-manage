import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkspaceService } from 'src/workspace/workspace.service';

/**
 * Every `workspaces/:workspaceId/chat/*` route:
 *  - the caller must be an active member of that workspace;
 *  - a `:channelId` must belong to that workspace, and a direct message only to its two people;
 *  - a `:messageId` must sit in a channel of that workspace that the caller is a member of.
 * The resolved numeric workspace id is left on `req.chatWorkspaceId`.
 */
@Injectable()
export class ChatAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspaceService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = Number(req.user?.id ?? req.session?.user?.id);
    if (!userId) throw new ForbiddenException();

    const workspaceId = await this.workspaces.resolveId(String(req.params.workspaceId));
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('You are not a member of this workspace');
    req.chatWorkspaceId = workspaceId;

    if (req.params.channelId != null) {
      await this.checkChannel(Number(req.params.channelId), workspaceId, userId, false);
    }
    if (req.params.messageId != null) {
      const msg = await this.prisma.chatMessage.findUnique({
        where: { id: Number(req.params.messageId) || 0 },
        select: { channelId: true },
      });
      if (!msg) throw new NotFoundException('Message not found');
      await this.checkChannel(msg.channelId, workspaceId, userId, true);
    }
    return true;
  }

  /** Channels are open to the workspace (they can be joined); DMs and messages need membership. */
  private async checkChannel(channelId: number, workspaceId: number, userId: number, mustBeMember: boolean) {
    const channel = await this.prisma.chatChannel.findUnique({
      where: { id: channelId || 0 },
      select: { workspaceId: true, type: true, members: { where: { userId }, select: { userId: true } } },
    });
    if (!channel || (channel.workspaceId != null && channel.workspaceId !== workspaceId)) {
      throw new NotFoundException('Channel not found');
    }
    const isMember = channel.members.length > 0;
    if ((mustBeMember || channel.type === 'DIRECT' || channel.workspaceId == null) && !isMember) {
      throw new ForbiddenException('You are not a member of this channel');
    }
  }
}
