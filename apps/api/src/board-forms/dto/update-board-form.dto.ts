import { PartialType } from "@nestjs/mapped-types";
import { CreateBoardFormDto } from "./create-board-form.dto";

export class UpdateBoardFormDto extends PartialType(
  CreateBoardFormDto,
) {}