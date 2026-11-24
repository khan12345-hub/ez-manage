import { Global, Module } from '@nestjs/common';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { AccessAuditService } from './access-audit.service';
import { ProductAccessService } from './product-access.service';
import { ProductAdminService } from './product-admin.service';

/** Shared by every product: the Administrator's product switch, per-product Administrators and the access history. */
@Global()
@Module({
  imports: [NotificationsModule],
  providers: [ProductAccessService, ProductAdminService, AccessAuditService],
  exports: [ProductAccessService, ProductAdminService, AccessAuditService],
})
export class AccessCoreModule {}
