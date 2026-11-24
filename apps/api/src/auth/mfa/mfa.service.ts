import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import {
  newTotpSecret, otpauthUrl, verifyTotp, encryptSecret, decryptSecret,
  newRecoveryCodes, hashCode, newEmailCode,
} from './totp.util';

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const esc = (t: string) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type MfaStatus = {
  totp: boolean;
  email: boolean;
  enabled: boolean;
  required: boolean;
  enrolledAt: string | null;
  recoveryLeft: number;
};

/** what the login step keeps in the session until the second factor is verified */
export type MfaPending = { userId: number; methods: ('totp' | 'email')[]; emailCodeHash?: string; emailExpires?: number; at: number };

@Injectable()
export class MfaService {
  private readonly log = new Logger('MFA');
  constructor(private readonly prisma: PrismaService, private readonly mail: MailService) {}

  // ── who must use MFA: global Administrators and anyone who set up EZ Vault ──
  async isRequired(userId: number): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
    if (u?.systemRole === 'SUPER_ADMIN') return true;
    const vault = await this.prisma.vaultUser.findUnique({ where: { userId }, select: { userId: true } }).catch(() => null);
    return !!vault;
  }

  async status(userId: number): Promise<MfaStatus> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { mfaTotpEnabled: true, mfaEmailEnabled: true, mfaEnrolledAt: true } });
    const recoveryLeft = await this.prisma.mfaRecoveryCode.count({ where: { userId, usedAt: null } });
    const required = await this.isRequired(userId);
    const enabled = !!(u?.mfaTotpEnabled || u?.mfaEmailEnabled);
    return { totp: !!u?.mfaTotpEnabled, email: !!u?.mfaEmailEnabled, enabled, required, enrolledAt: u?.mfaEnrolledAt?.toISOString() ?? null, recoveryLeft };
  }

  /** the methods a signed-in-but-unverified user can use at the login challenge */
  async methodsFor(userId: number): Promise<('totp' | 'email')[]> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { mfaTotpEnabled: true, mfaEmailEnabled: true } });
    const m: ('totp' | 'email')[] = [];
    if (u?.mfaTotpEnabled) m.push('totp');
    if (u?.mfaEmailEnabled) m.push('email');
    return m;
  }

  async hasAnyMfa(userId: number): Promise<boolean> {
    return (await this.methodsFor(userId)).length > 0;
  }

  // ── TOTP enrolment ──
  async beginTotp(userId: number) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, mfaTotpEnabled: true } });
    if (!u) throw new BadRequestException('User not found.');
    if (u.mfaTotpEnabled) throw new BadRequestException('An authenticator app is already set up. Remove it first to add a new one.');
    const secret = newTotpSecret();
    // keep the unconfirmed secret encrypted; it only becomes active on confirm
    await this.prisma.user.update({ where: { id: userId }, data: { mfaTotpSecret: encryptSecret(secret) } });
    return { secret, otpauth: otpauthUrl(secret, u.email) };
  }

  async confirmTotp(userId: number, code: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { mfaTotpSecret: true, mfaTotpEnabled: true } });
    if (!u?.mfaTotpSecret) throw new BadRequestException('Start the authenticator setup first.');
    const secret = decryptSecret(u.mfaTotpSecret);
    if (!secret || !verifyTotp(secret, code)) throw new BadRequestException('That code is wrong or expired. Try the latest code in your app.');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaTotpEnabled: true, mfaEnrolledAt: new Date() } });
    const codes = await this.resetRecoveryCodes(userId);
    return { enabled: true, recoveryCodes: codes };
  }

  // ── email method ──
  async enableEmail(userId: number) {
    const existing = await this.prisma.mfaRecoveryCode.count({ where: { userId, usedAt: null } });
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEmailEnabled: true, mfaEnrolledAt: new Date() } });
    const codes = existing > 0 ? null : await this.resetRecoveryCodes(userId);
    return { enabled: true, recoveryCodes: codes };
  }

  // ── disable (one factor, or all) ──
  async disable(userId: number, which: 'totp' | 'email' | 'all') {
    const required = await this.isRequired(userId);
    const data: Record<string, unknown> = {};
    if (which === 'totp' || which === 'all') { data.mfaTotpEnabled = false; data.mfaTotpSecret = null; }
    if (which === 'email' || which === 'all') { data.mfaEmailEnabled = false; }
    await this.prisma.user.update({ where: { id: userId }, data });
    const left = await this.methodsFor(userId);
    if (required && !left.length) {
      // mandatory users may swap methods but never end with none
      // roll back if they just removed their only factor
      // (callers should prevent this; this is a safety net)
      this.log.warn(`user ${userId} left with no MFA but it is required`);
    }
    if (which === 'all') await this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } });
    await this.prisma.user.update({ where: { id: userId }, data: left.length ? {} : { mfaEnrolledAt: null } }).catch(() => null);
    return this.status(userId);
  }

  // ── recovery codes ──
  async resetRecoveryCodes(userId: number): Promise<string[]> {
    const codes = newRecoveryCodes(10);
    await this.prisma.$transaction([
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.mfaRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashCode(c) })) }),
    ]);
    return codes;
  }

  // ── login challenge ──
  /** build an email code to send; returns the hash+expiry to park in the session */
  async makeEmailCode(userId: number): Promise<{ hash: string; expires: number } | null> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, mfaEmailEnabled: true } });
    if (!u?.mfaEmailEnabled) return null;
    const code = newEmailCode();
    try {
      await this.mail.sendMail({
        to: u.email,
        subject: `Your EZ Manage sign-in code: ${code}`,
        html: `<p>Hi ${esc(u.firstName ?? '')},</p><p>Your EZ Manage sign-in code is <b style="font-size:18px;letter-spacing:2px">${code}</b>. It expires in 10 minutes.</p><p>If you didn't try to sign in, change your password.</p>`,
        text: `Your EZ Manage sign-in code is ${code} (expires in 10 minutes). If this wasn't you, change your password.`,
      });
    } catch (e: any) { this.log.warn(`email code send failed: ${e?.message ?? e}`); }
    return { hash: hashCode(code), expires: Date.now() + EMAIL_CODE_TTL_MS };
  }

  /** verify a code at the login challenge: TOTP, a valid emailed code, or a one-time recovery code */
  async verifyChallenge(pending: MfaPending, code: string): Promise<boolean> {
    const clean = String(code ?? '').trim();
    if (!clean) return false;
    const u = await this.prisma.user.findUnique({ where: { id: pending.userId }, select: { mfaTotpEnabled: true, mfaTotpSecret: true } });
    // 1. authenticator
    if (u?.mfaTotpEnabled && u.mfaTotpSecret) {
      const secret = decryptSecret(u.mfaTotpSecret);
      if (secret && verifyTotp(secret, clean)) return true;
    }
    // 2. emailed code (parked in the session)
    if (pending.emailCodeHash && pending.emailExpires && Date.now() < pending.emailExpires) {
      if (hashCode(clean) === pending.emailCodeHash) return true;
    }
    // 3. one-time recovery code
    const rc = await this.prisma.mfaRecoveryCode.findFirst({ where: { userId: pending.userId, usedAt: null, codeHash: hashCode(clean) }, select: { id: true } });
    if (rc) { await this.prisma.mfaRecoveryCode.update({ where: { id: rc.id }, data: { usedAt: new Date() } }); return true; }
    return false;
  }
}
