import { PartialType } from "@nestjs/mapped-types";

import { CreateBoardTemplateDto } from "./create-board-template.dto";

export class UpdateBoardTemplateDto extends PartialType(
  CreateBoardTemplateDto,
) {}