/* Small client for the EZ Tracker desktop API ("Authorization: Bearer ezt_…"). */

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export type Me = {
  user: { id: number; firstName: string | null; lastName: string | null; email: string } | null;
  workspace: { uid: string; name: string; source?: 'work' | 'boards'; key?: string } | null; member: boolean;
  settings: { screenshotsPer10: number; blur: boolean; trackApps: boolean; trackUrls: boolean; idleMinutes: number };
  tracked: boolean; consent: { version: string; acceptedAt: string | null }; today: number; webUrl?: string | null;
  openSession: { id: number; startedAt: string; taskId: number | null; projectLabel: string | null } | null;
};
export type Task = { id: number; uid: string | null; name: string; dueDate: string | null; where: string; color: string; source?: 'work' | 'boards' };

export class Api {
  constructor(public base: string, public token: string | null) {}
  private async call<T>(method: string, path: string, body?: unknown, form?: FormData): Promise<T> {
    const res = await fetch(this.base.replace(/\/$/, '') + path, {
      method,
      headers: { ...(this.token ? { authorization: `Bearer ${this.token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), 'user-agent': 'EZTracker-Desktop' },
      body: form ?? (body ? JSON.stringify(body) : undefined),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let data: any; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new ApiError(res.status, (Array.isArray(data?.message) ? data.message.join(', ') : data?.message) || `Request failed (${res.status})`);
    return data as T;
  }
  pair(code: string, name: string, os: string, appVersion: string) { return this.call<Me & { token: string; deviceId: number }>('POST', '/tracker/desktop/pair', { code, name, os, appVersion }); }
  /** where to send the person to confirm an auto-connect (the web app) */
  config() { return this.call<{ webUrl: string | null }>('GET', '/tracker/desktop/config'); }
  /** zero-touch: exchange a baked deploy code for that person's device token (silent deployment) */
  deploy(code: string, name: string, os: string, appVersion: string) { return this.call<Me & { token: string; deviceId: number }>('POST', '/tracker/desktop/deploy', { code, name, os, appVersion }); }
  /** auto-connect: returns the device token once the signed-in web user has confirmed, else { pending: true } */
  connectExchange(nonce: string, name: string, os: string, appVersion: string) {
    return this.call<(Me & { token: string; deviceId: number }) | { pending: true }>('POST', '/tracker/desktop/connect/exchange', { nonce, name, os, appVersion });
  }
  me() { return this.call<Me>('GET', '/tracker/desktop/me'); }
  consent(version: string) { return this.call<{ acceptedAt: string }>('POST', '/tracker/desktop/consent', { version }); }
  tasks(q: string) { return this.call<Task[]>('GET', `/tracker/desktop/tasks?q=${encodeURIComponent(q)}`); }
  start(b: { clientId: string; taskId?: number | null; projectLabel?: string | null; startedAt?: string }) { return this.call<{ id: number; startedAt: string }>('POST', '/tracker/desktop/sessions', b); }
  stop(id: number, endedAt: string) { return this.call<{ id: number }>('POST', `/tracker/desktop/sessions/${id}/stop`, { endedAt }); }
  heartbeat(id: number) { return this.call<{ ended: boolean }>('POST', `/tracker/desktop/sessions/${id}/heartbeat`); }
  slots(sessionId: number, slots: unknown[]) { return this.call<{ saved: number; skipped: number }>('POST', '/tracker/desktop/slots', { sessionId, slots }); }
  shot(fields: Record<string, string>, jpeg: Buffer) {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    f.append('file', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), 'shot.jpg');
    return this.call<{ id: number; url: string }>('POST', '/tracker/desktop/shots', undefined, f);
  }
}
