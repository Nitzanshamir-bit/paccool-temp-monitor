console.log('[DEBUG] Starting main.js');
console.log('[DEBUG] Node version:', process.version);
console.log('[DEBUG] Electron version:', process.versions.electron);
console.log('[DEBUG] Process type:', process.type);

// Try to require electron using module.require to bypass normal resolution
let electron;
try {
  electron = module.require ? module.require('electron') : require('electron');
  console.log('[DEBUG] Electron required using module.require');
} catch (e) {
  console.log('[DEBUG] module.require failed, using regular require');
  electron = require('electron');
}

console.log('[DEBUG] Electron required, type:', typeof electron);
console.log('[DEBUG] Electron value:', typeof electron === 'string' ? electron : 'object');
console.log('[DEBUG] Electron.app exists?', electron && electron.app !== undefined);
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
console.log('[DEBUG] app type:', typeof app);
const path = require('path');
// Temporarily comment out to test
// const IPCHandlers = require('./src/ipc/handlers');

let mainWindow = null;
let ipcHandlers = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
    resizable: true,
    minWidth: 800,
    minHeight: 600
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));

  // Open DevTools in development (uncomment for debugging)
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

console.log('[DEBUG] About to call app.whenReady, app is:', typeof app);
app.whenReady().then(() => {
  console.log('[DEBUG] App is ready!');
  // Register IPC handlers - temporarily disabled
  // ipcHandlers = new IPCHandlers(ipcMain);
  // ipcHandlers.register();

  // Add screen switching handlers
  ipcMain.handle('switch-to-status', async (event) => {
    console.log('[Main] Switching to status screen');
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'status.html'));
    return { success: true };
  });

  ipcMain.handle('switch-to-login', async (event) => {
    console.log('[Main] Switching to login screen');
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));
    return { success: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
