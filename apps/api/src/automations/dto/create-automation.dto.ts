import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AutomationActionType, AutomationTriggerType } from 'generated/prisma/enums';



export class CreateAutomationTriggerDto {
  @IsEnum(AutomationTriggerType)
  type!: AutomationTriggerType;

  @IsInt()
  @Type(() => Number)
  columnId!: number;

  @IsInt()
  @Type(() => Number)
  statusId!: number;
}

export class CreateAutomationActionDto {
  @IsEnum(AutomationActionType)
  type!: AutomationActionType;

  @IsInt()
  @Type(() => Number)
  groupId!: number;
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