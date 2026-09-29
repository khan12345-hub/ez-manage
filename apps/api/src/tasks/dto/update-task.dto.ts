import { IsOptional, IsString, IsEnum, IsInt, Min } from "class-validator";
import { RecurrenceType } from "generated/prisma/enums";

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrenceType?: RecurrenceType;

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrenceInterval?: number;

  @IsOptional()
  recurrenceEndDate?: Date | null;

  @IsOptional()
  @IsInt()
  sourceTaskId?: number | null;
}
