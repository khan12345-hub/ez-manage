import { Module } from '@nestjs/common';
import { postgresProvider } from '../postgres.provider';
import { SeedService } from './seed.service';

@Module({
  providers: [postgresProvider, SeedService],
})
export class SeedModule {}