/* The only bridge the window gets: a few named actions and the state stream (no Node access). */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ezt', {
  pair: (apiBase: string, code: string) => ipcRenderer.invoke('pair', { apiBase, code }),
  consent: () => ipcRenderer.invoke('consent'),
  tasks: (q: string) => ipcRenderer.invoke('tasks', q),
  start: (t: { id?: number | null; name?: string | null }) => ipcRenderer.invoke('start', t),
  stop: () => ipcRenderer.invoke('stop'),
  signout: () => ipcRenderer.invoke('signout'),
  autostart: (on: boolean) => ipcRenderer.invoke('autostart', on),
  openWeb: () => ipcRenderer.invoke('openWeb'),
  refresh: () => ipcRenderer.invoke('refresh'),
  onState: (f: (s: unknown) => void) => { ipcRenderer.on('state', (_e, s) => f(s)); },
});
