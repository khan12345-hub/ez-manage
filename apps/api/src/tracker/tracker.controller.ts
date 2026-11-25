import { Body, Controller, Delete, Get, Headers, Ip, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Public } from 'src/auth/decorators/public.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { Device, TrackerDeviceGuard, type TrackerDeviceCaller } from './tracker.guard';
import { TrackerService } from './tracker.service';

const off = (v: string) => Math.max(-840, Math.min(840, Number(v) || 0));

/** EZ Tracker on the web (signed-in session). */
@Controller('tracker')
export class TrackerController {
  constructor(private readonly t: TrackerService) {}

  @Get('workspaces') workspaces(@CurrentUser() u: SessionUser) { return this.t.workspaces(u.id); }
  /** owners / admins: who is working now across every company they manage */
  @Get('all/live') liveAll(@Query('offset') o: string, @CurrentUser() u: SessionUser) { return this.t.liveAll(u.id, off(o)); }
  @Get(':ws/overview') overview(@Param('ws') ws: string, @CurrentUser() u: SessionUser) { return this.t.overview(ws, u.id); }
  @Patch(':ws/settings') settings(@Param('ws') ws: string, @Body() b: any, @CurrentUser() u: SessionUser) { return this.t.updateSettings(ws, u.id, b); }
  @Post(':ws/consent') consent(@Param('ws') ws: string, @Body() b: any, @CurrentUser() u: SessionUser, @Ip() ip: string, @Headers('user-agent') ua: string) {
    return this.t.acceptConsent(ws, u.id, String(b?.version ?? ''), ip, ua);
  }

  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  @Post(':ws/pair-codes') pairCode(@Param('ws') ws: string, @CurrentUser() u: SessionUser) { return this.t.pairCode(ws, u.id); }
  @Throttle({ auth: { ttl: 60_000, limit: 20 } })
  @Post('connect') connect(@Body() b: any, @CurrentUser() u: SessionUser) { return this.t.connectStart(u.id, String(b?.nonce ?? '')); }
  @Get(':ws/deploy-codes') deployCodes(@Param('ws') ws: string, @CurrentUser() u: SessionUser) { return this.t.deployCodes(ws, u.id); }
  @Throttle({ auth: { ttl: 60_000, limit: 20 } })
  @Post(':ws/deploy-codes') createDeployCode(@Param('ws') ws: string, @Body() b: any, @CurrentUser() u: SessionUser) { return this.t.createDeployCode(ws, u.id, b); }
  @Delete(':ws/deploy-codes/:id') revokeDeployCode(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.t.revokeDeployCode(ws, u.id, id); }
  @Get(':ws/unassigned') unassigned(@Param('ws') ws: string, @CurrentUser() u: SessionUser) { return this.t.unassignedDevices(ws, u.id); }
  @Post(':ws/devices/:id/assign') assignDevice(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @Body() b: any, @CurrentUser() u: SessionUser) { return this.t.assignDevice(ws, u.id, id, b); }
  @Get(':ws/devices') devices(@Param('ws') ws: string, @CurrentUser() u: SessionUser) { return this.t.devices(ws, u.id); }
  @Delete('devices/:id') revoke(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.t.revokeDevice(id, u.id); }

  @Get(':ws/live') live(@Param('ws') ws: string, @Query('offset') o: string, @CurrentUser() u: SessionUser) { return this.t.live(ws, u.id, off(o)); }
  @Get(':ws/timesheet') timesheet(@Param('ws') ws: string, @Query() q: any, @CurrentUser() u: SessionUser) { return this.t.timesheet(ws, u.id, q); }
  @Get(':ws/day') day(@Param('ws') ws: string, @Query() q: any, @CurrentUser() u: SessionUser) { return this.t.day(ws, u.id, q); }
  @Get(':ws/apps') apps(@Param('ws') ws: string, @Query() q: any, @CurrentUser() u: SessionUser) { return this.t.apps(ws, u.id, q); }
  @Get(':ws/attendance') attendance(@Param('ws') ws: string, @Query() q: any, @CurrentUser() u: SessionUser) { return this.t.attendance(ws, u.id, q); }

