import { IsArray, IsInt, IsOptional, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetOverviewDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  workspaceIds?: number[];

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
}
