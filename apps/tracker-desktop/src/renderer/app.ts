/* EZ Tracker window: pair → consent → main. Talks to the main process only through window.ezt. */

type Res<T> = { ok: true; data: T } | { ok: false; error: string };
type Me = { user: { firstName: string | null; lastName: string | null; email: string } | null; workspace: { name: string } | null; settings: { screenshotsPer10: number; blur: boolean; trackApps: boolean; trackUrls: boolean; idleMinutes: number }; tracked: boolean; consent: { acceptedAt: string | null } };
type EngineState = { running: boolean; startedAt: string | null; taskName: string | null; sessionSeconds: number; todaySeconds: number; pending: number; offline: boolean; idlePrompt: boolean; nativeActivity: boolean };
type State = { screen: 'pair' | 'consent' | 'main'; apiBase: string; me: Me | null; engine: EngineState; autoStart: boolean; error: string | null };
type Task = { id: number; name: string; where: string; color: string };
declare global {
  interface Window {
    ezt: {
      pair(apiBase: string, code: string): Promise<Res<boolean>>; consent(): Promise<Res<boolean>>; tasks(q: string): Promise<Res<Task[]>>;
      start(t: { id?: number | null; name?: string | null }): Promise<Res<boolean>>; stop(): Promise<Res<boolean>>; signout(): Promise<Res<boolean>>;
      autostart(on: boolean): Promise<Res<boolean>>; openWeb(): Promise<Res<boolean>>; refresh(): Promise<Res<boolean>>; onState(f: (s: State) => void): void;
    };
  }
}

