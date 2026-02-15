const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('Electron loaded, app type:', typeof app);

app.whenReady().then(() => {
  console.log('App ready!');
  const win = new BrowserWindow({
    width: 800,
    height: 600
  });
  win.loadFile(path.join(__dirname, 'renderer', 'login.html'));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
