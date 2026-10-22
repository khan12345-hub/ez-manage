import { IsOptional, IsString, IsEnum, IsInt, Min, IsISO8601 } from "class-validator";
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

  // ISO-8601 timestamp the client received when it last read this task.
  // When present, the update is rejected with HTTP 409 if the task was
  // modified after that timestamp (optimistic concurrency guard).
  // Omitting this field preserves backward compatibility.
  @IsOptional()
  @IsISO8601()
  updatedAt?: string;
}
