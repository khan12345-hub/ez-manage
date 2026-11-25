# EZ Tracker — Silent (unattended) deployment

The silent mode runs EZ Tracker with **no window and no tray icon**, auto-starts on login, and starts
tracking automatically — like Hubstaff's Silent App. It is meant for **organisation-owned / managed
computers where staff have been told their work time and activity are monitored** (the organisation's
policy / employment agreement is the consent; the server records acceptance of the current policy
version for every device).

**It is not covert.** The silent installer skips the Start-menu shortcut, so it doesn't appear in the
app search — exactly like Hubstaff's Silent App. But it keeps its real name ("EZ Tracker") in the
**Windows process list (Task Manager)**, in **Add/Remove Programs (uninstallable)**, and in the
**start-up list**. It does **not** hide the process, disguise its name, block Task Manager, or prevent
uninstalling. Covert monitoring — hiding the app so the person can't find or remove it — is unlawful in
most places and EZ Tracker is deliberately not built to do it. Only use it on organisation-owned
computers for people who have been told their work activity is monitored.

## Two ways to deploy

### A. Dedicated silent installer (recommended for fleets)

Build a **silent-deployment installer** — it installs with **no desktop or Start-menu shortcut**
(so it does not show up in the Start-menu app search), runs headless, auto-starts on login and
auto-tracks, out of the box:

```
EZT_SILENT=1 EZT_DEFAULT_API=https://apimanage.ezify.pk/api pnpm --filter ./apps/tracker-desktop dist:win:silent
```

This produces `release/EZTracker-SilentSetup-<version>.exe` (per-machine, one-click). Run it on the
computer; because there is no shortcut it won't appear in app search, but — see below — it **stays in
Add/Remove Programs and Task Manager**. In the web app, turn **tracking on** for the person (People →
add them). The first launch shows the Pair screen **once** (enter the pairing code), then it is
headless forever.

### A2. Zero-touch — a per-person deploy code (no pair screen at all)

To skip even the one-time pair screen, bake a **deploy code** into the person's installer:

1. In the web app: **My tracking → Silent (unattended) setup → Zero-touch deploy code** → pick the
   person → **Generate**. You get a long-lived `ezd_…` code (revocable).
2. Build *that person's* silent installer with the code (the web shows the exact line):
   ```
   EZT_DEPLOY_CODE=ezd_… EZT_SILENT=1 EZT_DEFAULT_API=https://apimanage.ezify.pk/api pnpm --filter ./apps/tracker-desktop dist:win:silent
   ```
3. Run it on that person's computer. On first launch it exchanges the code for **that person's**
   device token and goes headless immediately — **no pair screen, nothing to type.** (If the
   computer is offline at install, it keeps retrying every minute until it connects.)

The code identifies the person (the server maps code → user), so each person gets their own installer.
Revoke a code any time from the same screen; existing devices keep working, but the code can't pair
new ones. A baked code is a secret — treat the installer as sensitive and revoke if it leaks.

**One installer for everyone — assign later (Hubstaff-style).** Instead of a per-person code, click
**Organization token**: one code for a *single* installer you deploy to every computer. On first run
each computer **enrols unassigned**; it shows up under **My tracking → … → "computers waiting to be
assigned"**, where an admin assigns it to a person. It starts tracking that person within a minute —
no per-person builds.

### B. Normal installer + `--silent` flag

1. **Install** EZ Tracker (`EZTrackerSetup-<version>.exe`). Turn **tracking on** for the person in the web app.
2. **Launch once with `--silent`**, e.g. a shortcut to:
   `"C:\Program Files\EZ Tracker\EZ Tracker.exe" --silent`
   - If not paired yet, the Pair screen appears **this one time** — enter the code (or press *Connect
     with my account*).
   - The moment it's paired the window closes for good; from then on it saves `silent: true`,
     auto-starts on login with `--silent`, auto-accepts the monitoring policy, and auto-starts tracking.

Either way the window and tray never appear again, and it never asks to pair or sign in again (a
transient server error won't un-pair it).

> **Why is the timer "manual" when I just double-click EZ Tracker?** Because that's the *normal* app,
> not a silent build. The normal app always shows its window and waits for you to press Start — that's
> intentional. Silent / headless auto-tracking only happens in a silent build (A) or with `--silent` (B),
> **and only when tracking is turned on for that person in the web app.**

## Turning it off

Delete the EZ Tracker start-up entry (Task Manager → Start-up, or `shell:startup`), or uninstall the
app from Installed Programs. (You can also clear `silent` in the app's config file and relaunch.)

## What is tracked (unchanged from the normal app)

Time in 10-minute slots, keyboard/mouse **activity counts** (never what was typed), the front app /
window title (and URL if the admin turned that on), idle time, and periodic screenshots at the rate
the admin set. Members still only see **their own** hours in the web app — never their own screenshots
or apps.
