import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { BoardColumnType } from "generated/prisma/enums";

export class UpdateColumnDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsEnum(BoardColumnType)
  @IsOptional()
  type?: BoardColumnType;

  @IsString()
  @IsOptional()
  formula?: string;
}