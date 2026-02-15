const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const WATCH_MODE = process.env.ATV_WATCH_MODE === '1';
const WATCH_DIR = process.env.ATV_WATCH_DIR || path.join(app.getPath('home'), '.openclaw', 'workspace', 'projects', 'interview-grill', 'runs');

const DEV_URL = process.env.ATV_DEV_URL || 'http://localhost:5177';
const FALLBACK_DATA_PREFIX = 'data:text/html';
const DEFAULT_LOG_FILE = 'logs/main.log';

let logFilePath = null;

function serializeDetails(details) {
  if (details === undefined || details === null) {
    return '';
  }

  if (details instanceof Error) {
    return JSON.stringify({
      name: details.name,
      message: details.message,
      stack: details.stack,
    });
  }

  if (typeof details === 'string') {
    return details;
  }

  try {
    return JSON.stringify(details);
  } catch (_error) {
    return String(details);
  }
}

function writeMainLog(level, message, details) {
  const detailText = serializeDetails(details);
  const line = [
    `[${new Date().toISOString()}]`,
    `[${level}]`,
    message,
    detailText,
  ]
    .filter(Boolean)
    .join(' ');

  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }

  if (!logFilePath) {
    return;
  }

  try {
    fs.appendFileSync(logFilePath, `${line}\n`, 'utf8');
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [ERROR] Failed to append to main log`, error);
  }
}

function initializeLogging() {
  const logDirectory = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDirectory, { recursive: true });
  logFilePath = path.join(logDirectory, 'main.log');
  writeMainLog('INFO', 'Initialized main-process logging', {
    logFilePath,
    userDataPath: app.getPath('userData'),
    watchMode: WATCH_MODE,
    watchDir: WATCH_DIR,
  });
}

function listJsonlFiles(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => name.toLowerCase().endsWith('.jsonl'))
      .map((name) => path.join(dir, name));
  } catch (_error) {
    return [];
  }
}

function pickLatestJsonl(dir) {
  const files = listJsonlFiles(dir);
  let latest = null;
  let latestMtime = 0;
  for (const f of files) {
    try {
      const st = fs.statSync(f);
      const m = st.mtimeMs || 0;
      if (m >= latestMtime) {
        latestMtime = m;
        latest = f;
      }
    } catch (_error) {
      // ignore
    }
  }
  return latest;
}

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function showFallbackPage(win, reason, attemptedTarget) {
  const fallbackHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agent Team Visualizer - Load Error</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0d1117;
      color: #f0f6fc;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      box-sizing: border-box;
    }
    main {
      width: min(720px, 100%);
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 20px;
      background: #161b22;
    }
    h1 { margin: 0 0 12px 0; font-size: 22px; }
    p { margin: 0 0 10px 0; line-height: 1.5; }
    code {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 2px 6px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <main>
    <h1>The app failed to load</h1>
    <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p><strong>Target:</strong> <code>${escapeHtml(attemptedTarget)}</code></p>
    <p><strong>Main log:</strong> <code>${escapeHtml(logFilePath || DEFAULT_LOG_FILE)}</code></p>
  </main>
</body>
</html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`);
}

async function createWindow() {
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

  ipcMain.handle('atv:getWatchConfig', () => {
    return { enabled: WATCH_MODE, dir: WATCH_DIR };
  });

  ipcMain.handle('atv:readLatestJsonl', () => {
    const latest = pickLatestJsonl(WATCH_DIR);
    if (!latest) return { ok: false, error: 'no-jsonl-found', dir: WATCH_DIR };
    try {
      const text = fs.readFileSync(latest, 'utf8');
      return { ok: true, filePath: latest, text };
    } catch (error) {
      return { ok: false, error: error?.message || String(error), dir: WATCH_DIR };
    }
  });

  const attemptedTarget = app.isPackaged
    ? path.join(__dirname, '..', 'dist', 'index.html')
    : DEV_URL;
  let fallbackDisplayed = false;

  const showFallback = async (reason) => {
    if (fallbackDisplayed || win.isDestroyed()) {
      return;
    }
    fallbackDisplayed = true;
    writeMainLog('ERROR', 'Displaying fallback page', {
      reason,
      attemptedTarget,
      logFilePath: logFilePath || DEFAULT_LOG_FILE,
    });
    try {
      await showFallbackPage(win, reason, attemptedTarget);
    } catch (error) {
      writeMainLog('ERROR', 'Fallback page failed to render', error);
    }
  };

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    writeMainLog('INFO', 'renderer-console', {
      level,
      message,
      line,
      sourceId,
    });
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    writeMainLog('ERROR', 'render-process-gone', details);
    void showFallback(`Renderer process exited (${details.reason || 'unknown'}).`);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    writeMainLog('ERROR', 'did-fail-load', {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
    });

    if (!isMainFrame) {
      return;
    }

    if (typeof validatedURL === 'string' && validatedURL.startsWith(FALLBACK_DATA_PREFIX)) {
      return;
    }

    void showFallback(`Failed to load the app (${errorDescription}, code ${errorCode}).`);
  });

  win.webContents.on('did-finish-load', () => {
    writeMainLog('INFO', 'did-finish-load', { url: win.webContents.getURL() });
  });

  try {
    if (app.isPackaged) {
      writeMainLog('INFO', 'Calling loadFile', { filePath: attemptedTarget });
      await win.loadFile(attemptedTarget);
    } else {
      writeMainLog('INFO', 'Calling loadURL', { url: attemptedTarget });
      await win.loadURL(attemptedTarget);
    }
  } catch (error) {
    writeMainLog('ERROR', 'Initial navigation failed', { attemptedTarget, error });
    await showFallback(`Initial navigation failed: ${error.message || error}`);
  }
}

process.on('uncaughtException', (error) => {
  writeMainLog('ERROR', 'uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
  writeMainLog('ERROR', 'unhandledRejection', reason);
});

app.whenReady().then(() => {
  initializeLogging();
  writeMainLog('INFO', 'App ready', {
    isPackaged: app.isPackaged,
    cwd: process.cwd(),
    resourcesPath: process.resourcesPath,
  });

  void createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      writeMainLog('INFO', 'App activate requested window recreation');
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  writeMainLog('INFO', 'window-all-closed', { platform: process.platform });
  if (process.platform !== 'darwin') app.quit();
});
