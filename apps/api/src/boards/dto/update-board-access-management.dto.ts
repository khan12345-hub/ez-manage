import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional } from "class-validator";
import { BoardMemberRole, BoardVisibility } from "generated/prisma/enums";

export class UpdateBoardVisibilityDto {
  @IsEnum(BoardVisibility)
  visibility!: BoardVisibility;
}

export class UpdateBoardMemberRoleDto {
  @IsEnum(BoardMemberRole)
  role!: BoardMemberRole;
}

export class UpdateMemberGroupAccessDto {
  @IsBoolean()
  accessAllGroups!: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  groupIds?: number[];
}