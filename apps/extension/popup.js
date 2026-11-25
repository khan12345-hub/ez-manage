// EZ Vault extension — popup.
import { generatePassword, generatePassphrase, sameSite, hostOf } from "./vault-crypto.js";

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg).catch((e) => ({ ok: false, error: e.message }));
const views = ["connect", "unlock", "list", "gen", "settings"];
let state = null;
let items = [];
let pageUrl = "";

function show(v) {
  for (const x of views) $(`v-${x}`).hidden = x !== v;
  document.body.dataset.view = v;              // widens the window for the two-pane list
  $("btn-lock").hidden = !state?.unlocked;
  $("btn-gen").hidden = !state?.connected;
}
function toast(t) {
  const el = $("toast"); el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 1600);
}
async function copy(text, what, uid, action = "copied") {
  await navigator.clipboard.writeText(text);
  toast(`${what} copied`);
  if (uid) send({ type: "logEvent", uid, action });
}

async function boot() {
  state = await send({ type: "state" });
  const tab = await send({ type: "activeUrl" });
  pageUrl = tab.url || "";
  if (!state.connected) return show("connect");
  if (!state.unlocked) {
    $("who").textContent = state.user ? `${state.user.name} · ${state.user.email}` : "";
    show("unlock");
    setTimeout(() => $("i-master").focus(), 0);
    return;
  }
  await loadList();
}

async function loadList() {
  const r = await send({ type: "list" });
  if (!r.ok) { state.unlocked = false; return boot(); }
  items = r.items.filter((i) => i.type === "login" || (!i.type && (i.password || i.hasPassword)));
  render();
  show("list");
  setTimeout(() => $("i-search").focus(), 0);
}

let filter = "all";
let selUid = null;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const onSite = (i) => !!pageUrl && (i.urls || []).some((u) => sameSite(u, pageUrl));

function strength(pw) {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (pw.length >= 16) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s >= 5 ? { cls: "good", label: "Strong" } : s >= 3 ? { cls: "ok", label: "Good" } : { cls: "weak", label: "Weak" };
}

/** one row in the left column (icon + title + sub); click selects it */
function row(it) {
  const li = document.createElement("li"); li.className = "item" + (it.uid === selUid ? " is-sel" : "");
  const host = hostOf((it.urls || [])[0] || "");
  const letter = (it.title || "?").trim().charAt(0).toUpperCase();
  const fav = document.createElement("span"); fav.className = "fav";
  if (host) { const img = document.createElement("img"); img.src = `https://${host}/favicon.ico`; img.referrerPolicy = "no-referrer"; img.alt = ""; img.onerror = () => { img.remove(); fav.textContent = letter; }; fav.appendChild(img); }
  else fav.textContent = letter;
  const mid = document.createElement("div"); mid.style.minWidth = "0";
  const t = document.createElement("div"); t.className = "t"; t.textContent = it.title || "Login";
  const u = document.createElement("div"); u.className = "u"; u.textContent = it.username || host || "";
  mid.append(t, u);
  li.append(fav, mid);
  li.addEventListener("click", () => { selUid = it.uid; render(); });
  return li;
}

function render() {
  const q = $("i-search").value.trim().toLowerCase();
  const hit = (i) => !q || `${i.title} ${i.username} ${(i.urls || []).join(" ")}`.toLowerCase().includes(q);
  let rows = items.filter(hit);
  if (filter === "site") rows = rows.filter(onSite);
  else if (filter === "fav") rows = rows.filter((i) => i.favorite);
  rows.sort((a, b) => (onSite(b) - onSite(a)) || (a.title || "").localeCompare(b.title || ""));
  rows = rows.slice(0, 300);
  if (!rows.some((i) => i.uid === selUid)) selUid = rows[0]?.uid ?? null;
  const col = $("list-col"); col.replaceChildren(...rows.map(row));
  renderDetail(rows.find((i) => i.uid === selUid) || null, rows.length);
}

