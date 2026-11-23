import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ProductAccessService, type Product } from './product-access.service';

/**
 * Global guard (runs after the session guard): a product the Administrator switched off for
 * this person answers 403 on every one of its routes. Routes are matched by their prefix
 * (after /api). Bearer-token routes (Vault extension, Tracker desktop) check in their own guards.
 * EZ Tracker: wired in its own guard (ProductAccessService.assert(userId, 'tracker')).
 */
const ROUTES: [RegExp, Product][] = [
  [/^\/work(\/|$)/, 'work'],
  [/^\/vault(\/|$)/, 'vault'],
  // Accounts & Invoices (Boards)
  [/^\/(workspaces|boards|columns|tasks|files|board-templates|imports|invitation|chat|time-entries|search|expenses)(\/|$)/, 'accounts'],
];

@Injectable()
export class ProductAccessGuard implements CanActivate {
  constructor(private readonly access: ProductAccessService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const userId: number | undefined = req.session?.user?.id;
    if (!userId) return true;
    const path = String(req.originalUrl ?? req.url ?? '').split('?')[0]!.replace(/^\/api/, '');
    const hit = ROUTES.find(([re]) => re.test(path));
    if (hit) await this.access.assert(userId, hit[1]);
    return true;
  }
}
