import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const HEX = /^#[0-9a-fA-F]{6}$/;
export const PRIORITIES = ['URGENT', 'HIGH', 'NORMAL', 'LOW'] as const;
export const CATEGORIES = ['NOT_STARTED', 'ACTIVE', 'DONE'] as const;

export class CreateSpaceDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @Matches(HEX) color?: string;
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
  @IsOptional() @IsBoolean() isPrivate?: boolean;
}
export class UpdateSpaceDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @Matches(HEX) color?: string;
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
  @IsOptional() @IsBoolean() isPrivate?: boolean;
  @IsOptional() @IsNumber() order?: number;
}
export class SpaceMembersDto {
  @IsArray() @ArrayMaxSize(500) @IsInt({ each: true }) @Type(() => Number) userIds!: number[];
}

export class CreateFolderDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
}
export class UpdateFolderDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsNumber() order?: number;
}

export class CreateListDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsInt() folderId?: number;
  @IsOptional() @Matches(HEX) color?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
export class UpdateListDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(HEX) color?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(2000) description?: string | null;
  /** move list into another folder of the same space; null = directly in the space */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() folderId?: number | null;
  @IsOptional() @IsNumber() order?: number;
}

export class CreateStatusDto {
  @IsString() @IsNotEmpty() @MaxLength(40) name!: string;
  @Matches(HEX) color!: string;
  @IsOptional() @IsIn(CATEGORIES) category?: (typeof CATEGORIES)[number];
  @IsOptional() @IsNumber() order?: number;
}
export class UpdateStatusDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(40) name?: string;
  @IsOptional() @Matches(HEX) color?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: (typeof CATEGORIES)[number];
  @IsOptional() @IsNumber() order?: number;
}

export class CreateTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(500) name!: string;
  @IsOptional() @IsInt() statusId?: number;
  @IsOptional() @IsInt() parentId?: number;
  @IsOptional() @IsIn(PRIORITIES) priority?: (typeof PRIORITIES)[number];
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) assigneeIds?: number[];
  @IsOptional() @IsString() @MaxLength(100000) description?: string;
}
export class UpdateTaskDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) name?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() statusId?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(PRIORITIES) priority?: (typeof PRIORITIES)[number] | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() startDate?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() dueDate?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) assigneeIds?: number[];
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(100000) description?: string | null;
  /** move to another list (same workspace); status is remapped by category */
  @IsOptional() @IsInt() listId?: number;
  @IsOptional() @IsNumber() order?: number;
}

export class CreateCommentDto {
  @IsString() @IsNotEmpty() @MaxLength(50000) content!: string;
  @IsOptional() @IsInt() parentId?: number;
}
export class UpdateCommentDto {
  @IsString() @IsNotEmpty() @MaxLength(50000) content!: string;
}
