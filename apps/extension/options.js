// EZ Vault — full-page extension settings (1Password-style). Reads/writes the same settings the
// popup uses, via the background service worker. Each toggle saves immediately.
const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg).catch((e) => ({ ok: false, error: e.message }));
let state = null;

// inline SVG icons (Lucide-style) for the sidebar tiles
const svg = (b) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
const ICON = {
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'),
  lock: svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  key: svg('<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  help: svg('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
};
for (const el of document.querySelectorAll("[data-icon]")) el.innerHTML = ICON[el.dataset.icon] || "";

function toast(t) { const el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 1500); }
const save = async (patch) => { await send({ type: "settings", ...patch }); toast("Saved"); };
const openWeb = (path = "/vault") => chrome.tabs.create({ url: `${state?.web || "https://staging-manage.ezify.pk"}${path}` });

// section switching
for (const n of document.querySelectorAll(".nav")) n.addEventListener("click", () => {
  for (const x of document.querySelectorAll(".nav")) x.classList.toggle("is-on", x === n);
  for (const p of document.querySelectorAll(".panel")) p.hidden = p.dataset.p !== n.dataset.s;
});
// deep-link via hash (#security etc.)
if (location.hash) { const n = document.querySelector(`.nav[data-s="${location.hash.slice(1)}"]`); if (n) n.click(); }

async function load() {
  state = await send({ type: "state" });
  $("ver").textContent = chrome.runtime.getManifest().version;
  // account
  const connected = !!state.connected;
  $("acct-name").textContent = connected ? (state.user?.name || "EZ Vault") : "Not connected";
  $("acct-email").textContent = connected ? (state.user?.email || "") : "Connect from the popup or the web app.";
  $("acct-ava").textContent = (state.user?.name || state.user?.email || "EZ").trim().charAt(0).toUpperCase() || "EZ";
  $("acct-dot").classList.toggle("on", connected);
  $("signout").disabled = !connected;
  // values
  $("lock").value = String(state.lockMinutes || 15);
  $("offerSave").checked = state.offerSave !== false;
  $("autoSubmit").checked = state.autoSubmit !== false;
  $("showIcons").checked = state.showIcons !== false;
  $("api").value = state.api || "";
  $("web").value = state.web || "";
}

// wire
$("lock").addEventListener("change", (e) => save({ lockMinutes: Number(e.target.value) }));
$("offerSave").addEventListener("change", (e) => save({ offerSave: e.target.checked }));
$("autoSubmit").addEventListener("change", (e) => save({ autoSubmit: e.target.checked }));
$("showIcons").addEventListener("change", (e) => save({ showIcons: e.target.checked }));
$("save-adv").addEventListener("click", async () => { await send({ type: "settings", api: $("api").value.trim(), web: $("web").value.trim() }); toast("Addresses saved"); load(); });
$("open-web").addEventListener("click", () => openWeb("/vault"));
$("help-web").addEventListener("click", () => openWeb("/vault"));
$("help-wt").addEventListener("click", () => openWeb("/vault"));
$("signout").addEventListener("click", async () => { await send({ type: "signout" }); toast("Signed out"); load(); });

load();
