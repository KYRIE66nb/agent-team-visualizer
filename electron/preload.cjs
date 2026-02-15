const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('ATV', {
  ping: () => 'pong'
});
