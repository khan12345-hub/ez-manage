import { Module } from '@nestjs/common';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { VaultAuthGuard } from './vault.guard';

/** EZ Vault — zero-knowledge password manager (web + browser extension). */
@Module({ controllers: [VaultController], providers: [VaultService, VaultAuthGuard] })
export class VaultModule {}
