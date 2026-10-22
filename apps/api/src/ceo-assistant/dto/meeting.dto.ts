import { IsString, IsOptional, IsDateString, IsArray, IsInt, IsUrl, MinLength, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMeetingDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  meetingLink?: string;

  @IsDateString()
  scheduledAt: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  attendeeIds: number[];
}

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  meetingLink?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  attendeeIds?: number[];
}

export class ListMeetingsDto {
  @IsOptional()
  upcoming?: boolean;
}
