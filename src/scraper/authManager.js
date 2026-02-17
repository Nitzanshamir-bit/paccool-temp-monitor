const axios = require('axios');
const cheerio = require('cheerio');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const fs = require('fs');
const path = require('path');

class AuthManager {
  constructor() {
    this.jar = new CookieJar();
    this.client = wrapper(axios.create({
      jar: this.jar,
      maxRedirects: 5,
      validateStatus: (status) => status < 500
    }));

    const configPath = path.join(__dirname, '..', '..', 'config', 'selectors.json');
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    this.tanks = [];
    this.dealer = false;
    this.farms = [];
  }

  async login(email, password) {
    try {
      console.log('[AuthManager] Starting login process...');

      const loginPageResponse = await this.client.get(this.config.loginUrl);
      const $ = cheerio.load(loginPageResponse.data);

      let csrfToken = null;
      for (const selector of this.config.csrfTokenSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          csrfToken = element.val() || element.attr('content');
          if (csrfToken) break;
        }
      }

      const loginData = { email, password };
      if (csrfToken) loginData._token = csrfToken;

      const loginResponse = await this.client.post(
        this.config.loginUrl,
        loginData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': this.config.loginUrl
          }
        }
      );

      const finalUrl = loginResponse.request.res.responseUrl || loginResponse.config.url;
      console.log('[AuthManager] Final URL after login:', finalUrl);

      if (finalUrl.includes('/auth/login')) {
        const $login = cheerio.load(loginResponse.data);
        const errorMsg = $login('.alert, .error, .danger, [class*="error"]').text().trim();
        return {
          success: false,
          error: errorMsg || 'Invalid credentials. Please check your username and password.'
        };
      }

      console.log('[AuthManager] Login successful!');
      this.dashboardUrl = finalUrl;

      // Check if this is a dealer account
      if (finalUrl.includes('/dealer/')) {
        this.dealer = true;
        console.log('[AuthManager] Dealer account detected');
        await this.discoverFarms();
        return {
          success: true,
          dashboardUrl: finalUrl,
          isDealer: true,
          farmCount: this.farms.length
        };
      }

      // Regular user: discover tanks
      await this.discoverTanks(finalUrl);

      return {
        success: true,
        dashboardUrl: finalUrl,
        tankCount: this.tanks.length
      };

    } catch (error) {
      console.error('[AuthManager] Login error:', error.message);
      return {
        success: false,
        error: 'Cannot connect to PACCOOL. Please check your internet connection.'
      };
    }
  }

  /**
   * Dealer mode: discover all farms from the dealer home page members table.
   */
  async discoverFarms() {
    try {
      console.log('[AuthManager] Discovering farms (dealer mode)...');
      this.farms = [];

      const homeResp = await this.client.get(this.dashboardUrl);
      const $ = cheerio.load(homeResp.data);

      $('#dev-table tbody tr').each((i, tr) => {
        const cells = $(tr).find('td');
        const name = $(cells[1]).text().trim();
        const email = $(cells[2]).text().trim();
        const role = $(cells[4]).text().trim();

        // Get serials from select options
        const serials = [];
        $(cells[5]).find('option').each((j, opt) => {
          const serial = $(opt).text().trim();
          if (serial && serial !== 'All') serials.push(serial);
        });

        // Get user ID from edit button
        const editBtn = $(cells[6]).find('.edituser');
        const editHref = editBtn.attr('data-href') || '';
        const userIdMatch = editHref.match(/\/dealer\/edit\/(\d+)/);
        const userId = userIdMatch ? userIdMatch[1] : null;

        if (role === 'User' && userId) {
          this.farms.push({ name, email, userId, serials, tankCount: serials.length });
        }
      });

      console.log(`[AuthManager] Found ${this.farms.length} farms:`);
      this.farms.forEach(f => console.log(`  - ${f.name} (${f.userId}): [${f.serials.join(', ')}]`));

    } catch (error) {
      console.error('[AuthManager] Farm discovery error:', error.message);
    }
  }

  /**
   * Dealer mode: discover tanks for a specific farm by userId.
   * Visits /en/dealer/tanks/{userId} which redirects to the tank detail page
   * or shows a tank selection page for multi-tank users.
   */
  async discoverFarmTanks(userId) {
    try {
      console.log(`[AuthManager] Discovering tanks for farm userId=${userId}...`);
      const tanks = [];

      const resp = await this.client.get(`${this.config.baseUrl}/${this.config.locale}/dealer/tanks/${userId}`);
      const finalUrl = resp.request.res.responseUrl || resp.config.url;
      const $ = cheerio.load(resp.data);

      // Check if redirected to a specific tank (single-tank user)
      const directMatch = finalUrl.match(/\/dealer\/user\/(\d+)\/(\d+)\/([^\/\?]+)/);
      if (directMatch) {
        const tank = {
          tankId: directMatch[2],
          serial: directMatch[3],
          detailUrl: finalUrl
        };
        this._parseTankPanels($, tank);
        tanks.push(tank);
      }

      // Also check for SELECT! links (multi-tank user)
      $('a[href*="dealer/user"]').each((j, a) => {
        const text = $(a).text().trim();
        const href = $(a).attr('href') || '';
        if (text === 'SELECT!') {
          const match = href.match(/\/dealer\/user\/(\d+)\/(\d+)\/([^\/\?]+)/);
          if (match && !tanks.find(t => t.serial === match[3])) {
            const fullUrl = href.startsWith('http') ? href : `${this.config.baseUrl}${href}`;
            tanks.push({
              tankId: match[2],
              serial: match[3],
              detailUrl: fullUrl
            });
          }
        }
      });

      // Fetch details for any tanks that don't have name yet
      for (const tank of tanks) {
        if (!tank.name) {
          await this.fetchTankInfo(tank);
        }
      }

      return tanks;
    } catch (error) {
      console.error(`[AuthManager] Error discovering farm tanks for userId=${userId}:`, error.message);
      return [];
    }
  }

  _parseTankPanels($, tank) {
    const table = $('#oculustable');
    if (table.length) {
      tank.userid = table.attr('userid');
    }

    const panels = {};
    $('.panel').each((i, panel) => {
      const heading = $(panel).find('.panel-heading h3').text().trim();
      if (heading) panels[heading] = $(panel);
    });

    if (panels['Info']) {
      const infoItems = panels['Info'].find('.panel-body ul li');
      tank.name = $(infoItems[0]).text().trim();
      tank.model = $(infoItems[1]).text().trim();
    }

    if (panels['Latest']) {
      const latestItems = panels['Latest'].find('.panel-body ul li');
      tank.timestamp = $(latestItems[0]).text().trim();
      tank.status = $(latestItems[1]).text().trim();
      tank.temperature = $(latestItems[2]).text().trim();
    }

    if (panels['Success']) {
      tank.message = panels['Success'].find('.panel-body').text().trim();
    }
  }

  async discoverTanks(loginRedirectUrl) {
    try {
      console.log('[AuthManager] Discovering tanks...');
      this.tanks = [];

      // Check if login redirected to a tank detail page (single-tank user)
      const tankDetailMatch = loginRedirectUrl.match(/\/tankdetail\/(\d+)\/([^\/\?]+)/);
      if (tankDetailMatch) {
        console.log('[AuthManager] Single-tank user, redirect went to tankdetail');
        this.tanks.push({
          tankId: tankDetailMatch[1],
          serial: tankDetailMatch[2],
          detailUrl: loginRedirectUrl
        });
      }

      // Also visit home page to find all tanks
      const homeResponse = await this.client.get(this.config.homeUrl);
      const $ = cheerio.load(homeResponse.data);

      $('a[href*="tankdetail"]').each((i, el) => {
        const href = $(el).attr('href');
        const match = href.match(/\/tankdetail\/(\d+)\/([^\/\?]+)/);
        if (match) {
          const tankId = match[1];
          const serial = match[2];
          const fullUrl = href.startsWith('http') ? href : `${this.config.baseUrl}${href}`;

          // Avoid duplicates
          if (!this.tanks.find(t => t.serial === serial)) {
            this.tanks.push({ tankId, serial, detailUrl: fullUrl });
          }
        }
      });

      // If no tanks found from links, use the dashboard URL itself
      if (this.tanks.length === 0 && this.dashboardUrl) {
        const match = this.dashboardUrl.match(/\/tankdetail\/(\d+)\/([^\/\?]+)/);
        if (match) {
          this.tanks.push({
            tankId: match[1],
            serial: match[2],
            detailUrl: this.dashboardUrl
          });
        }
      }

      console.log(`[AuthManager] Found ${this.tanks.length} tanks:`);
      this.tanks.forEach(t => console.log(`  - serial=${t.serial} tankId=${t.tankId}`));

      // Fetch details for each tank (name, model, status)
      for (const tank of this.tanks) {
        await this.fetchTankInfo(tank);
      }

    } catch (error) {
      console.error('[AuthManager] Tank discovery error:', error.message);
      // If discovery fails, still try using dashboardUrl as single tank
      if (this.tanks.length === 0 && this.dashboardUrl) {
        const match = this.dashboardUrl.match(/\/tankdetail\/(\d+)\/([^\/\?]+)/);
        if (match) {
          this.tanks.push({
            tankId: match[1],
            serial: match[2],
            detailUrl: this.dashboardUrl
          });
        }
      }
    }
  }

  async fetchTankInfo(tank) {
    try {
      const response = await this.client.get(tank.detailUrl);
      const $ = cheerio.load(response.data);
      this._parseTankPanels($, tank);
      console.log(`[AuthManager] Tank ${tank.serial}: name="${tank.name}" temp=${tank.temperature}`);
    } catch (error) {
      console.error(`[AuthManager] Error fetching info for tank ${tank.serial}:`, error.message);
    }
  }

  async validateSession() {
    try {
      if (!this.dashboardUrl && this.tanks.length === 0 && this.farms.length === 0) return false;

      const checkUrl = this.dealer
        ? this.dashboardUrl
        : (this.tanks.length > 0 ? this.tanks[0].detailUrl : this.dashboardUrl);
      const response = await this.client.get(checkUrl);
      const finalUrl = response.request.res.responseUrl || response.config.url;
      return !finalUrl.includes('/auth/login');
    } catch (error) {
      console.error('[AuthManager] Session validation error:', error.message);
      return false;
    }
  }

  isDealer() {
    return this.dealer;
  }

  getFarms() {
    return this.farms;
  }

  getClient() {
    return this.client;
  }

  getDashboardUrl() {
    return this.dashboardUrl;
  }

  getTanks() {
    return this.tanks;
  }
}

module.exports = AuthManager;
