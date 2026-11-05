
import { BoardAccessService } from 'src/boards/board-access.service';
import { Module } from "@nestjs/common";

import { ActivityLogsController } from "./activity-logs.controller";
import { ActivityLogsService } from "./activity-logs.service";

@Module({
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService, BoardAccessService],
  exports: [ActivityLogsService],
})
export class ActivityLogsModule {}

