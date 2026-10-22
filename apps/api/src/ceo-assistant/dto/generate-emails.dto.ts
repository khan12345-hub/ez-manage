import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateEmailsDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @Type(() => Number)
  employeeIds: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: ('overdue' | 'due_soon' | 'inactive')[] = ['overdue', 'due_soon', 'inactive'];

  @IsOptional()
  @IsString()
  @IsIn(['professional', 'friendly', 'firm'])
  tone?: string = 'professional';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  inactivityDays?: number = 3;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  upcomingDays?: number = 7;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  templateId?: number;
}
