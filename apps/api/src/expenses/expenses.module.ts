import { Module } from '@nestjs/common';
import { StorageModule } from 'src/storage/storage.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [StorageModule, NotificationsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
