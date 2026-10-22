import { IsDefined, IsISO8601, IsOptional } from "class-validator";

export class UpdateCellDto {
  @IsDefined()
  value!: any;

  // ISO-8601 timestamp the client received when it last read this cell.
  // When present, the update is rejected with HTTP 409 if the cell was
  // modified after that timestamp (optimistic concurrency guard).
  // Omitting this field preserves backward compatibility.
  @IsOptional()
  @IsISO8601()
  updatedAt?: string;
}
