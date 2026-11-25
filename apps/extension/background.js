// EZ Vault extension — background service worker.
// Settings + sign-in token live in storage.local. Once unlocked, the vault keys and the decrypted
// items live ONLY in storage.session (memory; gone when the browser closes or the vault locks).
// The master password is never stored anywhere.
import * as C from "./vault-crypto.js";

// Live by default (for the distributed extension). The connect flow also passes the web's own server
// address, so the extension points right whichever site you sign in to. For local dev, set
// api=http://localhost:3010 and web=http://localhost:3000 under the popup's Advanced settings.
const DEFAULTS = { api: "https://staging-apimanage.ezify.pk", web: "https://staging-manage.ezify.pk", lockMinutes: 15, never: [] };
const WEB_ORIGINS = ["https://staging-manage.ezify.pk", "https://manage.ezify.pk", "http://localhost:3000"];

async function settings() {
  const s = await chrome.storage.local.get(["api", "web", "token", "lockMinutes", "never", "user"]);
  return { ...DEFAULTS, ...s };
}
const session = () => chrome.storage.session.get(["unlocked", "vaultKeys", "vaults", "items", "lastActive", "pending"]);

async function api(path, init = {}) {
  const s = await settings();
  if (!s.token) throw new Error("NOT_CONNECTED");
  const r = await fetch(`${s.api.replace(/\/$/, "")}/api/vault${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${s.token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
  });
  if (r.status === 401) { await chrome.storage.local.remove(["token", "user"]); await lock(); throw new Error("SIGNED_OUT"); }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error((data && (Array.isArray(data.message) ? data.message[0] : data.message)) || `Error ${r.status}`);
  return data;
}

async function lock() {
  await chrome.storage.session.clear();
  chrome.action.setBadgeText({ text: "" }).catch(() => {});
}
const touch = () => chrome.storage.session.set({ lastActive: Date.now() });

/** pull vaults + items and decrypt with the keys we already hold */
async function pull(vaultKeys) {
  const [vaults, rows] = await Promise.all([api("/vaults"), api("/items")]);
  const keys = {};
  for (const v of vaults) if (vaultKeys[v.uid]) keys[v.uid] = await C.importVaultKey(vaultKeys[v.uid]);
  const vs = [];
  for (const v of vaults) {
    if (!keys[v.uid]) continue;
    let name = v.kind === "personal" ? "Personal" : "Shared vault";
    try { name = await C.decryptText(keys[v.uid], v.encName); } catch {}
    vs.push({ uid: v.uid, name, kind: v.kind, role: v.role, keyVersion: v.keyVersion });
  }
  const items = [];
  for (const r of rows) {
    if (!keys[r.vaultUid]) continue;
    try { items.push({ uid: r.uid, vaultUid: r.vaultUid, keyVersion: r.keyVersion, updatedAt: r.updatedAt, ...(await C.decryptJson(keys[r.vaultUid], r.data)) }); } catch { /* key changed: skip until next unlock */ }
  }
  return { vaults: vs, items };
}

async function unlock(password) {
  const me = await api("/me");
  if (!me.setup) throw new Error("Set up EZ Vault in the web app first.");
  let priv;
  try { priv = (await C.unlockUserKeys(password, me.keys)).privateKey; } catch (e) { throw new Error(e.message === "WRONG_PASSWORD" ? "Wrong master password." : "Couldn't unlock."); }
  const vaults = await api("/vaults");
  const vaultKeys = {};
  for (const v of vaults) {
    try { vaultKeys[v.uid] = await C.exportVaultKey(await C.unwrapVaultKey(v.encVaultKey, priv)); } catch { /* not readable for us */ }
  }
  const data = await pull(vaultKeys);
  await chrome.storage.session.set({ unlocked: true, vaultKeys, ...data, lastActive: Date.now() });
  await chrome.storage.local.set({ user: me.user ? { name: `${me.user.firstName} ${me.user.lastName}`.trim(), email: me.user.email } : null });
  return { ok: true, count: data.items.length };
}

async function refresh() {
  const s = await session();
  if (!s.unlocked) return;
  const data = await pull(s.vaultKeys);
  await chrome.storage.session.set(data);
}

const logins = (items) => items.filter((i) => i.type === "login" || (!i.type && i.password));
const matchesUrl = (item, url) => (item.urls || []).some((u) => C.sameSite(u, url));
const event = (itemUid, action) => api("/events", { method: "POST", body: JSON.stringify({ itemUid, action }) }).catch(() => null);

/** the tab a content-script message came from — must be the top frame of an http(s) page */
function pageOf(sender) {
  if (!sender.tab || sender.frameId !== 0 || !/^https?:/.test(sender.tab.url || "")) return null;
  return sender.tab.url;
}

async function encryptFor(vaultUid, obj) {
  const s = await session();
  const key = await C.importVaultKey(s.vaultKeys[vaultUid]);
  return C.encryptJson(key, obj);
}

async function saveLogin({ url, username, password, title }, updateUid) {
  const s = await session();
  if (!s.unlocked) throw new Error("LOCKED");
  const host = C.hostOf(url);
  if (updateUid) {
    const it = s.items.find((i) => i.uid === updateUid);
    if (!it) throw new Error("Not found");
    const v = s.vaults.find((x) => x.uid === it.vaultUid);
    if (!v || v.role === "viewer" || v.role === "use_only") throw new Error("You can only use that vault.");
    const { uid, vaultUid, keyVersion, updatedAt, ...data } = it;
    const next = { ...data, password, passwordUpdatedAt: new Date().toISOString() };
    await api(`/items/${uid}`, { method: "PATCH", body: JSON.stringify({ data: await encryptFor(vaultUid, next), keyVersion: v.keyVersion }) });
  } else {
    const personal = s.vaults.find((v) => v.kind === "personal");
    if (!personal) throw new Error("No personal vault.");
    const item = { type: "login", title: title || host, urls: [`https://${host}`, ...(new URL(url).protocol === "http:" ? [new URL(url).origin] : [])], username: username || "", password, notes: "", passwordUpdatedAt: new Date().toISOString() };
    await api(`/vaults/${personal.uid}/items`, { method: "POST", body: JSON.stringify({ data: await encryptFor(personal.uid, item), keyVersion: personal.keyVersion }) });
  }
  await refresh();
}

