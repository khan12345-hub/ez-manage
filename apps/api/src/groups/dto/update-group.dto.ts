import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { CreateGroupDto } from './create-group.dto';

export class UpdateGroupDto {
  
  @IsOptional()
  @IsString()
  name?: string;
  @IsOptional()
  @IsString()
  color?: string;
}