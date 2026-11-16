// EZ Vault crypto — shared by the web app and the browser extension (keep both copies identical).
// Zero-knowledge: the master password and every secret stay in the browser; the server stores ciphertext.
//   master key  = PBKDF2-SHA256(master password, salt, 600k) → AES-GCM-256 (never leaves the browser)
//   user keys   = RSA-OAEP-2048 (SHA-256); private key encrypted with the master key
//   vault key   = random AES-GCM-256, wrapped with each member's public key
//   item        = AES-GCM(vault key, JSON)
// Ciphertext format: "v1.<base64 iv>.<base64 data>"

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();
export const ITERATIONS = 600000;
const VERIFIER = "ezvault-ok-v1";

export function toB64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export async function deriveMasterKey(password, saltB64, iterations = ITERATIONS) {
  const base = await subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return `v1.${toB64(iv)}.${toB64(ct)}`;
}
export async function decryptBytes(key, text) {
  const [v, iv, ct] = String(text).split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("Unknown ciphertext");
  return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct)));
}
export const encryptJson = async (key, obj) => encryptBytes(key, enc.encode(JSON.stringify(obj)));
export const decryptJson = async (key, text) => JSON.parse(dec.decode(await decryptBytes(key, text)));
export const encryptText = async (key, s) => encryptBytes(key, enc.encode(s));
export const decryptText = async (key, text) => dec.decode(await decryptBytes(key, text));

const RSA = { name: "RSA-OAEP", hash: "SHA-256" };
export const importPublicKey = (b64) => subtle.importKey("spki", fromB64(b64), RSA, false, ["encrypt"]);
export const importPrivateKey = (bytes) => subtle.importKey("pkcs8", bytes, RSA, false, ["decrypt"]);

