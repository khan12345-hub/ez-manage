import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { CrmRecordsService } from './crm-records.service';
import { CrmSetupService } from './crm-setup.service';
import {
  ActivityDto, AddCrmMemberDto, BulkDto, CompanyDto, ContactDto, CreateCrmWorkspaceDto, DealDto, MoveDealDto, PipelineDto, PropertyDto,
  UpdateActivityDto, UpdateCrmMemberDto, UpdateCrmWorkspaceDto, UpdatePropertyDto, UpdateViewDto, ViewDto,
} from './dto/crm.dto';

type Q = Record<string, string | undefined>;
const W = { default: { limit: 120, ttl: 60_000 } };

/** EZ Sales — the 5th product. Everything is scoped to a CRM workspace (by uid) the person is a member of. */
@Controller('crm')
export class CrmController {
  constructor(private readonly setup: CrmSetupService, private readonly rec: CrmRecordsService) {}

  // workspaces
  @Get('workspaces') mine(@CurrentUser() u: SessionUser) { return this.setup.myWorkspaces(u.id); }
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('workspaces') create(@Body() dto: CreateCrmWorkspaceDto, @CurrentUser() u: SessionUser) { return this.setup.createWorkspace(u.id, dto); }
  @Get('workspaces/:ws') workspace(@Param('ws') ws: string, @CurrentUser() u: SessionUser) { return this.setup.workspace(ws, u.id); }
  @Patch('workspaces/:ws') updateWs(@Param('ws') ws: string, @Body() dto: UpdateCrmWorkspaceDto, @CurrentUser() u: SessionUser) { return this.setup.updateWorkspace(ws, u.id, dto); }
  @Delete('workspaces/:ws') deleteWs(@Param('ws') ws: string, @CurrentUser() u: SessionUser) { return this.setup.deleteWorkspace(ws, u.id); }

