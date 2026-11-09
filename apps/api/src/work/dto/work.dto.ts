import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  Max,
  Min,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  IsObject,
  Allow,
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
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) tagIds?: number[];
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
  /** minutes */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(100000) timeEstimate?: number | null;
  /** replaces the task's tags; tags must belong to the task's space */
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) tagIds?: number[];
  @IsOptional() @IsNumber() order?: number;
}

export class CreateCommentDto {
  @IsString() @IsNotEmpty() @MaxLength(50000) content!: string;
  @IsOptional() @IsInt() parentId?: number;
  /** assign the comment to someone (action item) */
  @IsOptional() @IsInt() assigneeId?: number;
  /** files uploaded from the composer (source=comment) to attach to this comment */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsInt({ each: true }) attachmentIds?: number[];
  /** people @mentioned in the comment */
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) mentionIds?: number[];
}
export class CreateReminderDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsDateString() remindAt!: string;
  @IsOptional() @IsInt() assigneeId?: number;
  @IsOptional() @IsString() @MaxLength(40) taskUid?: string;
}
export class UpdateReminderDto {
  @IsOptional() @IsBoolean() done?: boolean;
  @IsOptional() @IsDateString() remindAt?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) title?: string;
}
export class CreateFieldDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsIn(['text', 'textarea', 'number', 'money', 'date', 'dropdown', 'labels', 'checkbox', 'email', 'phone', 'url', 'rating', 'progress', 'people']) type!: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}
export class UpdateFieldDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
  @IsOptional() @IsNumber() order?: number;
}
export class FieldValueDto {
  /** any JSON; validated per field type in the service */
  @Allow() value!: unknown;
}
export class ReactionDto {
  @IsString() @IsNotEmpty() @MaxLength(16) emoji!: string;
}
export class NotificationPrefDto {
  @IsString() @MaxLength(40) kind!: string;
  @IsBoolean() inbox!: boolean;
  @IsBoolean() email!: boolean;
  @IsBoolean() browser!: boolean;
}
export class InboxBulkDto {
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) ids!: string[];
  @IsIn(['clear', 'unclear', 'snooze', 'unsnooze', 'read', 'unread']) action!: 'clear' | 'unclear' | 'snooze' | 'unsnooze' | 'read' | 'unread';
  @IsOptional() @IsDateString() until?: string;
}
export class WorkInviteDto {
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(254, { each: true }) emails!: string[];
  @IsIn(['ADMIN', 'MEMBER', 'LIMITED_MEMBER', 'GUEST']) role!: 'ADMIN' | 'MEMBER' | 'LIMITED_MEMBER' | 'GUEST';
}
export class WorkRoleDto {
  @IsIn(['ADMIN', 'MEMBER', 'LIMITED_MEMBER', 'GUEST']) role!: 'ADMIN' | 'MEMBER' | 'LIMITED_MEMBER' | 'GUEST';
}
export class CreateWebLinkDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) url!: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
}
export class UpdateCommentDto {
  @IsString() @IsNotEmpty() @MaxLength(50000) content!: string;
}

export class CreateTagDto {
  @IsString() @IsNotEmpty() @MaxLength(40) name!: string;
  @Matches(HEX) color!: string;
}

export class CreateChecklistDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
}
export class UpdateChecklistDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string;
  @IsOptional() @IsNumber() order?: number;
}
export class CreateChecklistItemDto {
  @IsString() @IsNotEmpty() @MaxLength(500) name!: string;
  @IsOptional() @IsInt() assigneeId?: number;
}
export class UpdateChecklistItemDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) name?: string;
  @IsOptional() @IsBoolean() done?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() assigneeId?: number | null;
  @IsOptional() @IsNumber() order?: number;
}

export const LINK_TYPES = ['WAITING_ON', 'BLOCKING', 'LINKED'] as const;
export class CreateLinkDto {
  @IsInt() taskId!: number;
  /** WAITING_ON: this task waits on taskId; BLOCKING: this task blocks taskId; LINKED: related */
  @IsIn(LINK_TYPES) type!: (typeof LINK_TYPES)[number];
}

export class ManualTimeDto {
  @IsDateString() startedAt!: string;
  /** seconds */
  @IsInt() @Min(60) @Max(24 * 3600) duration!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsBoolean() billable?: boolean;
}
