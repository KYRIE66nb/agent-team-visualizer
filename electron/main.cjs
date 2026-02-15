const { app, BrowserWindow } = require('electron');

const DEV_URL = process.env.ATV_DEV_URL || 'http://localhost:5177';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#0c0f14',
    title: 'Agent Team Visualizer',
    webPreferences: {
      // Keep it simple for MVP; no nodeIntegration.
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(DEV_URL);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
