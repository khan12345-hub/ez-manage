import { Module } from '@nestjs/common';
import { PublicBoardFormsService } from './public-board-forms.service';
import { PublicBoardFormsController } from './public-board-forms.controller';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [PublicBoardFormsController],
  providers: [PublicBoardFormsService, PrismaService],
})
export class PublicBoardFormsModule {}
