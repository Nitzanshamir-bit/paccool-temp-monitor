const PaccoolScraper = require('../scraper/paccoolScraper');
const CredentialStore = require('../storage/credentialStore');

class IPCHandlers {
  constructor(ipcMain) {
    this.ipcMain = ipcMain;
    this.scraper = new PaccoolScraper();
    this.credentialStore = new CredentialStore();
  }

  register() {
    // Login handler
    this.ipcMain.handle('login', async (event, { email, password, rememberMe }) => {
      console.log('[IPC] Login request received for:', email);

      const result = await this.scraper.login(email, password);

      if (result.success && rememberMe) {
        // Save credentials if "Remember me" is checked
        this.credentialStore.saveCredentials(email, password);
      }

      return result;
    });

    // Get temperature handler
    this.ipcMain.handle('get-temperature', async (event) => {
      console.log('[IPC] Get temperature request received');

      let result = await this.scraper.getTemperatureData();

      // If session expired, try to re-login with stored credentials
      if (result.sessionExpired) {
        console.log('[IPC] Session expired, attempting auto re-login...');

        const credResult = this.credentialStore.getCredentials();
        if (credResult.success && credResult.credentials) {
          console.log('[IPC] Stored credentials found, re-logging in...');

          const loginResult = await this.scraper.login(
            credResult.credentials.email,
            credResult.credentials.password
          );

          if (loginResult.success) {
            console.log('[IPC] Auto re-login successful, retrying temperature fetch...');
            result = await this.scraper.getTemperatureData();
          } else {
            return {
              success: false,
              error: 'Session expired. Please login again.',
              sessionExpired: true
            };
          }
        } else {
          return {
            success: false,
            error: 'Session expired. Please login again.',
            sessionExpired: true
          };
        }
      }

      return result;
    });

    // Save credentials handler
    this.ipcMain.handle('save-credentials', async (event, { email, password }) => {
      console.log('[IPC] Save credentials request received');
      return this.credentialStore.saveCredentials(email, password);
    });

    // Get stored credentials handler
    this.ipcMain.handle('get-stored-credentials', async (event) => {
      console.log('[IPC] Get stored credentials request received');
      const result = this.credentialStore.getCredentials();

      // Don't send password to renderer for security
      if (result.success && result.credentials) {
        return {
          success: true,
          credentials: {
            email: result.credentials.email
            // Password intentionally not included
          }
        };
      }

      return { success: false, credentials: null };
    });

    // Clear credentials handler
    this.ipcMain.handle('clear-credentials', async (event) => {
      console.log('[IPC] Clear credentials request received');
      return this.credentialStore.clearCredentials();
    });

    // Logout handler
    this.ipcMain.handle('logout', async (event) => {
      console.log('[IPC] Logout request received');
      // Clear scraper session (create new instance)
      this.scraper = new PaccoolScraper();
      return { success: true };
    });

    console.log('[IPC] All handlers registered successfully');
  }
}

module.exports = IPCHandlers;
