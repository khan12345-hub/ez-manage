import { PartialType } from '@nestjs/mapped-types';
import { CreatePublicBoardFormDto } from './create-public-board-form.dto';

export class UpdatePublicBoardFormDto extends PartialType(CreatePublicBoardFormDto) {}
