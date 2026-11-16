# EZ Vault — Chrome extension

Fills and saves logins from EZ Vault. Zero-knowledge: the master password and keys never leave the browser; unlocked keys live only in `chrome.storage.session` (memory) and are wiped on lock / idle / browser close.

## Install (developer mode)
1. Chrome → `chrome://extensions` → turn on **Developer mode**.
2. **Load unpacked** → pick this folder (`apps/extension`).
3. Click the EZ Vault toolbar icon → paste the connect code from EZ Vault on the web (**Settings → Browser extension**), or click **Connect this browser** there.
4. Unlock with your master password.

Settings (gear): API address (default `http://localhost:3010`; production = the API URL), web app address, auto-lock minutes.

## Files
- `manifest.json` — MV3
- `background.js` — sign-in token, unlock, decrypt, autofill checks, save/update, auto-lock
- `content.js` — dropdown on login fields, fill, save/update bar, connect message from the web app
- `popup.html/.css/.js` — connect, unlock, search, copy, fill, one-time codes, generator, settings
- `vault-crypto.js` — must equal `apps/web/lib/vault/vault-crypto.js` (`node check-crypto.mjs`)
- `make-icons.mjs` — redraws `icons/`