  // members
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('workspaces/:ws/members') addMember(@Param('ws') ws: string, @Body() dto: AddCrmMemberDto, @CurrentUser() u: SessionUser) { return this.setup.addMember(ws, u.id, dto); }
  @Patch('workspaces/:ws/members/:userId') updateMember(@Param('ws') ws: string, @Param('userId', ParseIntPipe) id: number, @Body() dto: UpdateCrmMemberDto, @CurrentUser() u: SessionUser) { return this.setup.updateMember(ws, u.id, id, dto); }
  @Delete('workspaces/:ws/members/:userId') removeMember(@Param('ws') ws: string, @Param('userId', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.setup.removeMember(ws, u.id, id); }
  @Delete('workspaces/:ws/invites/:id') cancelInvite(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.setup.cancelInvite(ws, u.id, id); }

  // pipelines
  @Post('workspaces/:ws/pipelines') createPipeline(@Param('ws') ws: string, @Body() dto: PipelineDto, @CurrentUser() u: SessionUser) { return this.setup.createPipeline(ws, u.id, dto); }
  @Put('workspaces/:ws/pipelines/:id') updatePipeline(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @Body() dto: PipelineDto, @CurrentUser() u: SessionUser) { return this.setup.updatePipeline(ws, u.id, id, dto); }
  @Delete('workspaces/:ws/pipelines/:id') deletePipeline(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.setup.deletePipeline(ws, u.id, id); }

  // custom properties
  @Post('workspaces/:ws/properties') createProperty(@Param('ws') ws: string, @Body() dto: PropertyDto, @CurrentUser() u: SessionUser) { return this.setup.createProperty(ws, u.id, dto); }
  @Patch('workspaces/:ws/properties/:id') updateProperty(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePropertyDto, @CurrentUser() u: SessionUser) { return this.setup.updateProperty(ws, u.id, id, dto); }
  @Delete('workspaces/:ws/properties/:id') deleteProperty(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.setup.deleteProperty(ws, u.id, id); }

  // saved views
  @Get('workspaces/:ws/views') views(@Param('ws') ws: string, @Query('object') object: string, @CurrentUser() u: SessionUser) { return this.setup.views(ws, u.id, String(object ?? 'contact')); }
  @Post('workspaces/:ws/views') createView(@Param('ws') ws: string, @Body() dto: ViewDto, @CurrentUser() u: SessionUser) { return this.setup.createView(ws, u.id, dto); }
  @Patch('workspaces/:ws/views/:id') updateView(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateViewDto, @CurrentUser() u: SessionUser) { return this.setup.updateView(ws, u.id, id, dto); }
  @Delete('workspaces/:ws/views/:id') deleteView(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.setup.deleteView(ws, u.id, id); }

  // home, search, tasks
  @Get('workspaces/:ws/home') home(@Param('ws') ws: string, @Query() q: Q, @CurrentUser() u: SessionUser) { return this.rec.home(ws, u.id, q); }
  @Get('workspaces/:ws/search') search(@Param('ws') ws: string, @Query('q') q: string, @CurrentUser() u: SessionUser) { return this.rec.search(ws, u.id, String(q ?? '')); }
  @Get('workspaces/:ws/tasks') tasks(@Param('ws') ws: string, @Query() q: Q, @CurrentUser() u: SessionUser) { return this.rec.tasks(ws, u.id, q); }

  // companies
  @Get('workspaces/:ws/companies') companies(@Param('ws') ws: string, @Query() q: Q, @CurrentUser() u: SessionUser) { return this.rec.listCompanies(ws, u.id, q); }
  @Throttle(W) @Post('workspaces/:ws/companies') createCompany(@Param('ws') ws: string, @Body() dto: CompanyDto, @CurrentUser() u: SessionUser) { return this.rec.createCompany(ws, u.id, dto); }
  @Get('workspaces/:ws/companies/:id') company(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.rec.company(ws, u.id, id); }
  @Patch('workspaces/:ws/companies/:id') updateCompany(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @Body() dto: CompanyDto, @CurrentUser() u: SessionUser) { return this.rec.updateCompany(ws, u.id, id, dto); }
  @Delete('workspaces/:ws/companies/:id') deleteCompany(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.rec.deleteRecord(ws, u.id, 'company', id); }

  // contacts
  @Get('workspaces/:ws/contacts') contacts(@Param('ws') ws: string, @Query() q: Q, @CurrentUser() u: SessionUser) { return this.rec.listContacts(ws, u.id, q); }
  @Throttle(W) @Post('workspaces/:ws/contacts') createContact(@Param('ws') ws: string, @Body() dto: ContactDto, @CurrentUser() u: SessionUser) { return this.rec.createContact(ws, u.id, dto); }
  @Get('workspaces/:ws/contacts/:id') contact(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.rec.contact(ws, u.id, id); }
  @Patch('workspaces/:ws/contacts/:id') updateContact(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @Body() dto: ContactDto, @CurrentUser() u: SessionUser) { return this.rec.updateContact(ws, u.id, id, dto); }
  @Delete('workspaces/:ws/contacts/:id') deleteContact(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.rec.deleteRecord(ws, u.id, 'contact', id); }

  // deals
  @Get('workspaces/:ws/deals') deals(@Param('ws') ws: string, @Query() q: Q, @CurrentUser() u: SessionUser) { return this.rec.listDeals(ws, u.id, q); }
  @Throttle(W) @Post('workspaces/:ws/deals') createDeal(@Param('ws') ws: string, @Body() dto: DealDto, @CurrentUser() u: SessionUser) { return this.rec.createDeal(ws, u.id, dto); }
  @Get('workspaces/:ws/deals/:id') deal(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.rec.deal(ws, u.id, id); }
  @Patch('workspaces/:ws/deals/:id') updateDeal(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @Body() dto: DealDto, @CurrentUser() u: SessionUser) { return this.rec.updateDeal(ws, u.id, id, dto); }
  @Post('workspaces/:ws/deals/:id/move') moveDeal(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @Body() dto: MoveDealDto, @CurrentUser() u: SessionUser) { return this.rec.moveDeal(ws, u.id, id, dto); }
  @Delete('workspaces/:ws/deals/:id') deleteDeal(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.rec.deleteRecord(ws, u.id, 'deal', id); }
  @Put('workspaces/:ws/deals/:id/contacts/:contactId') linkContact(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @Param('contactId', ParseIntPipe) c: number, @CurrentUser() u: SessionUser) { return this.rec.linkDealContact(ws, u.id, id, c, true); }
  @Delete('workspaces/:ws/deals/:id/contacts/:contactId') unlinkContact(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @Param('contactId', ParseIntPipe) c: number, @CurrentUser() u: SessionUser) { return this.rec.linkDealContact(ws, u.id, id, c, false); }

  // bulk
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('workspaces/:ws/bulk') bulk(@Param('ws') ws: string, @Body() dto: BulkDto, @CurrentUser() u: SessionUser) { return this.rec.bulk(ws, u.id, dto); }

  // activities & timeline
  @Get('workspaces/:ws/:object/:id/timeline')
  timeline(@Param('ws') ws: string, @Param('object') object: string, @Param('id', ParseIntPipe) id: number, @Query() q: Q, @CurrentUser() u: SessionUser) {
    const obj = object === 'contacts' ? 'contact' : object === 'companies' ? 'company' : object === 'deals' ? 'deal' : null;
    if (!obj) return [];
    return this.rec.timeline(ws, u.id, obj, id, q);
  }
  @Throttle(W) @Post('workspaces/:ws/activities') createActivity(@Param('ws') ws: string, @Body() dto: ActivityDto, @CurrentUser() u: SessionUser) { return this.rec.createActivity(ws, u.id, dto); }
  @Patch('workspaces/:ws/activities/:id') updateActivity(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActivityDto, @CurrentUser() u: SessionUser) { return this.rec.updateActivity(ws, u.id, id, dto); }
  @Delete('workspaces/:ws/activities/:id') deleteActivity(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.rec.deleteActivity(ws, u.id, id); }

  // CRM's own notifications
  @Get('notifications') notifications(@CurrentUser() u: SessionUser) { return this.setup.notifications(u.id); }
  @Post('notifications/read') readAll(@CurrentUser() u: SessionUser) { return this.setup.readNotifications(u.id); }
}