const root = document.getElementById('app')!;
let state: State | null = null;
let screen = '';
let tasks: Task[] = [];
let picked: Task | null = null;
let busy = false;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const hms = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const hm = (s: number) => `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
const brand = (sub: string) => `<div class="brand"><div class="logo" aria-hidden="true">⏱</div><div><b>EZ Tracker</b><span>${esc(sub)}</span></div></div>`;
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>';
const STOP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';

function pairScreen(s: State) {
  root.innerHTML = `${brand('Time, screenshots and activity')}
  <section class="card">
    <h1>Connect this computer</h1>
    <p class="muted">On the web, open <b>EZ Tracker → My tracking</b> and press <b>Get a pairing code</b>. Type the 8 characters here.</p>
    <label for="code">Pairing code</label>
    <input id="code" type="text" class="code" maxlength="9" placeholder="ABCD-2345" autocomplete="off" spellcheck="false" />
    <details style="margin-top:10px"><summary class="muted" style="cursor:pointer">Server address</summary>
      <label for="api">API address</label><input id="api" type="url" value="${esc(s.apiBase)}" />
    </details>
    <p class="err" id="err">${esc(s.error ?? '')}</p>
    <button class="btn" id="go">Connect</button>
  </section>
  <p class="muted" style="text-align:center">Nothing is recorded until you agree to it on the next screen.</p>`;
  const go = async () => {
    const code = $<HTMLInputElement>('#code').value.trim();
    if (code.replace(/[^a-z0-9]/gi, '').length !== 8) { $('#err').textContent = 'The code has 8 letters and numbers.'; return; }
    $<HTMLButtonElement>('#go').disabled = true; $('#err').textContent = '';
    const r = await window.ezt.pair($<HTMLInputElement>('#api').value, code);
    if (!r.ok) { $('#err').textContent = r.error; $<HTMLButtonElement>('#go').disabled = false; }
  };
  $('#go').addEventListener('click', go);
  $('#code').addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') void go(); });
  $<HTMLInputElement>('#code').focus();
}

function consentScreen(s: State) {
  const st = s.me!.settings;
  root.innerHTML = `${brand(s.me?.workspace?.name ?? '')}
  <section class="card">
    <h1>Before you start</h1>
    <p class="muted">Please read what EZ Tracker records on this computer for <b>${esc(s.me?.workspace?.name ?? 'your workspace')}</b>.</p>
    <div class="cols" style="margin-top:12px">
      <div class="box yes"><b>Recorded only while you track</b><ul>
        <li>When you press Start and Stop, and the task you picked</li>
        <li>${st.screenshotsPer10 ? `${st.screenshotsPer10} screenshot${st.screenshotsPer10 > 1 ? 's' : ''} of your screen(s) every 10 minutes, at random times${st.blur ? ', blurred' : ''}` : 'No screenshots (turned off)'}</li>
        <li>How many keyboard and mouse actions happen (a count only)</li>
        ${st.trackApps ? '<li>Which app is in front, and for how long</li>' : ''}
        ${st.trackUrls ? "<li>Website names from the browser's window title</li>" : ''}
      </ul></div>
      <div class="box no"><b>Never recorded</b><ul>
        <li>What you type: no keys, messages or passwords</li>
        <li>Anything while the tracker is stopped</li>
        <li>Your microphone or camera</li>
      </ul></div>
      <div class="box who"><b>Who sees it</b><ul>
        <li>You, the workspace owners / admins and your manager</li>
        <li>You can delete any of your screenshots on the web; its 10 minutes are removed too</li>
        <li>A tray icon is always shown while tracking</li>
      </ul></div>
    </div>
    <label class="check"><input type="checkbox" id="agree" /> I have read this and I agree to be tracked while the tracker is running.</label>
    <p class="err" id="err"></p>
    <button class="btn" id="go" disabled>I agree</button>
  </section>
  <div class="foot"><button class="link" id="out">Use another account</button></div>`;
  $('#agree').addEventListener('change', (e) => { $<HTMLButtonElement>('#go').disabled = !(e.target as HTMLInputElement).checked; });
  $('#go').addEventListener('click', async () => { $<HTMLButtonElement>('#go').disabled = true; const r = await window.ezt.consent(); if (!r.ok) { $('#err').textContent = r.error; $<HTMLButtonElement>('#go').disabled = false; } });
  $('#out').addEventListener('click', () => void window.ezt.signout());
}

function renderTasks() {
  const list = $('#tasks');
  if (!list) return;
  list.innerHTML = tasks.length ? tasks.map((t) => `<button class="task${picked?.id === t.id ? ' sel' : ''}" data-id="${t.id}"><i style="background:${esc(t.color)}"></i><span><b>${esc(t.name)}</b><small>${esc(t.where)}</small></span></button>`).join('')
    : '<p class="muted" style="padding:8px">No open tasks assigned to you. You can still start without a task.</p>';
  list.querySelectorAll<HTMLButtonElement>('.task').forEach((b) => b.addEventListener('click', () => { const t = tasks.find((x) => x.id === Number(b.dataset.id)) ?? null; picked = picked?.id === t?.id ? null : t; renderTasks(); }));
}
let searchTimer: number | undefined;
async function loadTasks(q: string) { const r = await window.ezt.tasks(q); tasks = r.ok ? r.data : []; renderTasks(); }

function mainScreen(s: State) {
  const e = s.engine;
  root.innerHTML = `${brand(s.me?.workspace?.name ?? '')}
  <section class="card timer">
    <span class="status ${e.running ? 'on' : ''}"><span class="dot"></span>${e.running ? 'Tracking' : 'Not tracking'}${e.offline ? ' · offline, saving on this computer' : ''}</span>
    <div class="clock" id="clock">${hms(e.sessionSeconds)}</div>
    <div class="task-now" id="tn">${e.running ? esc(e.taskName ?? 'No task') : picked ? esc(picked.name) : '&nbsp;'}</div>
    <button class="big ${e.running ? 'stop' : ''}" id="toggle" aria-label="${e.running ? 'Stop' : 'Start'}" ${busy || e.idlePrompt ? 'disabled' : ''}>${e.running ? STOP : PLAY}</button>
    <div class="today"><span>Today</span><b id="today">${hm(e.todaySeconds)}</b></div>
    <p class="err" id="err">${esc(s.error ?? '')}</p>
  </section>
  ${e.running ? '' : `<section class="card">
    <h2>What are you working on?</h2>
    <input id="q" type="search" placeholder="Search your tasks" aria-label="Search your tasks" />
    <div class="list" id="tasks" role="list"></div>
  </section>`}
  <div class="foot">
    <span>${s.me?.tracked ? '' : '<span class="pill warn">Tracking is off for you</span> '}${e.pending ? `<span class="pill">${e.pending} waiting to upload</span>` : ''}${e.nativeActivity ? '' : ' <span class="pill" title="Activity is measured from the system idle clock">basic activity</span>'}</span>
    <span style="display:flex;gap:10px;align-items:center">
      <label class="toggle" style="margin:0"><input type="checkbox" id="auto" ${s.autoStart ? 'checked' : ''}/> Open at sign-in</label>
      <button class="link" id="web">Open on the web</button>
    </span>
  </div>`;
  $('#toggle').addEventListener('click', async () => {
    busy = true; render();
    const r = e.running ? await window.ezt.stop() : await window.ezt.start(picked ? { id: picked.id, name: picked.name } : { name: null });
    busy = false;
    if (!r.ok) { render(); $('#err').textContent = r.error; } else render();
  });
  $('#web').addEventListener('click', () => void window.ezt.openWeb());
  $('#auto').addEventListener('change', (ev) => void window.ezt.autostart((ev.target as HTMLInputElement).checked));
  if (!e.running) {
    $('#q').addEventListener('input', (ev) => { window.clearTimeout(searchTimer); const q = (ev.target as HTMLInputElement).value; searchTimer = window.setTimeout(() => void loadTasks(q), 250); });
    if (!tasks.length) void loadTasks(''); else renderTasks();
  }
}

function render() {
  if (!state) return;
  if (state.screen === 'pair') pairScreen(state);
  else if (state.screen === 'consent') consentScreen(state);
  else mainScreen(state);
  screen = state.screen;
}

window.ezt.onState((s) => {
  const prev = state;
  state = s;
  // the clock ticks without rebuilding the page (keeps the search box focus)
  if (prev && s.screen === 'main' && screen === 'main' && prev.engine.running === s.engine.running && prev.engine.idlePrompt === s.engine.idlePrompt && prev.engine.pending === s.engine.pending && prev.engine.offline === s.engine.offline && prev.me?.tracked === s.me?.tracked && !busy) {
    const c = $('#clock'); if (c) c.textContent = hms(s.engine.sessionSeconds);
    const t = $('#today'); if (t) t.textContent = hm(s.engine.todaySeconds);
    return;
  }
  render();
});

// local ticking between state pushes
setInterval(() => {
  if (state?.screen === 'main' && state.engine.running) {
    state.engine.sessionSeconds++; state.engine.todaySeconds++;
    const c = $('#clock'); if (c) c.textContent = hms(state.engine.sessionSeconds);
  }
}, 1000);

export {};
