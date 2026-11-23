import { Module } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { VaultAuthGuard } from './vault.guard';
import { NotificationsModule } from 'src/notifications/notifications.module';

/** EZ Vault — zero-knowledge password manager (web + browser extension). */
@Module({ imports: [NotificationsModule], controllers: [VaultController], providers: [VaultService, VaultAuthGuard], exports: [VaultService] })
export class VaultModule {}
