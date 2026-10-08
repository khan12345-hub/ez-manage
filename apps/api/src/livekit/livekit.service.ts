import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LivekitService implements OnModuleInit {
  private readonly logger    = new Logger(LivekitService.name);
  private readonly apiKey    = process.env.LIVEKIT_API_KEY    ?? '';
  private readonly apiSecret = process.env.LIVEKIT_API_SECRET ?? '';
  readonly wsUrl             = process.env.LIVEKIT_URL        ?? '';

  onModuleInit() {
    if (this.isConfigured()) {
      this.logger.log(`LiveKit configured — ${this.wsUrl}`);
    } else {
      this.logger.warn('LiveKit NOT configured — LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing');
    }
  }

  async createToken(userId: string, userName: string, roomName: string): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: userName,
      ttl: '4h',
    });
    at.addGrant({
      roomJoin:     true,
      room:         roomName,
      canPublish:   true,
      canSubscribe: true,
    });
    return await at.toJwt();
  }

  roomName(channelId: number): string {
    return `ez-ch${channelId}-${Date.now()}`;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiSecret && this.wsUrl);
  }
}
