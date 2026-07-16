import { IsEnum, IsInt } from "class-validator";
import { Type } from "class-transformer";
import { BoardColumnType } from "generated/prisma/enums";

export class CreateColumnDto {
  @Type(() => Number)
  @IsInt()
  boardId!: number;

  @IsEnum(BoardColumnType)
  type!: BoardColumnType;
}