const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const BACKEND_PORT = 3001;
const FRONTEND_PORT = 3000;
const HOST = '127.0.0.1';

let backendProc = null;
let frontendProc = null;
let mainWindow = null;

function resourceDir(name) {
  return app.isPackaged
    ? path.join(process.resourcesPath, name)
    : path.join(__dirname, '..', name);
}

function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          return reject(new Error(`Timeout waiting for ${url}`));
        }
        setTimeout(tick, 300);
      });
      req.setTimeout(1000, () => req.destroy());
    };
    tick();
  });
}

function startBackend() {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(BACKEND_PORT),
    DB_PATH: path.join(app.getPath('userData'), 'jira-power.db'),
  };
  backendProc = spawn(
    process.execPath,
    [path.join(resourceDir('backend'), 'dist', 'index.js')],
    { cwd: resourceDir('backend'), env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
  );
  backendProc.stdout.on('data', (d) => console.log('[backend]', String(d).trim()));
  backendProc.stderr.on('data', (d) => console.error('[backend]', String(d).trim()));
  backendProc.on('error', (err) => console.error('[backend] process error:', err));
  backendProc.on('exit', (c, s) => console.log(`[backend] exited code=${c} signal=${s}`));
  return backendProc;
}

function startFrontend() {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(FRONTEND_PORT),
    HOSTNAME: HOST,
  };
  frontendProc = spawn(
    process.execPath,
    [path.join(resourceDir('frontend'), 'server.js')],
    { cwd: resourceDir('frontend'), env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
  );
  frontendProc.stdout.on('data', (d) => console.log('[frontend]', String(d).trim()));
  frontendProc.stderr.on('data', (d) => console.error('[frontend]', String(d).trim()));
  frontendProc.on('error', (err) => console.error('[frontend] process error:', err));
  frontendProc.on('exit', (c, s) => console.log(`[frontend] exited code=${c} signal=${s}`));
  return frontendProc;
}

function waitForProcess(child, name, url) {
  let onError;
  let onExit;
  const processFailure = new Promise((_, reject) => {
    onError = (err) => reject(new Error(`${name} failed to start: ${err.message}`));
    onExit = (code, signal) => reject(new Error(
      `${name} exited before becoming ready (code=${code ?? 'unknown'}, signal=${signal ?? 'none'})`
    ));
    child.once('error', onError);
    child.once('exit', onExit);
  });

  return Promise.race([waitFor(url), processFailure]).finally(() => {
    child.removeListener('error', onError);
    child.removeListener('exit', onExit);
  });
}

function stopAll() {
  [backendProc, frontendProc].forEach((p) => {
    if (p && !p.killed) {
      try {
        if (!p.kill()) console.warn(`[shutdown] failed to stop pid=${p.pid}`);
      } catch (err) {
        console.error(`[shutdown] failed to stop pid=${p.pid}:`, err);
      }
    }
  });
  backendProc = null;
  frontendProc = null;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Jira Power',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await mainWindow.loadURL(`http://${HOST}:${FRONTEND_PORT}`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function initAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update available',
      message: `Jira Power v${info.version} is available.`,
      detail: 'A new version is ready. Download and install now?',
      buttons: ['Update now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate().catch((err) => {
          console.error('[updater] download failed:', err.message);
        });
      }
    }).catch((err) => {
      console.error('[updater] failed to show update prompt:', err);
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: `Jira Power v${info.version} downloaded.`,
      detail: 'Restart now to apply the update?',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    }).catch((err) => {
      console.error('[updater] failed to show restart prompt:', err);
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message);
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[updater] check failed:', err.message);
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      app.setAppUserModelId('com.jirapower.desktop');
      const backend = startBackend();
      const frontend = startFrontend();
      await Promise.all([
        waitForProcess(backend, 'Backend', `http://${HOST}:${BACKEND_PORT}/health`),
        waitForProcess(frontend, 'Frontend', `http://${HOST}:${FRONTEND_PORT}`),
      ]);
      await createWindow();
      initAutoUpdater();
    } catch (err) {
      dialog.showErrorBox(
        'Jira Power — Startup failed',
        `Could not start local services.\nPort ${BACKEND_PORT} or ${FRONTEND_PORT} may be in use.\n\n${err.message}`
      );
      app.quit();
    }
  }).catch((err) => {
    console.error('[startup] app initialization failed:', err);
    app.quit();
  });

  app.on('window-all-closed', () => {
    stopAll();
    app.quit();
  });

  app.on('before-quit', () => stopAll());
  app.on('will-quit', () => stopAll());
}
