import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { CeoTowerService, type Source } from './ceo-tower.service';

/** CEO Tower: read-only, for workspace owners (checked in the service on every call) */
@Controller('ceo-tower')
export class CeoTowerController {
  constructor(private readonly tower: CeoTowerService) {}

  @Get('access')
  access(@CurrentUser() u: SessionUser) {
    return this.tower.access(u.id);
  }

  @Get('tasks')
  tasks(@Query() q: Record<string, string>, @CurrentUser() u: SessionUser) {
    return this.tower.tasks(u.id, {
      source: (['boards', 'work'].includes(q.source) ? q.source : 'all') as Source,
      company: /^(boards|work):\d+$/.test(q.company ?? '') ? q.company : undefined,
      person: /^\d+$/.test(q.person ?? '') ? Number(q.person) : undefined,
      state: ['open', 'in_progress', 'overdue', 'due_week', 'done_week', 'unassigned', 'all'].includes(q.state) ? q.state : 'open',
      q: (q.q ?? '').slice(0, 100),
      limit: /^\d+$/.test(q.limit ?? '') ? Number(q.limit) : undefined,
    });
  }

  @Get('overview')
  overview(@Query('source') source: string, @Query('company') company: string, @CurrentUser() u: SessionUser) {
    return this.tower.overview(u.id, (['boards', 'work'].includes(source) ? source : 'all') as Source, /^(boards|work):\d+$/.test(company ?? '') ? company : undefined);
  }
}
