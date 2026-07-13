import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { WorkspaceVisibility } from '../../../generated/prisma/client';

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Workspace name must be at least 1 character' })
  @MaxLength(100, { message: 'Workspace name must not exceed 100 characters' })
  name?: string;

  @IsOptional()
  @IsEnum(WorkspaceVisibility)
  visibility?: WorkspaceVisibility;
}
