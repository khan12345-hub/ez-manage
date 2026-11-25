# EZ Tracker — Silent (unattended) deployment

The silent mode runs EZ Tracker with **no window and no tray icon**, auto-starts on login, and starts
tracking automatically — like Hubstaff's Silent App. It is meant for **organisation-owned / managed
computers where staff have been told their work time and activity are monitored** (the organisation's
policy / employment agreement is the consent; the server records acceptance of the current policy
version for every device).

**It is not covert.** The app keeps its real name ("EZ Tracker") in the Windows process list, in
Installed Programs, and in the Windows start-up list. It does not hide, disguise itself, or block
Task Manager. Do not use it to monitor anyone who has not been informed — that is unlawful in most
places and the app is not built to support it.

## How IT deploys it — one time

1. **Install** EZ Tracker on the computer (`EZTrackerSetup-0.4.0.exe`). In the web app, make sure
   **tracking is turned on** for that person (People → add them).
2. **Launch once with `--silent`**, e.g. a shortcut to:
   `"C:\Program Files\EZ Tracker\EZ Tracker.exe" --silent`
   - If the computer isn't paired yet, the Pair screen appears **this one time** — enter the code from
     the web app (People → the person → pairing code).
   - The moment it's paired, the window closes for good. From then on the app:
     - saves `silent: true`,
     - **auto-starts on login with `--silent`**,
     - **auto-accepts the organisation monitoring policy**, and
     - **auto-starts tracking** every time.

That's the whole setup — **once**. The window and tray never appear again, and it never asks to pair
or sign in again (a transient server error won't un-pair it).

## Turning it off

Delete the EZ Tracker start-up entry (Task Manager → Start-up, or `shell:startup`), or uninstall the
app from Installed Programs. (You can also clear `silent` in the app's config file and relaunch.)

## What is tracked (unchanged from the normal app)

Time in 10-minute slots, keyboard/mouse **activity counts** (never what was typed), the front app /
window title (and URL if the admin turned that on), idle time, and periodic screenshots at the rate
the admin set. Members still only see **their own** hours in the web app — never their own screenshots
or apps.
