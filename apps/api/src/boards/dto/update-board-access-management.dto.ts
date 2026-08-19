import { IsEnum } from "class-validator";
import { BoardMemberRole, BoardVisibility } from "generated/prisma/enums";
// import { BoardVisibility } from "@prisma/client";

export class UpdateBoardVisibilityDto {
  @IsEnum(BoardVisibility)
  visibility!: BoardVisibility;
}

export class UpdateBoardMemberRoleDto {
  @IsEnum(BoardMemberRole)
  role!: BoardMemberRole;
}