/** what should happen with a just-submitted login on this page */
async function judge(url, username, password) {
  const st = await settings();
  const host = C.hostOf(url);
  if (st.never.includes(host)) return { action: "none" };
  const s = await session();
  if (!s.unlocked) return { action: "locked" };
  const same = logins(s.items).filter((i) => matchesUrl(i, url));
  const byUser = same.find((i) => (i.username || "").toLowerCase() === (username || "").toLowerCase());
  if (byUser) return byUser.password === password ? { action: "none" } : { action: "update", uid: byUser.uid, title: byUser.title };
  if (same.some((i) => i.password === password && !username)) return { action: "none" };
  return { action: "save" };
}

// "Open & fill": the popup navigates the tab to the login's site; the content script there pulls the
// credentials on load (so the URL is checked from the page's own location — no extra tab permission).
let pendingFill = null;

// a login form posts and the page navigates at once: the next page's "pending" question waits for it
let lastSubmit = Promise.resolve();
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const p = msg?.type === "pending" ? lastSubmit.catch(() => null).then(() => handle(msg, sender)) : handle(msg, sender);
  if (msg?.type === "submitted") lastSubmit = p;
  p.then((r) => reply({ ok: true, ...r }), (e) => reply({ ok: false, error: e.message || String(e) }));
  return true;
});

/** our own pages (popup) — content scripts report the web page's URL instead */
const fromPopup = (sender) => sender.id === chrome.runtime.id && !!sender.url?.startsWith(chrome.runtime.getURL(""));

