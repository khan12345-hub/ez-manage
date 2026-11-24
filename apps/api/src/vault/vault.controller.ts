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
  @Post('password-updated') passwordUpdated(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.passwordUpdated(c, b?.vaultUids); }

  @Get('people') people(@Caller() c: VaultCaller, @Query('q') q: string, @Query('vault') vault: string) { return this.vault.people(c, q, vault || undefined); }
  @Get('vaults/:uid/members') members(@Caller() c: VaultCaller, @Param('uid') uid: string) { return this.vault.members(c, uid); }
  @Post('vaults/:uid/members') addMember(@Caller() c: VaultCaller, @Param('uid') uid: string, @Body() b: any) { return this.vault.addMember(c, uid, b); }
  @Patch('vaults/:uid/members/:userId') setRole(@Caller() c: VaultCaller, @Param('uid') uid: string, @Param('userId', ParseIntPipe) userId: number, @Body() b: any) { return this.vault.setRole(c, uid, userId, String(b?.role ?? '')); }
  @Post('vaults/:uid/members/:userId/remove') removeMember(@Caller() c: VaultCaller, @Param('uid') uid: string, @Param('userId', ParseIntPipe) userId: number, @Body() b: any) { return this.vault.removeMember(c, uid, userId, b); }
  @Post('vaults/:uid/rekey') rekey(@Caller() c: VaultCaller, @Param('uid') uid: string, @Body() b: any) { return this.vault.rekey(c, uid, b); }
  @Get('vaults/:uid/rotations') rotations(@Caller() c: VaultCaller, @Param('uid') uid: string) { return this.vault.rotations(c, uid); }
  @Patch('rotations/:id') resolveRotation(@Caller() c: VaultCaller, @Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.vault.resolveRotation(c, id, b); }

  // admin recovery (option B)
  @Post('recovery/wrap') saveRecoveryWrap(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.saveRecoveryWrap(c, b); }
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('recovery/request') requestRecovery(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.requestRecovery(c, b); }
  @Get('recovery/request') myRecovery(@Caller() c: VaultCaller) { return this.vault.myRecovery(c); }
  @Post('recovery/request/cancel') cancelRecovery(@Caller() c: VaultCaller) { return this.vault.cancelRecovery(c); }
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('recovery/complete') completeRecovery(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.completeRecovery(c, b); }

  // Vault admin
  @Get('admin/recovery-key') getRecoveryKey(@Caller() c: VaultCaller) { return this.vault.getRecoveryKey(c); }
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('admin/recovery-key') createRecoveryKey(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.createRecoveryKey(c, b); }
  @Get('admin/recovery-requests') recoveryRequests(@Caller() c: VaultCaller) { return this.vault.recoveryRequests(c); }
  @Post('admin/recovery-requests/:id/approve') approveRecovery(@Caller() c: VaultCaller, @Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.vault.decideRecovery(c, id, true, b); }
  @Post('admin/recovery-requests/:id/decline') declineRecovery(@Caller() c: VaultCaller, @Param('id', ParseIntPipe) id: number) { return this.vault.decideRecovery(c, id, false, {}); }
  @Get('admin/companies') adminCompanies(@Caller() c: VaultCaller) { return this.vault.adminCompanies(c); }
  @Patch('admin/companies') companySettings(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.companySettings(c, b); }
  @Get('admin/companies/people') companyPeople(@Caller() c: VaultCaller, @Query() q: any) { return this.vault.companyPeople(c, q); }
  @Post('admin/companies/admins') addVaultAdmin(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.setVaultAdmin(c, b, true); }
  @Post('admin/companies/admins/remove') removeVaultAdmin(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.setVaultAdmin(c, b, false); }
  @Post('admin/users/:id/remove-everywhere') removeEverywhere(@Caller() c: VaultCaller, @Param('id', ParseIntPipe) id: number) { return this.vault.adminRemoveEverywhere(c, id); }

  @Post('events') clientEvent(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.clientEvent(c, b); }
  @Get('events') events(@Caller() c: VaultCaller, @Query('vault') vault: string, @Query('item') item: string) { return this.vault.events(c, vault || undefined, item || undefined); }

  @Get('tokens') tokens(@Caller() c: VaultCaller) { return this.vault.tokens(c); }
  @Post('tokens') createToken(@Caller() c: VaultCaller, @Body() b: any) { return this.vault.createToken(c, b?.name); }
  @Delete('tokens/:id') revokeToken(@Caller() c: VaultCaller, @Param('id', ParseIntPipe) id: number) { return this.vault.revokeToken(c, id); }
  @Post('extension/sign-out') signOut(@Headers('authorization') a: string) { return this.vault.signOutToken(a); }
}
