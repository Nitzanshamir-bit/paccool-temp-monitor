const AuthManager = require('./authManager');
const DataParser = require('./dataParser');
const fs = require('fs');
const path = require('path');

class PaccoolScraper {
  constructor() {
    this.authManager = new AuthManager();
    this.dataParser = new DataParser();
    this.isAuthenticated = false;

    const configPath = path.join(__dirname, '..', '..', 'config', 'selectors.json');
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  async login(email, password) {
    console.log('[PaccoolScraper] Attempting login...');
    const result = await this.authManager.login(email, password);

    if (result.success) {
      this.isAuthenticated = true;
      console.log('[PaccoolScraper] Login successful, tanks:', result.tankCount);
    } else {
      this.isAuthenticated = false;
    }

    return result;
  }

  /**
   * Get temperature data for all tanks.
   */
  async getAllTanksData() {
    if (!this.isAuthenticated) {
      return { success: false, error: 'Not authenticated. Please login first.' };
    }

    try {
      const isValid = await this.authManager.validateSession();
      if (!isValid) {
        this.isAuthenticated = false;
        return { success: false, error: 'Session expired', sessionExpired: true };
      }

      const tanks = this.authManager.getTanks();
      if (!tanks || tanks.length === 0) {
        return { success: false, error: 'No tanks discovered' };
      }

      const client = this.authManager.getClient();
      const tanksData = [];

      for (const tank of tanks) {
        try {
          const response = await client.get(tank.detailUrl);
          const data = this.dataParser.parseTemperatureData(response.data);

          if (data) {
            tanksData.push({
              tankName: data.tankName,
              model: data.model,
              serial: data.serial,
              temperature: data.temperature,
              timestamp: data.timestamp,
              status: data.status,
              message: data.message
            });
          } else {
            // Use cached data from discovery
            tanksData.push({
              tankName: tank.name || 'Unknown',
              model: tank.model || '--',
              serial: tank.serial,
              temperature: tank.temperature || '--',
              timestamp: tank.timestamp || '--',
              status: tank.status || '--',
              message: tank.message || '--'
            });
          }
        } catch (error) {
          console.error(`[PaccoolScraper] Error fetching tank ${tank.serial}:`, error.message);
          tanksData.push({
            tankName: tank.name || 'Unknown',
            serial: tank.serial,
            temperature: '--',
            timestamp: '--',
            status: 'ERROR',
            message: error.message
          });
        }
      }

      return { success: true, tanks: tanksData };
    } catch (error) {
      console.error('[PaccoolScraper] Error:', error.message);
      return { success: false, error: 'Failed to fetch temperature data.' };
    }
  }

  /**
   * V1 compatibility: get single tank data
   */
  async getTemperatureData() {
    const result = await this.getAllTanksData();

    if (result.success && result.tanks && result.tanks.length > 0) {
      return { success: true, data: result.tanks[0] };
    }

    return result;
  }

  /**
   * Get graph data for a specific tank on a specific date.
   */
  async getGraphData(serial, dateStr) {
    if (!this.isAuthenticated) {
      return { success: false, error: 'Not authenticated.' };
    }

    try {
      const isValid = await this.authManager.validateSession();
      if (!isValid) {
        this.isAuthenticated = false;
        return { success: false, error: 'Session expired', sessionExpired: true };
      }

      const client = this.authManager.getClient();
      const filename = this._dateToFilename(dateStr);

      // Visit tank detail page first to establish context
      const tank = this.authManager.getTanks().find(t => t.serial === serial);
      if (tank) {
        await client.get(tank.detailUrl);
      }

      const postUrl = `${this.config.baseUrl}/${this.config.locale}/post`;
      console.log(`[PaccoolScraper] Fetching graph data: serial=${serial} file=${filename}`);

      const response = await client.get(postUrl, {
        params: { filename, serial },
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html'
        }
      });

      if (response.status !== 200 || typeof response.data !== 'string') {
        return { success: false, error: 'Failed to fetch graph data' };
      }

      const graphData = this.dataParser.parseTableDataForGraph(response.data);

      return {
        success: true,
        serial,
        date: dateStr,
        data: graphData
      };
    } catch (error) {
      console.error('[PaccoolScraper] Graph data error:', error.message);
      return { success: false, error: 'Failed to fetch graph data.' };
    }
  }

  /**
   * Get graph data for ALL tanks on a specific date.
   */
  async getAllTanksGraphData(dateStr) {
    if (!this.isAuthenticated) {
      return { success: false, error: 'Not authenticated.' };
    }

    try {
      const isValid = await this.authManager.validateSession();
      if (!isValid) {
        this.isAuthenticated = false;
        return { success: false, error: 'Session expired', sessionExpired: true };
      }

      const tanks = this.authManager.getTanks();
      const results = [];

      for (const tank of tanks) {
        const result = await this.getGraphData(tank.serial, dateStr);
        results.push({
          serial: tank.serial,
          name: tank.name || 'Unknown',
          ...(result.success ? result.data : { temps: [], volume: [] })
        });
      }

      return { success: true, date: dateStr, tanks: results };
    } catch (error) {
      console.error('[PaccoolScraper] All tanks graph error:', error.message);
      return { success: false, error: 'Failed to fetch graph data.' };
    }
  }

  getTanks() {
    return this.authManager.getTanks();
  }

  async validateSession() {
    return await this.authManager.validateSession();
  }

  /**
   * Convert YYYY-MM-DD to YYMMDD.bin filename format
   */
  _dateToFilename(dateStr) {
    const date = new Date(dateStr);
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}.bin`;
  }
}

module.exports = PaccoolScraper;