  // managers only (system Administrator or a Tracker admin of the company); all/… = Administrator only
  @Get('all/people') peopleAll(@Query('offset') o: string, @CurrentUser() u: SessionUser) { return this.t.peopleAll(u.id, off(o)); }
  @Get(':ws/people') people(@Param('ws') ws: string, @Query('offset') o: string, @CurrentUser() u: SessionUser) { return this.t.peopleList(ws, u.id, off(o)); }
  @Get(':ws/people/:userId') person(@Param('ws') ws: string, @Param('userId', ParseIntPipe) target: number, @Query('offset') o: string, @CurrentUser() u: SessionUser) { return this.t.person(ws, u.id, target, off(o)); }
  @Patch(':ws/people/:userId/tracking') tracking(@Param('ws') ws: string, @Param('userId', ParseIntPipe) target: number, @Body() b: any, @CurrentUser() u: SessionUser) { return this.t.setTracking(ws, u.id, target, b?.on !== false); }
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post(':ws/people/:userId/remind') remind(@Param('ws') ws: string, @Param('userId', ParseIntPipe) target: number, @CurrentUser() u: SessionUser) { return this.t.remind(ws, u.id, target); }
  @Get(':ws/candidates') candidates(@Param('ws') ws: string, @CurrentUser() u: SessionUser) { return this.t.candidates(ws, u.id); }
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post(':ws/people') addPeople(@Param('ws') ws: string, @Body() b: any, @CurrentUser() u: SessionUser) { return this.t.addMembers(ws, u.id, b); }
  @Delete(':ws/people/:userId') removePerson(@Param('ws') ws: string, @Param('userId', ParseIntPipe) target: number, @CurrentUser() u: SessionUser) { return this.t.removeMember(ws, u.id, target); }
  @Patch(':ws/people/:userId/role') role(@Param('ws') ws: string, @Param('userId', ParseIntPipe) target: number, @Body() b: any, @CurrentUser() u: SessionUser) { return this.t.setRole(ws, u.id, target, String(b?.role ?? '')); }
  @Get(':ws/teams') teams(@Param('ws') ws: string, @CurrentUser() u: SessionUser) { return this.t.teams(ws, u.id); }
  @Get(':ws/people/:userId/team') teamOf(@Param('ws') ws: string, @Param('userId', ParseIntPipe) target: number, @CurrentUser() u: SessionUser) { return this.t.teamOf(ws, u.id, target); }
  @Put(':ws/people/:userId/team') setTeam(@Param('ws') ws: string, @Param('userId', ParseIntPipe) target: number, @Body() b: any, @CurrentUser() u: SessionUser) { return this.t.setTeam(ws, u.id, target, b); }
  @Delete(':ws/devices/:id') revokeAs(@Param('ws') ws: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.t.revokeDeviceAs(ws, u.id, id); }

  @Delete('shots/:id') deleteShot(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.t.deleteShot(id, u.id); }
  @Post('shots/:id/hide') hideShot(@Param('id', ParseIntPipe) id: number, @Body() b: any, @CurrentUser() u: SessionUser) { return this.t.hideShot(id, u.id, b?.hidden !== false); }
}

/** EZ Tracker desktop app ("Authorization: Bearer ezt_…"); pairing itself is public + throttled. */
@Public()
@Controller('tracker/desktop')
export class TrackerDesktopController {
  constructor(private readonly t: TrackerService) {}

  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  @Post('pair') pair(@Body() b: any) { return this.t.pair(b); }

  @Get('config') config() { return this.t.publicConfig(); }

  /** Public download of the Windows installer. Drop the .exe at TRACKER_INSTALLER_PATH on the server. */
  @Get('download') download(): StreamableFile {
    const p = process.env.TRACKER_INSTALLER_PATH;
    if (!p || !existsSync(p)) throw new NotFoundException('The installer is not available yet. Ask your Tracker admin.');
    return new StreamableFile(createReadStream(p), { type: 'application/octet-stream', disposition: `attachment; filename="${basename(p)}"`, length: statSync(p).size });
  }

  /** Auto-connect: the desktop polls with its secret nonce until the signed-in web user confirms. */
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post('connect/exchange') connectExchange(@Body() b: any) { return this.t.connectExchange(b); }

  /** Zero-touch: a silent-deployed desktop exchanges its baked deploy code for the person's token. */
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('deploy') deploy(@Body() b: any) { return this.t.deployExchange(b); }

  @UseGuards(TrackerDeviceGuard) @Get('me') me(@Device() d: TrackerDeviceCaller) { return this.t.desktopMe(d); }
  @UseGuards(TrackerDeviceGuard) @Post('consent') consent(@Device() d: TrackerDeviceCaller, @Body() b: any, @Ip() ip: string, @Headers('user-agent') ua: string) {
    return this.t.desktopConsent(d, String(b?.version ?? ''), ip, ua);
  }
  @UseGuards(TrackerDeviceGuard) @Get('tasks') tasks(@Device() d: TrackerDeviceCaller, @Query('q') q: string) { return this.t.desktopTasks(d, q); }
  @UseGuards(TrackerDeviceGuard) @Post('sessions') start(@Device() d: TrackerDeviceCaller, @Body() b: any) { return this.t.start(d, b); }
  @UseGuards(TrackerDeviceGuard) @Post('sessions/:id/stop') stop(@Device() d: TrackerDeviceCaller, @Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.t.stop(d, id, b); }
  @UseGuards(TrackerDeviceGuard) @Post('sessions/:id/heartbeat') beat(@Device() d: TrackerDeviceCaller, @Param('id', ParseIntPipe) id: number) { return this.t.heartbeat(d, id); }
  @UseGuards(TrackerDeviceGuard) @Post('slots') slots(@Device() d: TrackerDeviceCaller, @Body() b: any) { return this.t.slots(d, b); }

  @UseGuards(TrackerDeviceGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 + 1024 } }))
  @Post('shots') shot(@Device() d: TrackerDeviceCaller, @UploadedFile() file: Express.Multer.File, @Body() b: any) { return this.t.shot(d, file, b); }
}
