import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'prisma/prisma.service';
import { LocalStorageService } from 'src/storage/local-storage.service';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';

@Module({
  imports: [forwardRef(() => WhatsappModule)],
  controllers: [UsersController],
  providers: [UsersService, PrismaService, LocalStorageService],
  exports: [UsersService],
})
export class UsersModule {}
