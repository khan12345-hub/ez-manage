// update-task.dto.ts

import { IsOptional, IsString } from "class-validator";

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  name?: string;
}