import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GuestAccessService } from './guest-access.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';

/** Authenticated — generate / revoke / read token for a board */
@Controller('boards/:boardId/guest-token')
@UseGuards(SessionAuthGuard)
export class GuestAccessController {
  constructor(private readonly guestAccessService: GuestAccessService) {}

  @Get()
  getToken(
    @Param('boardId', ParseIntPipe) boardId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.guestAccessService.getToken(boardId, user.id);
  }

  @Post()
  generateToken(
    @Param('boardId', ParseIntPipe) boardId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.guestAccessService.generateToken(boardId, user.id);
  }

  @Delete()
  revokeToken(
    @Param('boardId', ParseIntPipe) boardId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.guestAccessService.revokeToken(boardId, user.id);
  }
}

/** Public — view board by token (no auth required) */
@Controller('public/guest')
export class GuestAccessPublicController {
  constructor(private readonly guestAccessService: GuestAccessService) {}

  @Public()
  @Get(':token')
  getBoardByToken(@Param('token') token: string) {
    return this.guestAccessService.getBoardByToken(token);
  }
}
