import { Global, Module } from '@nestjs/common';
import { postgresProvider } from './postgres.provider';

@Global()
@Module({
  providers: [postgresProvider],
  exports: [postgresProvider],
})
export class DatabaseModule {}