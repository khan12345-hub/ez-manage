// EZ Manage desktop preload. The app is the normal EZ Manage web UI — no privileged bridge is needed;
// we only expose a tiny marker so the web app can tell it is running inside the desktop shell.
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('ezDesktop', { app: 'ez-manage', version: '1.0.0' });
