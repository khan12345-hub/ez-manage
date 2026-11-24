// EZ Vault extension — content script (every http/https page, top frame).
// Shows a small dropdown on login fields, fills on click, and offers to save new / changed logins.
// Secrets only come from the background for this page's own site, and only go into its inputs.
(() => {
  if (window.top !== window || window.__ezVault) return;
  window.__ezVault = true;
  const send = (msg) => new Promise((res) => { try { chrome.runtime.sendMessage(msg, (r) => res(chrome.runtime.lastError ? { ok: false } : r || { ok: false })); } catch { res({ ok: false }); } });

  // ── connect from the EZ Vault web page ──
  const WEB_ORIGINS = ["http://localhost:3000", "https://manage.ezify.pk"];
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== location.origin || !WEB_ORIGINS.includes(location.origin)) return;
    const d = e.data;
    if (!d || d.type !== "EZVAULT_CONNECT" || typeof d.token !== "string") return;
    send({ type: "connectFromPage", token: d.token, api: typeof d.api === "string" ? d.api : undefined }).then((r) => {
      window.postMessage({ type: "EZVAULT_CONNECTED", ok: !!r.ok, error: r.ok ? null : r.error || "Couldn't connect" }, location.origin);
    });
  });
  // let the web page know the extension is installed
  if (WEB_ORIGINS.includes(location.origin)) document.documentElement.dataset.ezvaultExtension = "1";

  // ── field detection ──
  const visible = (el) => {
    if (!el || el.disabled || el.readOnly) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05 && el.type !== "hidden";
  };
  const USERISH = /^(text|email|tel|)$/i;
  function usernameFor(pw) {
    const scope = pw.form || document;
    const inputs = [...scope.querySelectorAll("input")].filter(visible);
    const i = inputs.indexOf(pw);
    for (let j = i - 1; j >= 0; j--) if (USERISH.test(inputs[j].type || "text") && inputs[j].type !== "password") return inputs[j];
    return null;
  }
  const passwords = () => [...document.querySelectorAll('input[type="password"]')].filter(visible);
  function fieldsNear(el) {
    if (el.type === "password") return { pw: el, user: usernameFor(el) };
    const pws = passwords().filter((p) => (el.form ? p.form === el.form : true));
    const pw = pws[0] || null;
    if (pw && usernameFor(pw) === el) return { pw, user: el };
    // a username-first page (password on the next step)
    if (!pw && /user|email|login/i.test(`${el.name} ${el.id} ${el.autocomplete} ${el.type}`)) return { pw: null, user: el };
    return null;
  }

  // React / Vue safe value set
  function setValue(el, v) {
    if (!el || !visible(el)) return;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function fillInto(target, username, password) {
    const f = fieldsNear(target) || { pw: passwords()[0], user: passwords()[0] ? usernameFor(passwords()[0]) : null };
    if (f.user && username) setValue(f.user, username);
    if (f.pw && password) setValue(f.pw, password);
  }

  // ── dropdown (shadow DOM so the page's CSS can't touch it) ──
  let host = null, shadow = null, forEl = null;
  const CSS = `
    :host{all:initial}
    .box{position:fixed;z-index:2147483647;min-width:240px;max-width:340px;background:#fff;border:1px solid #d9d5cb;border-radius:12px;box-shadow:0 12px 32px -12px rgba(11,42,31,.45);font:13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1b1f1c;overflow:hidden}
    .hd{display:flex;align-items:center;gap:6px;padding:7px 10px;background:#0b2a1f;color:#f3efe6;font-weight:600;font-size:12px;letter-spacing:.02em}
    .hd i{width:8px;height:8px;border-radius:50%;background:#b08d57;display:inline-block}
    button.it{all:unset;box-sizing:border-box;display:block;width:100%;padding:8px 11px;cursor:pointer;border-top:1px solid #eee9de}
    button.it:hover,button.it:focus{background:#f5f1e8}
    .t{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .u{color:#6b6f69;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .msg{padding:10px 11px;color:#4a4f4a}`;
  function hide() { host?.remove(); host = shadow = forEl = null; }
  function place(box, el) {
    const r = el.getBoundingClientRect();
    box.style.left = `${Math.max(4, Math.min(r.left, innerWidth - 344))}px`;
    box.style.top = `${r.bottom + 4 + 260 > innerHeight && r.top > 260 ? r.top - 4 - box.offsetHeight : r.bottom + 4}px`;
  }
  async function show(el) {
    const res = await send({ type: "matches" });
    if (!res.ok || document.activeElement !== el) return;
    if (!res.locked && !res.items.length) { hide(); return; }
    hide();
    forEl = el;
    host = document.createElement("ez-vault-fill");
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style"); style.textContent = CSS;
    const box = document.createElement("div"); box.className = "box"; box.setAttribute("role", "listbox"); box.setAttribute("aria-label", "EZ Vault logins");
    const hd = document.createElement("div"); hd.className = "hd"; hd.innerHTML = "<i></i>"; hd.append("EZ Vault");
    box.append(hd);
    if (res.locked) {
      const m = document.createElement("div"); m.className = "msg"; m.textContent = "EZ Vault is locked. Click the EZ Vault icon in the toolbar to unlock it.";
      box.append(m);
    } else {
      for (const it of res.items.slice(0, 8)) {
        const b = document.createElement("button"); b.className = "it"; b.type = "button"; b.setAttribute("role", "option");
        const t = document.createElement("div"); t.className = "t"; t.textContent = it.title || "Login";
        const u = document.createElement("div"); u.className = "u"; u.textContent = it.username || "(no username)";
        b.append(t, u);
        b.addEventListener("mousedown", (e) => e.preventDefault());
        b.addEventListener("click", async () => {
          const r = await send({ type: "fill", uid: it.uid });
          if (r.ok) fillInto(el, r.username, r.password);
          hide();
        });
        box.append(b);
      }
    }
    shadow.append(style, box);
    document.documentElement.append(host);
    place(box, el);
  }

  // ── in-field icon: a small EZ Vault mark inside login fields; click to open / close the list (like 1Password) ──
  let iconHost = null, iconEl = null;
  function removeIcon() { iconHost?.remove(); iconHost = iconEl = null; }
  function positionIcon(el) {
    if (!iconHost) return;
    const r = el.getBoundingClientRect();
    const btn = iconHost.shadowRoot.querySelector(".ic");
    btn.style.left = `${r.right - 26}px`;
    btn.style.top = `${r.top + (r.height - 20) / 2}px`;
  }
  async function showIcon(el) {
    const res = await send({ type: "matches" });
    if (!res.ok) return;
    // show the key when this site has logins (or when locked, so they can open it)
    if (!res.locked && !res.items.length) { removeIcon(); return; }
    if (iconEl === el && iconHost) { positionIcon(el); return; }
    removeIcon();
    iconEl = el;
    iconHost = document.createElement("ez-vault-icon");
    const sh = iconHost.attachShadow({ mode: "open" });
    sh.innerHTML = `<style>
      :host{all:initial}
      .ic{position:fixed;z-index:2147483646;width:20px;height:20px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:${res.locked ? "#6b6f69" : "#0b2a1f"};border:1px solid ${res.locked ? "#6b6f69" : "#b08d57"};box-shadow:0 2px 6px -1px rgba(11,42,31,.5)}
      .ic:hover{filter:brightness(1.15)}
      .ic svg{width:12px;height:12px}</style>
      <button class="ic" type="button" title="EZ Vault" aria-label="EZ Vault logins">
        <svg viewBox="0 0 24 24" fill="none" stroke="#f3efe6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3"/><path d="m16 7 2 2"/><path d="m19 4 2 2"/></svg>
      </button>`;
    const btn = sh.querySelector(".ic");
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => { e.stopPropagation(); if (host && forEl === el) hide(); else show(el); });
    document.documentElement.append(iconHost);
    positionIcon(el);
  }

  function onField(el) {
    showIcon(el);
    // keep the auto-open on an empty field, so filling stays one click away
    if (!el.value) show(el); else hide();
  }
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (el instanceof HTMLInputElement && visible(el) && (el.type === "password" || fieldsNear(el))) onField(el);
    else { hide(); removeIcon(); }
  }, true);
  document.addEventListener("input", (e) => { if (e.isTrusted && host && e.target === forEl) hide(); }, true);
  document.addEventListener("mousedown", (e) => {
    const path = e.composedPath();
    if (host && !path.includes(host) && !path.includes(iconHost) && e.target !== forEl) hide();
    if (iconHost && !path.includes(iconHost) && e.target !== iconEl) removeIcon();
  }, true);
  addEventListener("scroll", () => { if (host && forEl) place(shadow.querySelector(".box"), forEl); if (iconEl) positionIcon(iconEl); }, true);
  addEventListener("resize", () => { if (host && forEl) place(shadow.querySelector(".box"), forEl); if (iconEl) positionIcon(iconEl); }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); }, true);

  // popup "Fill" button
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "doFill") {
      const target = document.activeElement instanceof HTMLInputElement ? document.activeElement : passwords()[0] || document.querySelector("input");
      if (target) fillInto(target, msg.username, msg.password);
    }
  });

  // ── save / update prompt ──
  let lastSent = "";
  function captured(form) {
    const pw = (form ? [...form.querySelectorAll('input[type="password"]')] : passwords()).find((p) => p.value);
    if (!pw) return null;
    const u = usernameFor(pw);
    return { username: u ? u.value.trim() : "", password: pw.value };
  }
  async function submitted(form) {
    const c = captured(form);
    if (!c) return;
    const key = `${c.username}\u0000${c.password}`;
    if (key === lastSent) return;
    lastSent = key;
    const r = await send({ type: "submitted", ...c });
    if (r.ok && (r.action === "save" || r.action === "update")) bar({ action: r.action, username: c.username, title: r.title });
  }
  document.addEventListener("submit", (e) => submitted(e.target instanceof HTMLFormElement ? e.target : null), true);
  document.addEventListener("click", (e) => {
    const b = e.target instanceof Element ? e.target.closest('button, input[type="submit"], [role="button"]') : null;
    if (b && passwords().some((p) => p.value)) submitted(b.closest("form"));
  }, true);

  let barHost = null;
  function bar(p) {
    barHost?.remove();
    barHost = document.createElement("ez-vault-save");
    const sh = barHost.attachShadow({ mode: "open" });
    sh.innerHTML = `<style>
      :host{all:initial}
      .bar{position:fixed;z-index:2147483647;top:14px;right:14px;width:330px;background:#fff;border:1px solid #d9d5cb;border-radius:14px;box-shadow:0 18px 40px -16px rgba(11,42,31,.5);font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1b1f1c;overflow:hidden}
      .hd{padding:8px 12px;background:#0b2a1f;color:#f3efe6;font-weight:600;font-size:12px;display:flex;gap:6px;align-items:center}.hd i{width:8px;height:8px;border-radius:50%;background:#b08d57;display:inline-block}
      .bd{padding:12px}.q{font-weight:600;font-size:14px}.u{color:#6b6f69;margin-top:2px;word-break:break-all}
      .ac{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
      button{all:unset;cursor:pointer;padding:6px 11px;border-radius:8px;font-weight:600;font-size:12.5px}
      .pri{background:#0b2a1f;color:#fff}.sec{border:1px solid #d9d5cb;color:#33372f}.lnk{color:#6b6f69;margin-left:auto}
    </style><div class="bar" role="dialog" aria-label="Save to EZ Vault"><div class="hd"><i></i>EZ Vault</div><div class="bd"><div class="q"></div><div class="u"></div><div class="ac"><button class="pri" data-c="save"></button><button class="sec" data-c="never">Never for this site</button><button class="lnk" data-c="later">Not now</button></div></div></div>`;
    sh.querySelector(".q").textContent = p.action === "update" ? `Update the password for ${p.title || location.hostname}?` : "Save this login in EZ Vault?";
    sh.querySelector(".u").textContent = `${p.username || "(no username)"} · ${location.hostname}`;
    sh.querySelector(".pri").textContent = p.action === "update" ? "Update" : "Save";
    sh.querySelectorAll("button").forEach((b) => b.addEventListener("click", async () => {
      const choice = b.dataset.c;
      if (choice === "later") { await send({ type: "decide", choice: "later" }); barHost.remove(); return; }
      const r = await send({ type: "decide", choice });
      const q = sh.querySelector(".q");
      q.textContent = r.ok ? (choice === "never" ? "OK — EZ Vault won't ask on this site." : p.action === "update" ? "Password updated." : "Saved in EZ Vault.") : (r.error === "LOCKED" ? "Unlock EZ Vault first (toolbar icon)." : r.error || "Couldn't save.");
      sh.querySelector(".ac").remove();
      setTimeout(() => barHost?.remove(), 2500);
    }));
    document.documentElement.append(barHost);
  }
  // "Open & fill": the popup sent us to this login's site — pull the credentials and fill them
  (async () => {
    for (const wait of [0, 400, 1200]) {
      await new Promise((r) => setTimeout(r, wait));
      const r = await send({ type: "pendingFill" });
      if (r.ok && r.fill) {
        const target = passwords()[0] || document.querySelector('input[type="email"], input[type="text"], input:not([type])');
        if (target) fillInto(target, r.fill.username, r.fill.password);
        return;
      }
    }
  })();

  // after a login form navigated here, show the offer again
  (async () => {
    for (const wait of [0, 600, 1500]) {
      await new Promise((r) => setTimeout(r, wait));
      if (barHost) return;
      const r = await send({ type: "pending" });
      if (r.ok && r.pending) { bar(r.pending); return; }
    }
  })();
})();
