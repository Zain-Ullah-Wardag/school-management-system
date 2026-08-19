import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  savePdf: (html: string, suggestedName?: string, landscape?: boolean) => ipcRenderer.invoke('desktop:save-pdf', html, suggestedName, landscape),
  openPrintPreview: (html: string, title?: string, landscape?: boolean) => ipcRenderer.invoke('desktop:open-print-preview', html, title, landscape),
  openExternal: (url: string) => ipcRenderer.invoke('desktop:open-external', url),
  isElectron: true
});
