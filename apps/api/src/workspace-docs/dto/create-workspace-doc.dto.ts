import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWorkspaceDocDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsIn(['MAIN', 'PRIVATE', 'SHAREABLE'])
  privacy?: string;

  @IsOptional()
  @IsString()
  emoji?: string;
}
