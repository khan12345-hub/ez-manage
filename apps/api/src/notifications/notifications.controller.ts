import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import { Request, Response } from 'express';

import { NotificationsService } from './notifications.service';

import { NotificationStreamService } from './notification-stream.service';

import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

import { GetNotificationsDto } from './dto/get-notifications.dto';

import { SessionUser } from 'src/auth/types/session-user.type';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,

    private readonly notificationStreamService: NotificationStreamService,
  ) {}

  /**

* Get paginated notifications.
  */
  @Get()
  async findAll(
    @CurrentUser() user: SessionUser,

    @Query()
    query: GetNotificationsDto,
  ) {
    return this.notificationsService.findAll(
      user.id,

      query.page,

      query.limit,
    );
  }

  /**

* Get unread notification count.
  */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: SessionUser) {
    const count = await this.notificationsService.getUnreadCount(user.id);

    return {
      count,
    };
  }

  /**

* Server-Sent Events notification stream.
*
* The frontend keeps this connection open.
*
* Whenever a new notification is created
* for the current user, it is pushed through
* this connection in real-time.
  */
  @Get('stream')
  stream(
    @CurrentUser() user: SessionUser,

    @Req() req: Request,

    @Res() res: Response,
  ) {
    const userId = user.id;

    console.log(`[SSE] Opening notification stream for user ${userId}`);

    /**
     * Configure SSE response.
     */
    res.setHeader('Content-Type', 'text/event-stream');

    res.setHeader('Cache-Control', 'no-cache, no-transform');

    res.setHeader('Connection', 'keep-alive');

    /**
     * Prevent Nginx from buffering SSE events.
     */
    res.setHeader('X-Accel-Buffering', 'no');

    /**
     * Send headers immediately.
     */
    res.flushHeaders();

    /**
     * Send initial connection event.
     */
    res.write(
      `event: connected\n` +
        `data: ${JSON.stringify({
          connected: true,
        })}\n\n`,
    );

    /**
     * Subscribe this user to their
     * notification stream.
     */
    const { observable, cleanup } =
      this.notificationStreamService.connect(userId);

    /**
     * Listen for new notifications.
     */
    const subscription = observable.subscribe({
      next: (event) => {
        const eventType: string = event.__sse_event_type ?? 'notification';
        const { __sse_event_type: _type, ...data } = event;
        res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
      },

      error: (error) => {
        console.error(`[SSE] Stream error for user ${userId}:`, error);
      },
    });

    /**
     * Heartbeat.
     *
     * Keeps the connection alive when
     * there are no notifications.
     */
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30_000);

    /**
     * Browser disconnected.
     */
    req.on('close', () => {
      console.log(`[SSE] Closing notification stream for user ${userId}`);

      clearInterval(heartbeat);

      subscription.unsubscribe();

      cleanup();

      res.end();
    });
  }

  /**

* Mark one notification as read.
  */
  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: SessionUser,

    @Param('id')
    notificationId: string,
  ) {
    return this.notificationsService.markAsRead(
      notificationId,

      user.id,
    );
  }

  /**

* Mark all notifications as read.
  */
  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: SessionUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  /**
   * Delete all notifications for the current user.
   */
  @Delete()
  async removeAll(@CurrentUser() user: SessionUser) {
    return this.notificationsService.removeAll(user.id);
  }

  /**

* Delete one notification.
  */
  @Delete(':id')
  async remove(
    @CurrentUser() user: SessionUser,

    @Param('id')
    notificationId: string,
  ) {
    return this.notificationsService.remove(
      notificationId,

      user.id,
    );
  }
}