/** new keys for a person: what the server stores (no secret in it) + the unlocked keys */
export async function createUserKeys(masterPassword) {
  const salt = toB64(randomBytes(16));
  const mk = await deriveMasterKey(masterPassword, salt, ITERATIONS);
  const pair = await subtle.generateKey({ ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ["encrypt", "decrypt"]);
  const publicKey = toB64(await subtle.exportKey("spki", pair.publicKey));
  const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", pair.privateKey));
  return {
    stored: { salt, iterations: ITERATIONS, publicKey, encPrivateKey: await encryptBytes(mk, pkcs8), verifier: await encryptText(mk, VERIFIER) },
    privateKey: await importPrivateKey(pkcs8),
    publicKey,
  };
}

/** open the keys with the master password; throws "WRONG_PASSWORD" */
export async function unlockUserKeys(masterPassword, stored) {
  const mk = await deriveMasterKey(masterPassword, stored.salt, stored.iterations);
  try {
    if ((await decryptText(mk, stored.verifier)) !== VERIFIER) throw new Error();
  } catch {
    throw new Error("WRONG_PASSWORD");
  }
  const pkcs8 = await decryptBytes(mk, stored.encPrivateKey);
  return { privateKey: await importPrivateKey(pkcs8), pkcs8 };
}

/** new master password: same keys, re-locked */
export async function changeMasterPassword(oldPassword, newPassword, stored) {
  const { pkcs8 } = await unlockUserKeys(oldPassword, stored);
  const salt = toB64(randomBytes(16));
  const mk = await deriveMasterKey(newPassword, salt, ITERATIONS);
  return { salt, iterations: ITERATIONS, encPrivateKey: await encryptBytes(mk, pkcs8), verifier: await encryptText(mk, VERIFIER) };
}

export async function newVaultKey() {
  return subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
export const exportVaultKey = async (key) => toB64(await subtle.exportKey("raw", key));
export const importVaultKey = (b64, extractable = true) => subtle.importKey("raw", fromB64(b64), { name: "AES-GCM" }, extractable, ["encrypt", "decrypt"]);
/** wrap a vault key for a member (their public key) */
export async function wrapVaultKey(vaultKey, publicKeyB64) {
  const raw = await subtle.exportKey("raw", vaultKey);
  return toB64(await subtle.encrypt(RSA, await importPublicKey(publicKeyB64), raw));
}
export async function unwrapVaultKey(encB64, privateKey) {
  const raw = await subtle.decrypt(RSA, privateKey, fromB64(encB64));
  return subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

// ───────── passwords ─────────

const SETS = { lower: "abcdefghijkmnopqrstuvwxyz", upper: "ABCDEFGHJKLMNPQRSTUVWXYZ", digits: "23456789", symbols: "!@#$%^&*-_=+?" };
const randInt = (n) => { const max = Math.floor(0x100000000 / n) * n; let x; do { x = globalThis.crypto.getRandomValues(new Uint32Array(1))[0]; } while (x >= max); return x % n; };

/** random password; every chosen kind of character appears at least once */
export function generatePassword({ length = 20, upper = true, digits = true, symbols = true } = {}) {
  const pools = [SETS.lower, upper && SETS.upper, digits && SETS.digits, symbols && SETS.symbols].filter(Boolean);
  const all = pools.join("");
  const len = Math.max(8, Math.min(100, length));
  const chars = pools.map((p) => p[randInt(p.length)]);
  while (chars.length < len) chars.push(all[randInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

const WORDS = "acid amber anchor apple arrow atlas autumn badge bamboo banner barrel basket beacon berry bishop blanket blossom border bounce bramble breeze bridge bronze bubble bucket cabin cactus camera candle canyon carbon carpet castle cedar cement chalk charm cherry chess cider circle citrus clever cliff clock cloud clover cobalt comet copper coral cotton crane crater crystal dagger dawn delta desert dolphin dragon drift eagle echo ember engine falcon fern fiber fiesta flame flint forest fossil fountain fox galaxy garden garlic giant ginger glacier globe granite grape gravel harbor hazel helmet hollow honey horizon iceberg indigo island ivory jacket jasmine jungle kettle kiwi lagoon lantern lava lemon lily linen lotus magnet mango maple marble meadow meteor mint mirror monsoon mosaic nectar needle noble nutmeg oasis ocean olive onyx orbit orchid otter paddle panda paper pebble pepper pilot planet plume polar poppy prism pulse quartz quiver radar rain raven reef ribbon river rocket ruby saddle saffron sail salmon sapphire satin scarlet shadow silver sketch sky slate spark spice spiral spruce stone storm summit sunset tango temple thunder tiger timber topaz torch tulip tundra valley velvet violet voyage walnut willow window winter wolf zebra zenith".split(" ");
export function generatePassphrase({ words = 4, sep = "-" } = {}) {
  const w = Array.from({ length: Math.max(3, Math.min(10, words)) }, () => WORDS[randInt(WORDS.length)]);
  w[randInt(w.length)] += String(randInt(90) + 10);
  return w.join(sep);
}

/** 0 (very weak) … 4 (very strong), from length and variety, with common-pattern penalties */
export function strength(pw) {
  if (!pw) return 0;
  let kinds = 0;
  if (/[a-z]/.test(pw)) kinds++;
  if (/[A-Z]/.test(pw)) kinds++;
  if (/\d/.test(pw)) kinds++;
  if (/[^A-Za-z0-9]/.test(pw)) kinds++;
  const pool = [26, 26, 10, 33].slice(0, kinds).reduce((a, b) => a + b, 0) || 10;
  let bits = pw.length * Math.log2(pool);
  if (/^(.)\1+$/.test(pw) || /(password|qwerty|123456|abc123|letmein|admin|welcome|iloveyou)/i.test(pw)) bits = Math.min(bits, 20);
  if (/^[A-Za-z]+\d{1,4}[!@#$]?$/.test(pw)) bits -= 15;
  return bits < 35 ? 0 : bits < 50 ? 1 : bits < 65 ? 2 : bits < 85 ? 3 : 4;
}

// ───────── one-time codes (TOTP, RFC 6238) ─────────

function base32(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(s).toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, val = 0;
  const out = [];
  for (const ch of clean) {
    const i = A.indexOf(ch);
    if (i < 0) throw new Error("Bad secret");
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
/** accepts a base32 secret or an otpauth:// link */
export function parseTotp(input) {
  const s = String(input ?? "").trim();
  if (!s) return null;
  if (s.startsWith("otpauth://")) {
    const u = new URL(s);
    return { secret: u.searchParams.get("secret") ?? "", digits: Number(u.searchParams.get("digits") ?? 6), period: Number(u.searchParams.get("period") ?? 30) };
  }
  return { secret: s, digits: 6, period: 30 };
}
export async function totp(input, now = Date.now()) {
  const p = parseTotp(input);
  if (!p) return null;
  const key = await subtle.importKey("raw", base32(p.secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const counter = Math.floor(now / 1000 / p.period);
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setUint32(4, counter);
  new DataView(msg.buffer).setUint32(0, Math.floor(counter / 0x100000000));
  const h = new Uint8Array(await subtle.sign("HMAC", key, msg));
  const o = h[h.length - 1] & 15;
  const code = (((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 10 ** p.digits;
  return { code: String(code).padStart(p.digits, "0"), left: p.period - (Math.floor(now / 1000) % p.period), period: p.period };
}

/** Have I Been Pwned (k-anonymity: only the first 5 hex chars of the SHA-1 leave the browser) */
export async function breachCount(pw) {
  const hex = [...new Uint8Array(await subtle.digest("SHA-1", enc.encode(pw)))].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const r = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { "Add-Padding": "true" } });
  if (!r.ok) throw new Error("Breach check failed");
  const line = (await r.text()).split("\n").find((l) => l.startsWith(hex.slice(5)));
  return line ? Number(line.split(":")[1]) || 0 : 0;
}

/** hostnames for matching a saved login to the page you're on (ignores "www.") */
export function hostOf(url) {
  try { return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}
/** same site: equal hosts, or one is a subdomain of the other's registrable part */
export function sameSite(a, b) {
  const x = hostOf(a), y = hostOf(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const base = (h) => {
    const p = h.split(".");
    const n = p.length >= 3 && p[p.length - 1].length === 2 && ["co", "com", "org", "net", "gov", "edu", "ac"].includes(p[p.length - 2]) ? 3 : 2;
    return p.slice(-n).join(".");
  };
  return base(x) === base(y) && base(x).includes(".");
}
