const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer process
contextBridge.exposeInMainWorld('paccoolAPI', {
  login: (credentials) => ipcRenderer.invoke('login', credentials),

  getTemperature: () => ipcRenderer.invoke('get-temperature'),

  saveCredentials: (data) => ipcRenderer.invoke('save-credentials', data),

  getStoredCredentials: () => ipcRenderer.invoke('get-stored-credentials'),

  clearCredentials: () => ipcRenderer.invoke('clear-credentials'),

  logout: () => ipcRenderer.invoke('logout'),

  switchToStatus: () => ipcRenderer.invoke('switch-to-status'),

  switchToLogin: () => ipcRenderer.invoke('switch-to-login')
});
