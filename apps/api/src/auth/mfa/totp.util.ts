import { createHmac, randomBytes, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'crypto';

// ───────────────────────── Base32 (RFC 4648, no padding) ─────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/** a fresh TOTP secret (20 random bytes → base32), the standard for authenticator apps */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** RFC 6238 TOTP code for a given secret and time step (SHA-1, 6 digits, 30s) */
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // write the counter as a big-endian 64-bit integer
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

/** verify a 6-digit TOTP, allowing ±1 step (clock drift) */
export function verifyTotp(secretBase32: string, token: string, window = 1): boolean {
  const code = String(token ?? '').replace(/\D/g, '');
  if (code.length !== 6) return false;
  const secret = base32Decode(secretBase32);
  if (!secret.length) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    const expected = hotp(secret, step + w);
    if (expected.length === code.length && timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
  }
  return false;
}

/** the otpauth:// URI an authenticator app scans */
export function otpauthUrl(secretBase32: string, account: string, issuer = 'EZ Manage'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ───────────────────────── secret encryption at rest (AES-256-GCM) ─────────────────────────
function encKey(): Buffer {
  const raw = process.env.MFA_ENC_KEY || process.env.SESSION_SECRET || 'ez-manage-mfa-dev-key';
  return createHash('sha256').update(raw).digest();
}

/** encrypt the TOTP secret before storing it (iv.ct.tag, base64) */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${ct.toString('base64')}.${tag.toString('base64')}`;
}

export function decryptSecret(stored: string): string | null {
  try {
    const [ivB, ctB, tagB] = stored.split('.');
    if (!ivB || !ctB || !tagB) return null;
    const decipher = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ───────────────────────── recovery codes & numeric codes ─────────────────────────
/** 10 one-time recovery codes like "a1b2c-d3e4f" */
export function newRecoveryCodes(n = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const raw = randomBytes(8).toString('hex').slice(0, 10);
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export const hashCode = (code: string) => createHash('sha256').update(code.trim().toLowerCase()).digest('hex');

/** a 6-digit numeric code for email-based MFA */
export function newEmailCode(): string {
  return String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
}
