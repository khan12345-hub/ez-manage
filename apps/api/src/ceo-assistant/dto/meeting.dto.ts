import { IsString, IsOptional, IsDateString, IsArray, IsInt, IsUrl, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export type ExternalAttendee = { email: string; name?: string };

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

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  attendeeIds?: number[];

  /** people who are not app users (e.g. a CRM contact) — invited by email */
  @IsOptional()
  @IsArray()
  attendeeEmails?: ExternalAttendee[];

  // optional CRM link: the meeting shows on this contact/company's record
  @IsOptional() @IsInt() @Type(() => Number) crmWorkspaceId?: number;
  @IsOptional() @IsInt() @Type(() => Number) crmContactId?: number;
  @IsOptional() @IsInt() @Type(() => Number) crmCompanyId?: number;
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
  @IsInt({ each: true })
  @Type(() => Number)
  attendeeIds?: number[];

  @IsOptional()
  @IsArray()
  attendeeEmails?: ExternalAttendee[];
}

export class ListMeetingsDto {
  @IsOptional()
  upcoming?: boolean;
}
