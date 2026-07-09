import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { WorkspaceVisibility } from '../../../generated/prisma/client';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEnum(WorkspaceVisibility)
  visibility!: WorkspaceVisibility;
}
