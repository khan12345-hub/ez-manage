import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkspaceMemberRole } from '../../../generated/prisma/client';

export class BoardGroupAccessDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  boardId!: number;

  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  groupIds!: number[];
}

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  workspaceId!: number;

  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  boardIds!: number[];

  @IsEnum(WorkspaceMemberRole)
  role!: WorkspaceMemberRole;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoardGroupAccessDto)
  boardGroupAccess?: BoardGroupAccessDto[];
}
