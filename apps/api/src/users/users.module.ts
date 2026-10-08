import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'prisma/prisma.service';
import { StorageModule } from 'src/storage/storage.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';

@Module({
  imports: [StorageModule, forwardRef(() => WhatsappModule)],
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
  exports: [UsersService],
})
export class UsersModule {}
