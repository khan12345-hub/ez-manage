import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AutomationActionType,
  AutomationTriggerType,
} from 'generated/prisma/enums';

export class CreateAutomationTriggerDto {
  @IsEnum(AutomationTriggerType)
  type!: AutomationTriggerType;

  // STATUS_CHANGED
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  columnId?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  statusId?: number;

  // DATE_ARRIVED — which DATE column to watch
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CreateAutomationActionDto {
  @IsEnum(AutomationActionType)
  type!: AutomationActionType;

  // MOVE_TO_GROUP
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  groupId?: number;

  // All other actions store their config here
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CreateAutomationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateNested()
  @Type(() => CreateAutomationTriggerDto)
  trigger!: CreateAutomationTriggerDto;

  @ValidateNested()
  @Type(() => CreateAutomationActionDto)
  action!: CreateAutomationActionDto;
}
