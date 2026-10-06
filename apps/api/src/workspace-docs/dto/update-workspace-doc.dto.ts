import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateWorkspaceDocDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  content?: any;

  @IsOptional()
  @IsIn(['MAIN', 'PRIVATE', 'SHAREABLE'])
  privacy?: string;

  @IsOptional()
  @IsString()
  emoji?: string;
}
