import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsObject,
  IsOptional, IsString, Max, MaxLength, Min, ValidateIf, ValidateNested,
} from 'class-validator';

export const CRM_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export const LIFECYCLES = ['subscriber', 'lead', 'mql', 'sql', 'opportunity', 'customer', 'evangelist', 'other'] as const;
export const LEAD_STATUSES = ['new', 'open', 'in_progress', 'attempted', 'connected', 'unqualified', 'bad_timing'] as const;
export const ACTIVITY_KINDS = ['note', 'call', 'meeting', 'email_log', 'task'] as const;
export const OBJECTS = ['contact', 'company', 'deal'] as const;
export const PROP_TYPES = ['text', 'number', 'date', 'select', 'multiselect', 'bool', 'url'] as const;
export const DEAL_PRIORITIES = ['low', 'medium', 'high'] as const;

const nullable = (_: unknown, v: unknown) => v !== null;

export class CreateCrmWorkspaceDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
}
export class UpdateCrmWorkspaceDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
}
export class AddCrmMemberDto {
  @IsEmail() @MaxLength(200) email!: string;
  @IsIn(CRM_ROLES) role!: (typeof CRM_ROLES)[number];
}
export class UpdateCrmMemberDto {
  @IsIn(CRM_ROLES) role!: (typeof CRM_ROLES)[number];
}

export class CompanyDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(200) domain?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(120) industry?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(40) size?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(60) phone?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(120) country?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsInt() ownerId?: number | null;
  @IsOptional() @IsObject() custom?: Record<string, unknown>;
}

export class ContactDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) firstName?: string;
  @IsOptional() @IsString() @MaxLength(120) lastName?: string;
  @IsOptional() @ValidateIf(nullable) @IsEmail() @MaxLength(200) email?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(60) phone?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(160) title?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsInt() companyId?: number | null;
  @IsOptional() @ValidateIf(nullable) @IsInt() ownerId?: number | null;
  @IsOptional() @IsIn(LIFECYCLES) lifecycle?: (typeof LIFECYCLES)[number];
  @IsOptional() @ValidateIf(nullable) @IsIn(LEAD_STATUSES) leadStatus?: (typeof LEAD_STATUSES)[number] | null;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(120) source?: string | null;
  @IsOptional() @IsObject() custom?: Record<string, unknown>;
}

export class DealDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999999999999) amount?: number;
  @IsOptional() @IsInt() pipelineId?: number;
  @IsOptional() @IsInt() stageId?: number;
  @IsOptional() @ValidateIf(nullable) @IsDateString() closeDate?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsInt() ownerId?: number | null;
  @IsOptional() @ValidateIf(nullable) @IsIn(DEAL_PRIORITIES) priority?: (typeof DEAL_PRIORITIES)[number] | null;
  @IsOptional() @ValidateIf(nullable) @IsInt() companyId?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) contactIds?: number[];
  @IsOptional() @IsObject() custom?: Record<string, unknown>;
}

export class MoveDealDto {
  @IsInt() stageId!: number;
  /** place before this deal in the column (null = end) */
  @IsOptional() @ValidateIf(nullable) @IsInt() beforeId?: number | null;
  @IsOptional() @IsString() @MaxLength(500) lostReason?: string;
}

export class BulkDto {
  @IsIn(OBJECTS) object!: (typeof OBJECTS)[number];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsInt({ each: true }) ids!: number[];
  @IsIn(['delete', 'owner', 'lifecycle', 'stage']) action!: 'delete' | 'owner' | 'lifecycle' | 'stage';
  @IsOptional() @ValidateIf(nullable) @IsInt() ownerId?: number | null;
  @IsOptional() @IsIn(LIFECYCLES) lifecycle?: (typeof LIFECYCLES)[number];
  @IsOptional() @IsInt() stageId?: number;
}

export class ActivityDto {
  @IsIn(ACTIVITY_KINDS) kind!: (typeof ACTIVITY_KINDS)[number];
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(300) subject?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(20000) body?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsDateString() dueAt?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(60) outcome?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsInt() @Min(0) @Max(100000) durationMin?: number | null;
  @IsOptional() @ValidateIf(nullable) @IsInt() assigneeId?: number | null;
  @IsOptional() @ValidateIf(nullable) @IsInt() contactId?: number | null;
  @IsOptional() @ValidateIf(nullable) @IsInt() companyId?: number | null;
  @IsOptional() @ValidateIf(nullable) @IsInt() dealId?: number | null;
}
export class UpdateActivityDto {
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(300) subject?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(20000) body?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsDateString() dueAt?: string | null;
  @IsOptional() @IsBoolean() done?: boolean;
  @IsOptional() @ValidateIf(nullable) @IsString() @MaxLength(60) outcome?: string | null;
  @IsOptional() @ValidateIf(nullable) @IsInt() assigneeId?: number | null;
}

export class StageInputDto {
  @IsOptional() @IsInt() id?: number;
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsInt() @Min(0) @Max(100) probability!: number;
  @IsOptional() @IsBoolean() isWon?: boolean;
  @IsOptional() @IsBoolean() isLost?: boolean;
}
export class PipelineDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  /** full ordered list of stages (existing ones keep their id); missing ones are removed if empty */
  @IsOptional() @IsArray() @ArrayMinSize(2) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => StageInputDto) stages?: StageInputDto[];
}

export class PropertyDto {
  @IsIn(OBJECTS) object!: (typeof OBJECTS)[number];
  @IsString() @IsNotEmpty() @MaxLength(80) label!: string;
  @IsIn(PROP_TYPES) type!: (typeof PROP_TYPES)[number];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(80, { each: true }) options?: string[];
}
export class UpdatePropertyDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) label?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) @MaxLength(80, { each: true }) options?: string[];
  @IsOptional() @IsInt() position?: number;
}

export class ViewDto {
  @IsIn(OBJECTS) object!: (typeof OBJECTS)[number];
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
}
export class UpdateViewDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
}