/** the right pane: everything about the selected item (secrets stay here, never on the page) */
function renderDetail(it, count) {
  const d = $("detail");
  if (!it) { d.innerHTML = `<p class="muted center detail-empty">${count === 0 ? "No items yet. Add them in EZ Vault on the web, or sign in to a site and choose Save." : "Select an item to see its details."}</p>`; return; }
  const host = hostOf((it.urls || [])[0] || "");
  const letter = (it.title || "?").trim().charAt(0).toUpperCase();
  const forHere = onSite(it);
  const hasSite = (it.urls || []).some(Boolean);
  const siteUrl = (it.urls || []).find(Boolean) || "";
  const st = it.useOnly ? null : strength(it.password);
  d.innerHTML = `
    <div class="dt-head">
      <div class="dt-ico" id="dt-ico">${host ? `<img id="dt-ico-img" src="https://${esc(host)}/favicon.ico" referrerpolicy="no-referrer" alt="">` : esc(letter)}</div>
      <div style="min-width:0;flex:1"><div class="dt-title">${esc(it.title || "Login")}</div><div class="dt-sub">${esc(it.username || host || "")}</div></div>
      <div class="dt-menu-wrap"><button class="icon2" id="dt-menu-btn" title="More" aria-label="More">⋮</button></div>
    </div>
    ${forHere ? `<div class="dt-primary"><button class="pri" id="dt-fill">Fill on this page</button></div>` : hasSite ? `<div class="dt-primary"><button class="pri" id="dt-fill">Open &amp; fill</button></div>` : ""}
    <div class="dt-fields">
      ${it.username ? `<div class="field"><div class="k">Username</div><div class="v"><span class="val">${esc(it.username)}</span><button class="mini" id="dt-copy-user">Copy</button></div></div>` : ""}
      ${it.useOnly ? `<div class="field"><div class="k">Password</div><div class="v"><span class="val muted">Hidden — you can sign in, but not see or copy it</span></div></div>`
        : it.password ? `<div class="field mono"><div class="k">Password</div><div class="v"><span class="val" id="dt-pw">••••••••••</span>${st ? `<span class="strength ${st.cls}">${st.label}</span>` : ""}<button class="mini" id="dt-reveal">Show</button><button class="mini" id="dt-copy-pw">Copy</button></div></div>` : ""}
      ${it.totp ? `<div class="field"><div class="k">One-time code</div><div class="v"><span class="val" id="dt-totp">••• •••</span><button class="mini" id="dt-copy-totp">Copy</button></div></div>` : ""}
      ${siteUrl ? `<div class="field"><div class="k">Website</div><div class="v"><a class="val" href="${esc(siteUrl)}" target="_blank" rel="noopener">${esc(host || siteUrl)}</a></div></div>` : ""}
      ${(it.tags && it.tags.length) ? `<div class="field"><div class="k">Tags</div><div class="v"><span class="tags">${it.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</span></div></div>` : ""}
      ${it.notes ? `<div class="field"><div class="k">Notes</div><div class="notes">${esc(it.notes)}</div></div>` : ""}
    </div>`;
  const ico = $("dt-ico-img"); if (ico) ico.onerror = () => { ico.remove(); const e = $("dt-ico"); if (e) e.textContent = letter; };
  $("dt-fill")?.addEventListener("click", async () => { const r = await send({ type: forHere ? "fillTab" : "openAndFill", uid: it.uid }); if (r.ok) window.close(); else toast(r.error || "Couldn't do that"); });
  $("dt-copy-user")?.addEventListener("click", () => copy(it.username, "Username"));
  $("dt-copy-pw")?.addEventListener("click", () => copy(it.password, "Password", it.uid, "copied"));
  $("dt-reveal")?.addEventListener("click", () => { const el = $("dt-pw"), b = $("dt-reveal"), on = b.dataset.on === "1"; el.textContent = on ? "••••••••••" : it.password; b.textContent = on ? "Show" : "Hide"; b.dataset.on = on ? "" : "1"; if (!on) send({ type: "logEvent", uid: it.uid, action: "revealed" }); });
  $("dt-copy-totp")?.addEventListener("click", async () => { const r = await send({ type: "totp", uid: it.uid }); if (r.totp) copy(r.totp.code, `Code (${r.totp.left}s left)`, it.uid); });
  if (it.totp) send({ type: "totp", uid: it.uid }).then((r) => { if (r?.totp && $("dt-totp")) $("dt-totp").textContent = String(r.totp.code).replace(/(\d{3})(\d{3})/, "$1 $2"); });
  $("dt-menu-btn")?.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(it); });
}

function toggleMenu(it) {
  const wrap = document.querySelector(".dt-menu-wrap"); if (!wrap) return;
  const open = wrap.querySelector(".menu"); if (open) { open.remove(); return; }
  const m = document.createElement("ul"); m.className = "menu";
  const add = (label, fn, cls) => { const li = document.createElement("li"); if (cls) li.className = cls; li.textContent = label; li.addEventListener("click", () => { m.remove(); fn(); }); m.appendChild(li); };
  add("Edit on the web", () => openWeb(`/vault?item=${encodeURIComponent(it.uid)}`));
  const site = (it.urls || []).find(Boolean); if (site) add("Open website", () => chrome.tabs.create({ url: site }));
  add("Open EZ Vault", () => openWeb("/vault"));
  wrap.appendChild(m);
  const off = (e) => { if (!wrap.contains(e.target)) { m.remove(); document.removeEventListener("click", off); } };
  setTimeout(() => document.addEventListener("click", off), 0);
}

