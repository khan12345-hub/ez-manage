import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class InboxActionDto {
  @IsIn(['clear', 'unclear', 'snooze', 'unsnooze', 'read', 'unread'])
  action!: 'clear' | 'unclear' | 'snooze' | 'unsnooze' | 'read' | 'unread';

  /** snooze until (ISO date) */
  @IsOptional() @IsDateString() until?: string;
}
