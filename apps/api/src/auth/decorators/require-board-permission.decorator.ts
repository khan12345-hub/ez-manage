import { SetMetadata } from '@nestjs/common';
import { BoardPermission } from '@repo/shared';

export const BOARD_PERMISSION_KEY = 'board_permission';

export const RequireBoardPermission = (
  permission: BoardPermission,
) => SetMetadata(BOARD_PERMISSION_KEY, permission);