// ── connect ──
$("f-connect").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("e-connect").textContent = "";
  const r = await send({ type: "connect", token: $("i-token").value.trim() });
  if (!r.ok) { $("e-connect").textContent = r.error; return; }
  $("i-token").value = "";
  if (!r.setup) { $("e-connect").textContent = "Connected. Now set up EZ Vault on the web (create your master password)."; }
  boot();
});
const openWeb = (path = "/vault") => chrome.tabs.create({ url: `${state?.web || "https://staging-manage.ezify.pk"}${path}` });
// Sign in on the web and connect by itself (1Password-style). The web page auto-connects the extension
// once you're signed in; it also passes its own server address, so the extension always points right.
$("btn-connect-web")?.addEventListener("click", () => openWeb("/vault?connect=extension"));
$("btn-web")?.addEventListener("click", () => openWeb());

// ── unlock ──
$("f-unlock").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pw = $("i-master").value;
  if (!pw) return;
  $("btn-unlock").disabled = true; $("btn-unlock").textContent = "Unlocking…"; $("e-unlock").textContent = "";
  const r = await send({ type: "unlock", password: pw });
  $("i-master").value = "";
  $("btn-unlock").disabled = false; $("btn-unlock").textContent = "Unlock";
  if (!r.ok) { $("e-unlock").textContent = r.error; $("i-master").focus(); return; }
  state.unlocked = true;
  loadList();
});

$("i-search").addEventListener("input", render);
$("btn-lock").addEventListener("click", async () => { await send({ type: "lock" }); state.unlocked = false; boot(); });
// filter tabs (This site / All / Favorites)
for (const t of document.querySelectorAll(".lv-filter .tab")) t.addEventListener("click", () => { filter = t.dataset.f; for (const x of document.querySelectorAll(".lv-filter .tab")) x.classList.toggle("is-on", x === t); render(); });
// new item + generator open on the web / the generator view
$("btn-new")?.addEventListener("click", () => openWeb("/vault?new=login"));
$("btn-gen2")?.addEventListener("click", () => { gen(); show("gen"); });

// ── generator ──
function gen() {
  const words = $("gen-words").checked;
  $("gen-out").textContent = words ? generatePassphrase({ words: Math.max(3, Math.round(Number($("gen-len").value) / 5)) }) : generatePassword({ length: Number($("gen-len").value), digits: $("gen-digits").checked, symbols: $("gen-symbols").checked });
  $("gen-len-v").textContent = $("gen-len").value;
}
$("btn-gen").addEventListener("click", () => { gen(); show("gen"); });
for (const id of ["gen-len", "gen-digits", "gen-symbols", "gen-words"]) $(id).addEventListener("input", gen);
$("gen-new").addEventListener("click", gen);
$("gen-copy").addEventListener("click", () => copy($("gen-out").textContent, "Password"));
$("gen-back").addEventListener("click", boot);

// ── settings ──
// the server / web addresses are hidden under "Advanced" — normal users never touch them
// (they stay populated and saved as before, so dev on localhost keeps working)
function setAdvanced(open) {
  $("s-advanced").hidden = !open;
  $("s-adv-toggle").setAttribute("aria-expanded", String(open));
  $("s-adv-toggle").textContent = open ? "Hide advanced" : "Advanced…";
}
$("s-adv-toggle").addEventListener("click", () => setAdvanced($("s-advanced").hidden));
$("btn-settings").addEventListener("click", async () => {
  state = await send({ type: "state" });
  $("s-api").value = state.api; $("s-web").value = state.web; $("s-lock").value = state.lockMinutes;
  $("s-who").textContent = state.connected ? `Signed in as ${state.user?.name || ""} ${state.user?.email ? `(${state.user.email})` : ""}` : "Not connected.";
  $("btn-signout").hidden = !state.connected;
  $("s-msg").textContent = "";
  setAdvanced(false);
  show("settings");
});
$("f-settings").addEventListener("submit", async (e) => {
  e.preventDefault();
  await send({ type: "settings", api: $("s-api").value, web: $("s-web").value, lockMinutes: Number($("s-lock").value) });
  $("s-msg").textContent = "Saved.";
});
$("s-back").addEventListener("click", boot);
$("btn-signout").addEventListener("click", async () => { await send({ type: "signout" }); state = null; boot(); });

boot();
