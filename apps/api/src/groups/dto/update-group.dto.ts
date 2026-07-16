import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsInt } from 'class-validator';
import { CreateGroupDto } from './create-group.dto';

export class UpdateGroupDto extends PartialType(
  OmitType(CreateGroupDto, ['boardId'] as const),
) {
  @IsInt()
  boardId!: number;
}