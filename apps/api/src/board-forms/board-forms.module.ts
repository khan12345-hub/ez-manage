import { Module } from "@nestjs/common";

import { BoardFormsController } from "./board-forms.controller";
import { BoardFormsService } from "./board-forms.service";

@Module({
  controllers: [BoardFormsController],
  providers: [BoardFormsService],
  exports: [BoardFormsService],
})
export class BoardFormsModule {}