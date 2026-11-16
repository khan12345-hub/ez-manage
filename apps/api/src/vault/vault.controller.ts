import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/auth/decorators/public.decorator';
import { Caller, VaultAuthGuard, type VaultCaller } from './vault.guard';
import { VaultService } from './vault.service';

/** EZ Vault (password manager). Signed in by the web session or a browser-extension token. */
@Public()
@UseGuards(VaultAuthGuard)
@Controller('vault')
export class VaultController {
  constructor(private readonly vault: VaultService) {}

  @Get('me') me(@Caller() c: VaultCaller) { return this.vault.me(c); }
  @Post('setup') setup(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.setup(c, b); }
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('master-password') changeMaster(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.changeMaster(c, b); }
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('reset') reset(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.reset(c, b); }

  @Get('vaults') vaults(@Caller() c: VaultCaller) { return this.vault.vaults(c); }
  @Post('vaults') createVault(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.createVault(c, b); }
  @Patch('vaults/:uid') renameVault(@Caller() c: VaultCaller, @Param('uid') uid: string, @Body() b: any) { return this.vault.renameVault(c, uid, b); }
  @Delete('vaults/:uid') deleteVault(@Caller() c: VaultCaller, @Param('uid') uid: string) { return this.vault.deleteVault(c, uid); }

  @Get('items') items(@Caller() c: VaultCaller, @Query('trash') trash: string) { return this.vault.items(c, trash === '1'); }
  @Post('vaults/:uid/items') createItem(@Caller() c: VaultCaller, @Param('uid') uid: string, @Body() b: any) { return this.vault.createItem(c, uid, b); }
  @Patch('items/:uid') updateItem(@Caller() c: VaultCaller, @Param('uid') uid: string, @Body() b: any) { return this.vault.updateItem(c, uid, b); }
  @Delete('items/:uid') deleteItem(@Caller() c: VaultCaller, @Param('uid') uid: string, @Query('forever') forever: string) { return this.vault.deleteItem(c, uid, forever === '1'); }
  @Post('items/:uid/restore') restoreItem(@Caller() c: VaultCaller, @Param('uid') uid: string) { return this.vault.restoreItem(c, uid); }

  @Get('people') people(@Caller() c: VaultCaller, @Query('q') q: string) { return this.vault.people(c, q); }
  @Get('vaults/:uid/members') members(@Caller() c: VaultCaller, @Param('uid') uid: string) { return this.vault.members(c, uid); }
  @Post('vaults/:uid/members') addMember(@Caller() c: VaultCaller, @Param('uid') uid: string, @Body() b: any) { return this.vault.addMember(c, uid, b); }
  @Patch('vaults/:uid/members/:userId') setRole(@Caller() c: VaultCaller, @Param('uid') uid: string, @Param('userId', ParseIntPipe) userId: number, @Body() b: any) { return this.vault.setRole(c, uid, userId, String(b?.role ?? '')); }
  @Post('vaults/:uid/members/:userId/remove') removeMember(@Caller() c: VaultCaller, @Param('uid') uid: string, @Param('userId', ParseIntPipe) userId: number, @Body() b: any) { return this.vault.removeMember(c, uid, userId, b); }

  @Post('events') clientEvent(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.clientEvent(c, b); }
  @Get('events') events(@Caller() c: VaultCaller, @Query('vault') vault: string) { return this.vault.events(c, vault || undefined); }

  @Get('tokens') tokens(@Caller() c: VaultCaller) { return this.vault.tokens(c); }
  @Post('tokens') createToken(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.createToken(c, b?.name); }
  @Delete('tokens/:id') revokeToken(@Caller() c: VaultCaller, @Param('id', ParseIntPipe) id: number) { return this.vault.revokeToken(c, id); }
  @Post('extension/sign-out') signOut(@Headers('authorization') a: string) { return this.vault.signOutToken(a); }
}
