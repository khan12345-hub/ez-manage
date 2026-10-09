import { Module } from "@nestjs/common";

import { BoardFormsController } from "./board-forms.controller";
import { BoardFormsService } from "./board-forms.service";
import { BoardAccessService } from "src/boards/board-access.service";

@Module({
  controllers: [BoardFormsController],
  providers: [BoardFormsService, BoardAccessService],
  exports: [BoardFormsService],
})
export class BoardFormsModule {}