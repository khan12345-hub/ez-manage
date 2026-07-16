import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { CellsService } from './cells.service';
import { CreateCellDto } from './dto/create-cell.dto';
import { UpdateCellDto } from './dto/update-cell.dto';
import { SessionUser } from 'src/auth/types/session-user.type';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('cells')
export class CellsController {
  constructor(private readonly cellsService: CellsService) {}

  @Post()
  create(@Body() createCellDto: CreateCellDto) {
    return this.cellsService.create(createCellDto);
  }

  @Get()
  findAll() {
    return this.cellsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cellsService.findOne(+id);
  }

  @Patch(':id')
  updateCell(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCellDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.cellsService.updateCell(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cellsService.remove(+id);
  }
}
