import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export enum SearchType {
  ALL = "all",
  TASKS = "tasks",
  BOARDS = "boards",
  GROUPS = "groups",
  USERS = "users",
  FILES = "files",
}

export class SearchDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  q!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  workspaceId!: number;

  @IsOptional()
  @IsEnum(SearchType)
  type?: SearchType = SearchType.ALL;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 5;
}