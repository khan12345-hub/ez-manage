import {
  Controller,
  Delete,
  Get,
  
  Patch,
  Query,
} from "@nestjs/common";

import { NotificationsService } from "./notifications.service";
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

import { GetNotificationsDto } from "./dto/get-notifications.dto";
import { SessionUser } from "src/auth/types/session-user.type";

@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notificationsService:
      NotificationsService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser () user: SessionUser,

    @Query()
    query: GetNotificationsDto,
  ) {
    return this.notificationsService.findAll(
      user.id,

      query.page,

      query.limit,
    );
  }

  @Get("unread-count")
  async getUnreadCount(
    @CurrentUser() user: SessionUser,
  ) {
    const count =
      await this.notificationsService.getUnreadCount(
        user.id,
      );

    return {
      count,
    };
  }

  @Patch(":id/read")
  async markAsRead(
    @CurrentUser() user: SessionUser,

    notificationId: string,
  ) {
    return this.notificationsService.markAsRead(
      notificationId,

      user.id,
    );
  }

  @Patch("read-all")
  async markAllAsRead(
    @CurrentUser() user: SessionUser,
  ) {
    return this.notificationsService.markAllAsRead(
      user.id,
    );
  }

  @Delete(":id")
  async remove(
    @CurrentUser() user: SessionUser,
    notificationId: string,
  ) {
    return this.notificationsService.remove(
      notificationId,

      user.id,
    );
  }
}