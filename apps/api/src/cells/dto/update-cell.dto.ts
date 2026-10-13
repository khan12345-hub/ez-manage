import { IsDefined } from "class-validator";

export class UpdateCellDto {
  @IsDefined()
  value!: any;
}
