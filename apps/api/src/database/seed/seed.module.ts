import { Module } from '@nestjs/common';
// import { postgresProvider } from '../postgres.provider';
import { SeedService } from './seed.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { PrismaService } from 'prisma/prisma.service';
@Module({
  imports:[PrismaModule],
  providers: [SeedService, PrismaService],
})
export class SeedModule {}