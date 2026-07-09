import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(
    private readonly workspaceAccess: WorkspaceAccessService
    
) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const workspaceId =
      Number(request.params.workspaceId) || Number(request.body.workspaceId);
    const userId = request.user.id;

    const member = await this.workspaceAccess.getWorkspaceMember(
      workspaceId,
      userId,
    );

    if (!member) {
      throw new ForbiddenException();
    }
    return true;
  }
}
