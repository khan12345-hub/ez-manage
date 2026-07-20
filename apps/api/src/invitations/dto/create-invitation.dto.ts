import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkspaceMemberRole } from '../../../generated/prisma/client';

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
}
