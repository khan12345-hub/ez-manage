import { Controller, Get, Post, Body, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { WhatsappService } from './whatsapp.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);
  private readonly verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? 'ezmanage_verify';

  constructor(private readonly whatsappService: WhatsappService) {}

  /**
   * Meta webhook verification (GET).
   * Meta calls this once to confirm the webhook URL.
   */
  @Public()
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('WhatsApp webhook verified');
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  }

  /**
   * Meta webhook event receiver (POST).
   * Receives inbound messages and status updates.
   */
  @Public()
  @Post('webhook')
  async receiveWebhook(@Body() body: any, @Res() res: Response) {
    // Always respond 200 immediately — Meta requires fast ACK
    res.status(200).send('OK');

    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages: any[] = value?.messages ?? [];

      for (const msg of messages) {
        if (msg.type !== 'text') continue;
        const from: string = msg.from;
        const text: string = msg.text?.body ?? '';
        this.logger.log(`Inbound WhatsApp from ${from}: ${text}`);

        const reply = await this.whatsappService.handleInbound(from, text);
        await this.whatsappService.send(from, reply);
      }
    } catch (err) {
      this.logger.error('Webhook processing error', err);
    }
  }
}
