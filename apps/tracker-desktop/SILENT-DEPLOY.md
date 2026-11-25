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

## How IT deploys it

1. **Install** EZ Tracker on the computer (`EZTrackerSetup-0.4.0.exe`).
2. **Pair it once** — run the app normally; on the Pair screen enter the code from the EZ Tracker
   web app (People → add the person → their pairing code). The admin must also have **tracking turned
   on** for that person in the web app.
3. **Switch it to silent** — launch the app once with the `--silent` flag, e.g. a shortcut to:
   `"C:\Program Files\EZ Tracker\EZ Tracker.exe" --silent`
   From then on it:
   - saves `silent: true` in its config,
   - registers itself to **auto-start on login with `--silent`**, and
   - **auto-accepts the organisation monitoring policy** and **auto-starts tracking** each launch.

After step 3 the window and tray never appear again; the computer tracks automatically on every login.

## Turning it off

Delete the EZ Tracker start-up entry (Task Manager → Start-up, or `shell:startup`), or uninstall the
app from Installed Programs. (You can also clear `silent` in the app's config file and relaunch.)

## What is tracked (unchanged from the normal app)

Time in 10-minute slots, keyboard/mouse **activity counts** (never what was typed), the front app /
window title (and URL if the admin turned that on), idle time, and periodic screenshots at the rate
the admin set. Members still only see **their own** hours in the web app — never their own screenshots
or apps.
