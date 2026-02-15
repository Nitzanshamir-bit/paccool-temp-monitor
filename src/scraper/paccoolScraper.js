const AuthManager = require('./authManager');
const DataParser = require('./dataParser');

class PaccoolScraper {
  constructor() {
    this.authManager = new AuthManager();
    this.dataParser = new DataParser();
    this.isAuthenticated = false;
  }

  async login(email, password) {
    console.log('[PaccoolScraper] Attempting login...');
    const result = await this.authManager.login(email, password);

    if (result.success) {
      this.isAuthenticated = true;
      console.log('[PaccoolScraper] Login successful, dashboard URL:', result.dashboardUrl);
    } else {
      this.isAuthenticated = false;
      console.error('[PaccoolScraper] Login failed:', result.error);
    }

    return result;
  }

  async getTemperatureData() {
    if (!this.isAuthenticated) {
      return {
        success: false,
        error: 'Not authenticated. Please login first.'
      };
    }

    try {
      console.log('[PaccoolScraper] Fetching temperature data...');

      // Validate session first
      const isValid = await this.authManager.validateSession();
      if (!isValid) {
        console.error('[PaccoolScraper] Session expired');
        this.isAuthenticated = false;
        return {
          success: false,
          error: 'Session expired',
          sessionExpired: true
        };
      }

      // Get dashboard page
      const client = this.authManager.getClient();
      const dashboardUrl = this.authManager.getDashboardUrl();

      const response = await client.get(dashboardUrl);

      // Parse the HTML
      const data = this.dataParser.parseTemperatureData(response.data);

      if (!data) {
        return {
          success: false,
          error: 'Failed to parse temperature data'
        };
      }

      console.log('[PaccoolScraper] Temperature data retrieved successfully');

      return {
        success: true,
        data: {
          tankName: data.tankName,
          model: data.model,
          serial: data.serial,
          temperature: data.temperature,
          timestamp: data.timestamp,
          status: data.status,
          message: data.message
        }
      };

    } catch (error) {
      console.error('[PaccoolScraper] Error fetching temperature data:', error.message);
      return {
        success: false,
        error: 'Failed to fetch temperature data. Please try again.'
      };
    }
  }

  async validateSession() {
    return await this.authManager.validateSession();
  }
}

module.exports = PaccoolScraper;
