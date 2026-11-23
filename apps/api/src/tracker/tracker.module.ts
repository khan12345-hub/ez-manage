import { Module } from '@nestjs/common';
import { StorageModule } from 'src/storage/storage.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TrackerController, TrackerDesktopController } from './tracker.controller';
import { TrackerDeviceGuard } from './tracker.guard';
import { TrackerService } from './tracker.service';

/** EZ Tracker — time, screenshots and activity from the desktop app (5th product). */
@Module({ imports: [StorageModule, NotificationsModule], controllers: [TrackerDesktopController, TrackerController], providers: [TrackerService, TrackerDeviceGuard] })
export class TrackerModule {}
