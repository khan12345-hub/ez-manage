import { BadRequestException, Body, CanActivate, Controller, Delete, ExecutionContext, ForbiddenException, Get, Injectable, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards, createParamDecorator } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { AccessService, type Actor, type InviteBody } from './access.service';
import { PRODUCTS, ProductAccessService, type Product } from './product-access.service';

const int = (v?: string) => (/^\d+$/.test(v ?? '') ? Number(v) : undefined);
const product = (p: string): Product => {
  if (!PRODUCTS.includes(p as Product)) throw new BadRequestException('Unknown product.');
  return p as Product;
};

/** Administrators, and Access Managers (only inside their companies) */
@Injectable()
export class AccessCenterGuard implements CanActivate {
  constructor(private readonly access: AccessService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const id = req.session?.user?.id;
    const actor = id ? await this.access.actor(id) : null;
    if (!actor) throw new ForbiddenException('Only the Administrator and Access Managers can open the Access Center.');
    req.accessActor = actor;
    return true;
  }
}
const AccessActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => ctx.switchToHttp().getRequest().accessActor);

/** what the signed-in person may open (every user): drives the app switcher and Home */
@Controller('access')
export class MyAccessController {
  constructor(private readonly products: ProductAccessService, private readonly access: AccessService) {}

  @Get('me')
  async me(@CurrentUser() u: SessionUser) {
    const [off, manage] = await Promise.all([this.products.off(u.id), this.access.me(u.id)]);
    return { off: [...off], ...manage };
  }
}

/** Access Center */
@Controller('access/admin')
@UseGuards(AccessCenterGuard)
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Get('users')
  users(@AccessActor() a: Actor, @Query() q: Record<string, string>) {
    return this.access.users(a, { q: q.q, product: q.product, role: q.role, status: q.status, page: int(q.page), pageSize: int(q.pageSize) });
  }

  @Get('users/:id')
  user(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number) {
    return this.access.user(a, id);
  }

  @Get('companies')
  companies(@AccessActor() a: Actor) {
    return this.access.companies(a);
  }

  @Get('history')
  history(@AccessActor() a: Actor, @Query() q: Record<string, string>) {
    return this.access.history(a, { user: int(q.user), product: q.product || undefined, action: q.action || undefined, page: int(q.page), pageSize: int(q.pageSize) });
  }

  /** one place to invite people into several products */
  @Post('invite')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  invite(@AccessActor() a: Actor, @Body() b: InviteBody) {
    return this.access.invite(a, b);
  }

  @Post('products/:product')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  setProduct(@AccessActor() a: Actor, @Param('product') p: string, @Body() b: { userIds?: number[]; enabled?: boolean }) {
    return this.access.setProduct(a, (b.userIds ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0), product(p), b.enabled === true);
  }

  @Post('users/:id/accounts')
  async addAccounts(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Body() b: { workspaceId: number; role: string; boardIds?: number[] }) {
    await this.access.addAccounts(a, id, { workspaceId: Number(b.workspaceId), role: String(b.role ?? ''), boardIds: (b.boardIds ?? []).map(Number).filter((n) => n > 0) });
    return this.access.user(a, id);
  }

  @Patch('users/:id/accounts/:ws')
  roleAccounts(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Param('ws', ParseIntPipe) ws: number, @Body() b: { role: string }) {
    return this.access.roleAccounts(a, id, ws, String(b.role ?? ''));
  }

  @Delete('users/:id/accounts/:ws')
  removeAccounts(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Param('ws', ParseIntPipe) ws: number) {
    return this.access.removeAccounts(a, id, ws);
  }

  @Post('users/:id/work')
  async addWork(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Body() b: { workspaceId: number; role: string }) {
    await this.access.addWork(a, id, { workspaceId: Number(b.workspaceId), role: String(b.role ?? '') });
    return this.access.user(a, id);
  }

  @Patch('users/:id/work/:ws')
  roleWork(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Param('ws', ParseIntPipe) ws: number, @Body() b: { role: string }) {
    return this.access.roleWork(a, id, ws, String(b.role ?? ''));
  }

  @Delete('users/:id/work/:ws')
  removeWork(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Param('ws', ParseIntPipe) ws: number) {
    return this.access.removeWork(a, id, ws);
  }

  @Post('users/:id/tracker')
  async addTracker(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Body() b: { source: 'boards' | 'work'; workspaceId: number; role: 'member' | 'admin' }) {
    await this.access.addTracker(a, id, { source: b.source === 'boards' ? 'boards' : 'work', workspaceId: Number(b.workspaceId), role: b.role === 'admin' ? 'admin' : 'member' });
    return this.access.user(a, id);
  }

  @Post('users/:id/crm')
  async addCrm(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Body() b: { workspaceId: number; role: string }) {
    await this.access.addCrm(a, id, { workspaceId: Number(b.workspaceId), role: String(b.role ?? '') });
    return this.access.user(a, id);
  }

  @Patch('users/:id/crm/:ws')
  roleCrm(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Param('ws', ParseIntPipe) ws: number, @Body() b: { role: string }) {
    return this.access.roleCrm(a, id, ws, String(b.role ?? ''));
  }

  @Delete('users/:id/crm/:ws')
  removeCrm(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Param('ws', ParseIntPipe) ws: number) {
    return this.access.removeCrm(a, id, ws);
  }

  @Post('users/:id/system-role')
  systemRole(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Body() b: { role: 'SUPER_ADMIN' | 'USER' }) {
    return this.access.setSystemRole(a, id, b.role);
  }

  @Post('users/:id/product-admin')
  productAdmin(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Body() b: { product: string; on: boolean }) {
    return this.access.setProductAdmin(a, id, String(b.product ?? ''), b.on === true);
  }

  @Post('users/:id/manager-scopes')
  scopes(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number, @Body() b: { scopes: { product: string; workspaceId: number; source?: string | null; mayGrantAdmin?: boolean }[] }) {
    return this.access.setScopes(a, id, Array.isArray(b.scopes) ? b.scopes.slice(0, 200) : []);
  }

  @Post('users/:id/disable')
  disable(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number) {
    return this.access.disable(a, id);
  }

  @Post('users/:id/enable')
  enable(@AccessActor() a: Actor, @Param('id', ParseIntPipe) id: number) {
    return this.access.enable(a, id);
  }
}
