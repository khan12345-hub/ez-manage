import { Module } from "@nestjs/common";

import { BoardTemplatesController } from "./board-templates.controller";
import { BoardTemplatesService } from "./board-templates.service";

@Module({
  controllers: [
    BoardTemplatesController,
  ],

  providers: [
    BoardTemplatesService,
  ],

  exports: [
    BoardTemplatesService,
  ],
})
export class BoardTemplatesModule {}