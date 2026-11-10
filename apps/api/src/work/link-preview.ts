import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface LinkPreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  iconUrl: string | null;
}

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

/** true for loopback, private, link-local, CGNAT and other non-public addresses */
function isPrivate(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  if (v.startsWith('::ffff:')) return isPrivate(v.slice(7));
  return v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}

/** only public http(s) hosts may be fetched (no internal network) */
async function assertPublic(u: URL) {
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocol');
  if (u.username || u.password) throw new Error('credentials');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('host');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error('private address');
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).trim();

function meta(html: string, keys: string[]) {
  for (const k of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decode(content);
  }
  return null;
}

const absolute = (href: string | null, base: URL) => {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
};

/** Fetch a page's Open Graph preview safely (public hosts only, small, quick). Never throws. */
export async function fetchLinkPreview(raw: string): Promise<LinkPreview | null> {
  try {
    let url = new URL(raw);
    let res: Response | null = null;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      await assertPublic(url);
      res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'EZManageLinkPreview/1.0', accept: 'text/html,application/xhtml+xml' },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        url = new URL(res.headers.get('location')!, url);
        continue;
      }
      break;
    }
    if (!res || !res.ok || !(res.headers.get('content-type') ?? '').includes('html') || !res.body) return null;
    // read at most MAX_BYTES
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks).toString('utf8');
    const head = html.slice(0, html.search(/<\/head>/i) > 0 ? html.search(/<\/head>/i) : html.length);
    const icon = head.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/i)?.[0]?.match(/href=["']([^"']+)["']/i)?.[1] ?? '/favicon.ico';
    return {
      title: (meta(head, ['og:title', 'twitter:title']) ?? decode(head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '')) || null,
      description: meta(head, ['og:description', 'twitter:description', 'description'])?.slice(0, 500) ?? null,
      imageUrl: absolute(meta(head, ['og:image', 'og:image:url', 'twitter:image']), url),
      siteName: meta(head, ['og:site_name']) ?? url.hostname.replace(/^www\./, ''),
      iconUrl: absolute(icon, url),
    };
  } catch {
    return null;
  }
}
