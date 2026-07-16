import { IsObject } from "class-validator";

export class UpdateCellDto {
  @IsObject()
  value!: any;
}