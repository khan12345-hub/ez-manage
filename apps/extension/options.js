// EZ Vault — full-page extension settings (1Password-style). Reads/writes the same settings the
// popup uses, via the background service worker. Each toggle saves immediately.
const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg).catch((e) => ({ ok: false, error: e.message }));
let state = null;

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
