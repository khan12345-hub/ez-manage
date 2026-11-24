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

function row(it) {
  const li = document.createElement("li"); li.className = "item";
  const fav = document.createElement("span"); fav.className = "fav"; fav.textContent = (it.title || "?").trim().charAt(0).toUpperCase();
  const mid = document.createElement("div"); mid.style.minWidth = "0";
  const t = document.createElement("div"); t.className = "t"; t.textContent = it.title || "Login";
  const u = document.createElement("div"); u.className = "u"; u.textContent = it.username || hostOf((it.urls || [])[0] || "") || "";
  mid.append(t, u);
  const acts = document.createElement("div"); acts.className = "acts";
  const btn = (label, title, fn, cls) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.title = title; b.setAttribute("aria-label", `${title}: ${it.title}`); if (cls) b.className = cls; b.addEventListener("click", fn); acts.append(b); };
  const forHere = pageUrl && (it.urls || []).some((x) => sameSite(x, pageUrl));
  const hasSite = (it.urls || []).some(Boolean);
  if (forHere) btn("Fill", "Fill on this page", async () => { const r = await send({ type: "fillTab", uid: it.uid }); if (r.ok) window.close(); else toast(r.error || "Couldn't fill"); }, "fill");
  else if (hasSite) btn("Open & fill", "Open the website and sign in", async () => { const r = await send({ type: "openAndFill", uid: it.uid }); if (r.ok) window.close(); else toast(r.error || "Couldn't open"); }, "fill");
  if (it.username) btn("User", "Copy username", () => copy(it.username, "Username"));
  if (it.useOnly) { const tag = document.createElement("span"); tag.className = "u"; tag.textContent = "use only"; tag.title = "You can sign in with this, but not see or copy the password"; acts.append(tag); }
  // Privacy: the extension fills the password into the page but never copies the raw password to the clipboard.
  if (it.totp) btn("Code", "Copy one-time code", async () => { const r = await send({ type: "totp", uid: it.uid }); if (r.totp) copy(r.totp.code, `Code (${r.totp.left}s left)`, it.uid); });
  li.append(fav, mid, acts);
  return li;
}

function render() {
  const q = $("i-search").value.trim().toLowerCase();
  const hit = (i) => !q || `${i.title} ${i.username} ${(i.urls || []).join(" ")}`.toLowerCase().includes(q);
  const here = pageUrl ? items.filter((i) => (i.urls || []).some((u) => sameSite(u, pageUrl)) && hit(i)) : [];
  const rest = items.filter((i) => !here.includes(i) && hit(i)).sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  $("here").replaceChildren(...here.map(row));
  $("all").replaceChildren(...rest.slice(0, 200).map(row));
  $("here-label").hidden = !here.length;
  $("all-label").hidden = !rest.length;
  $("empty").hidden = !!(here.length || rest.length);
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
const openWeb = (path = "/vault") => chrome.tabs.create({ url: `${state?.web || "http://localhost:3000"}${path}` });
$("btn-open-web").addEventListener("click", () => openWeb("/vault/settings"));
$("btn-web").addEventListener("click", () => openWeb());

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
