import { Module } from '@nestjs/common';
import { GuestAccessController, GuestAccessPublicController } from './guest-access.controller';
import { GuestAccessService } from './guest-access.service';

@Module({
  controllers: [GuestAccessController, GuestAccessPublicController],
  providers: [GuestAccessService],
})
export class GuestAccessModule {}
