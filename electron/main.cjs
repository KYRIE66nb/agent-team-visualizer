const { app, BrowserWindow } = require('electron');
const path = require('path');

const DEV_URL = process.env.ATV_DEV_URL || 'http://localhost:5177';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#0b0d10',
    title: 'Agent Team Visualizer',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // In production we load the built files; in dev we load Vite.
  if (!app.isPackaged) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Helpful diagnostics for black-screen issues.
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('render-process-gone', details);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('did-fail-load', code, desc, url);
  });
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
