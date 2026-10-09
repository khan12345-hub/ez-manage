
import { Type } from "class-transformer";
import { ExcelColumnMappingDto } from "./excel-column-mapping.dto";

enum WorkspaceVisibility {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
  IsObject,
} from 'class-validator';

export class UserToCreateDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'GUEST'])
  workspaceRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';

  @IsOptional()
  @IsEnum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
  boardRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export class ImportedCommentDto {
  @IsString()
  itemId!: string;

  @IsString()
  contentType!: string;

  @IsString()
  user!: string;

  @IsString()
  createdAt!: string;

  @IsString()
  content!: string;

  @IsArray()
  assetIds!: string[];

  @IsString()
  postId!: string;

  @IsString()
  parentPostId!: string;
}

export class ImportExcelBoardDto {
  @IsString()
  boardName!: string;

  @IsEnum(WorkspaceVisibility)
  visibility!: WorkspaceVisibility;

  @IsInt()
  workspaceId!: number;

  @IsString()
  taskColumn!: string;

  @IsOptional()
  @IsString()
  groupColumn?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExcelColumnMappingDto)
  columns!: ExcelColumnMappingDto[];

  @IsArray()
  @IsObject({ each: true })
  @Type(() => Object)
  rows!: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportedCommentDto)
  comments?: ImportedCommentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserToCreateDto)
  usersToCreate?: UserToCreateDto[];
}