async function handle(msg, sender) {
  const s = await session();
  if (s.unlocked && msg.type !== "matches") await touch();
  switch (msg.type) {
    // ── popup ──
    case "state": {
      const st = await settings();
      return { connected: !!st.token, unlocked: !!s.unlocked, user: st.user || null, api: st.api, web: st.web, lockMinutes: st.lockMinutes };
    }
    case "settings": {
      if (!fromPopup(sender)) throw new Error("Not allowed");
      const patch = {};
      if (typeof msg.api === "string" && /^https?:\/\/[^\s]+$/.test(msg.api.trim())) patch.api = msg.api.trim().replace(/\/$/, "");
      if (typeof msg.web === "string" && /^https?:\/\/[^\s]+$/.test(msg.web.trim())) patch.web = msg.web.trim().replace(/\/$/, "");
      if (Number.isInteger(msg.lockMinutes) && msg.lockMinutes >= 1 && msg.lockMinutes <= 480) patch.lockMinutes = msg.lockMinutes;
      await chrome.storage.local.set(patch);
      return {};
    }
    case "connect": {
      if (!fromPopup(sender) && !(sender.tab && WEB_ORIGINS.includes(new URL(sender.tab.url).origin))) throw new Error("Not allowed");
      return connect(msg.token, msg.api);
    }
    case "unlock": if (!fromPopup(sender)) throw new Error("Not allowed"); return unlock(String(msg.password || ""));
    case "lock": await lock(); return {};
    case "signout": {
      if (!fromPopup(sender)) throw new Error("Not allowed");
      await api("/extension/sign-out", { method: "POST" }).catch(() => null);
      await chrome.storage.local.remove(["token", "user"]);
      await lock();
      return {};
    }
    case "refresh": if (!fromPopup(sender)) throw new Error("Not allowed"); await refresh(); return {};
    case "list": {
      // the popup only (an extension page): full items to show / copy
      if (!fromPopup(sender)) throw new Error("Not allowed");
      if (!s.unlocked) throw new Error("LOCKED");
      // "use only" vaults: the popup never gets their secrets (filling happens here, in the background)
      const useOnly = new Set(s.vaults.filter((v) => v.role === "use_only").map((v) => v.uid));
      return { items: s.items.map((i) => (useOnly.has(i.vaultUid) ? { uid: i.uid, vaultUid: i.vaultUid, type: i.type, title: i.title, urls: i.urls, username: i.username, hasPassword: !!i.password, totp: i.totp ? true : undefined, useOnly: true } : i)), vaults: s.vaults };
    }
    case "logEvent": if (!fromPopup(sender)) throw new Error("Not allowed"); await event(msg.uid, msg.action); return {};
    case "totp": {
      if (!fromPopup(sender)) throw new Error("Not allowed");
      const it = s.items?.find((i) => i.uid === msg.uid);
      return { totp: it?.totp ? await C.totp(it.totp) : null };
    }
    case "fillTab": {
      // popup "Fill": only into the active tab, and only if it is the item's site
      if (!fromPopup(sender)) throw new Error("Not allowed");
      const it = s.items?.find((i) => i.uid === msg.uid);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!it || !tab?.url || !matchesUrl(it, tab.url)) throw new Error("This login is not for the open page.");
      await chrome.tabs.sendMessage(tab.id, { type: "doFill", username: it.username || "", password: it.password || "" }, { frameId: 0 });
      await event(it.uid, "filled");
      return {};
    }
    case "openAndFill": {
      // popup "Open & fill": go to the login's own site, then fill it once the page loads
      if (!fromPopup(sender)) throw new Error("Not allowed");
      const it = logins(s.items || []).find((i) => i.uid === msg.uid);
      if (!it) throw new Error("Login not found.");
      const raw = (it.urls || [])[0];
      if (!raw) throw new Error("This login has no website.");
      const full = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      pendingFill = { tabId: tab.id, uid: it.uid, at: Date.now() };
      await chrome.tabs.update(tab.id, { url: full });
      return { ok: true };
    }
    case "activeUrl": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return { url: tab?.url || "" };
    }

    // ── content scripts (any web page: never hand out another site's secrets) ──
    case "matches": {
      const url = pageOf(sender);
      if (!url) return { locked: false, items: [] };
      if (!s.unlocked) return { locked: true, items: [] };
      return { locked: false, items: logins(s.items).filter((i) => matchesUrl(i, url)).map((i) => ({ uid: i.uid, title: i.title, username: i.username || "" })) };
    }
    case "fill": {
      const url = pageOf(sender);
      const it = s.unlocked && s.items.find((i) => i.uid === msg.uid);
      if (!url || !it || !matchesUrl(it, url)) throw new Error("Not allowed");
      await event(it.uid, "filled");
      return { username: it.username || "", password: it.password || "" };
    }
    case "pendingFill": {
      // a page just loaded; if the popup's "Open & fill" sent this tab here, hand it the login —
      // but only if the page's own URL matches the item (so secrets never land on the wrong site)
      const tabId = sender?.tab?.id;
      const url = pageOf(sender);
      // kept alive (not cleared here) so a multi-step login — e.g. Google's email page then its
      // password page — fills on both; the content script sends "fillDone" once the password is in.
      if (!pendingFill || pendingFill.tabId !== tabId || Date.now() - pendingFill.at > 45_000) return { fill: null };
      const it = s.unlocked ? logins(s.items || []).find((i) => i.uid === pendingFill.uid) : null;
      if (!it || !url || !matchesUrl(it, url)) return { fill: null };
      if (!pendingFill.logged) { pendingFill.logged = true; await event(it.uid, "filled"); }
      return { fill: { username: it.username || "", password: it.password || "", autoSubmit: true } };
    }
    case "fillDone": { pendingFill = null; return { ok: true }; } // the password step was filled — stop reusing
    case "submitted": {
      const url = pageOf(sender);
      if (!url || !msg.password) return { action: "none" };
      const verdict = await judge(url, String(msg.username || ""), String(msg.password));
      if (verdict.action === "save" || verdict.action === "update") {
        // keep it briefly so the bar can show again on the next page after a navigation
        await chrome.storage.session.set({ pending: { tabId: sender.tab.id, host: C.hostOf(url), url, username: String(msg.username || ""), password: String(msg.password), at: Date.now(), ...verdict } });
      }
      return verdict;
    }
    case "pending": {
      const url = pageOf(sender);
      const p = s.pending;
      if (!url || !p || p.tabId !== sender.tab.id || p.host !== C.hostOf(url) || Date.now() - p.at > 120000) return { pending: null };
      return { pending: { action: p.action, username: p.username, title: p.title || null } };
    }
    case "decide": {
      const url = pageOf(sender);
      const p = s.pending;
      if (!url || !p || p.tabId !== sender.tab.id || p.host !== C.hostOf(url)) throw new Error("Nothing to save");
      await chrome.storage.session.remove("pending");
      if (msg.choice === "never") {
        const st = await settings();
        await chrome.storage.local.set({ never: [...new Set([...st.never, p.host])] });
        return {};
      }
      if (msg.choice === "save") await saveLogin({ url: p.url, username: p.username, password: p.password }, p.action === "update" ? p.uid : null);
      return {};
    }
    case "connectFromPage": {
      // posted by the EZ Vault web page (checked in the content script and here)
      const origin = sender.tab ? new URL(sender.tab.url).origin : "";
      const st = await settings();
      if (!pageOf(sender) || !(WEB_ORIGINS.includes(origin) || origin === st.web)) throw new Error("Not allowed");
      return connect(msg.token, msg.api);
    }
  }
  throw new Error("Unknown message");
}

async function connect(token, apiUrl) {
  if (!/^ezv_[A-Za-z0-9_-]{40,80}$/.test(String(token || ""))) throw new Error("That connect code doesn't look right.");
  const st = await settings();
  const base = typeof apiUrl === "string" && /^https?:\/\/[^\s]+$/.test(apiUrl) ? apiUrl.replace(/\/$/, "") : st.api;
  const r = await fetch(`${base}/api/vault/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(r.status === 401 ? "That connect code is not valid any more." : "Couldn't reach the server.");
  const me = await r.json();
  await lock();
  await chrome.storage.local.set({ token, api: base, user: me.user ? { name: `${me.user.firstName} ${me.user.lastName}`.trim(), email: me.user.email } : null });
  return { user: me.user, setup: me.setup };
}

// auto-lock when idle
chrome.alarms.create("ezvault-autolock", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== "ezvault-autolock") return;
  const [s, st] = await Promise.all([session(), settings()]);
  if (s.unlocked && Date.now() - (s.lastActive || 0) > st.lockMinutes * 60000) await lock();
});
chrome.storage.session.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => {});
