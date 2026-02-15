const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ATV', {
  ping: () => 'pong',
  getWatchConfig: () => ipcRenderer.invoke('atv:getWatchConfig'),
  readLatestJsonl: () => ipcRenderer.invoke('atv:readLatestJsonl'),
});
