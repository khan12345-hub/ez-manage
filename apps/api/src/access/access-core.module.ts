import { Global, Module } from '@nestjs/common';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { AccessAuditService } from './access-audit.service';
import { ProductAccessService } from './product-access.service';

/** Shared by every product: the Administrator's product switch and the access history. */
@Global()
@Module({
  imports: [NotificationsModule],
  providers: [ProductAccessService, AccessAuditService],
  exports: [ProductAccessService, AccessAuditService],
})
export class AccessCoreModule {}
