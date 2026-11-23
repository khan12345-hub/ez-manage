import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { ExpensesService } from './expenses.service';
import { CategoryDto, CreateClaimDto, EditClaimDto, RejectDto } from './dto/expenses.dto';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  // ── lists ──
  @Get('workspaces/:ws/claims')
  list(@Param('ws') ws: string, @Query('scope') scope = 'mine', @CurrentUser() u: SessionUser) {
    return this.expenses.list(ws, u.id, ['mine', 'review', 'pay', 'all'].includes(scope) ? scope : 'mine');
  }

  @Get('workspaces/:ws/summary')
  summary(@Param('ws') ws: string, @CurrentUser() u: SessionUser) {
    return this.expenses.summary(ws, u.id);
  }

  @Get('workspaces/:ws/categories')
  categories(@Param('ws') ws: string, @CurrentUser() u: SessionUser) {
    return this.expenses.categories(ws, u.id);
  }

  @Get('consumption')
  consumption(@Query('ws') ws: string, @Query('from') from: string, @Query('to') to: string, @CurrentUser() u: SessionUser) {
    const ids = (ws ?? '').split(',').map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);
    return this.expenses.consumption(u.id, ids, from, to);
  }

  @Get('claims/:id')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.expenses.detail(id, u.id);
  }

  // ── create / edit / lifecycle ──
  @Post('workspaces/:ws/claims')
  @Throttle({ auth: { ttl: 60_000, limit: 30 } })
  create(@Param('ws') ws: string, @Body() dto: CreateClaimDto, @CurrentUser() u: SessionUser) {
    return this.expenses.create(ws, u.id, dto);
  }

  @Patch('claims/:id')
  edit(@Param('id', ParseIntPipe) id: number, @Body() dto: EditClaimDto, @CurrentUser() u: SessionUser) {
    return this.expenses.edit(id, u.id, dto);
  }

  @Post('claims/:id/submit')
  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.expenses.submit(id, u.id);
  }

  @Post('claims/:id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.expenses.approve(id, u.id);
  }

  @Post('claims/:id/pay')
  pay(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.expenses.pay(id, u.id);
  }

  @Post('claims/:id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectDto, @CurrentUser() u: SessionUser) {
    return this.expenses.reject(id, u.id, dto.reason);
  }

  @Delete('claims/:id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.expenses.remove(id, u.id);
  }

  // ── receipts ──
  @Post('claims/:id/receipts')
  @Throttle({ auth: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(FileInterceptor('file'))
  addReceipt(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @CurrentUser() u: SessionUser) {
    return this.expenses.addReceipt(id, u.id, file);
  }

  @Delete('receipts/:id')
  removeReceipt(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.expenses.removeReceipt(id, u.id);
  }

  // ── categories (managers) ──
  @Post('workspaces/:ws/categories')
  createCategory(@Param('ws') ws: string, @Body() dto: CategoryDto, @CurrentUser() u: SessionUser) {
    return this.expenses.createCategory(ws, u.id, dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoryDto, @CurrentUser() u: SessionUser) {
    return this.expenses.updateCategory(id, u.id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.expenses.deleteCategory(id, u.id);
  }
}
